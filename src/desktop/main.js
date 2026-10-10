const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { createAccount } = require('../database/accounts');
const {
  POINTS_PER_MINUTE,
  getProfile,
  getPoints,
  setPoints,
  setMinutesStudied,
  verifyPoints,
} = require('./profiles');
const { restoreSession, logIn, logOut, currentUser, getAccessToken } = require('./session');

// When the running lockdown session started (ms since epoch), or null.
let sessionStartedAt = null;

// Puts the given window into kiosk mode (enabled = true) or takes it back out
// (enabled = false). Returns the window's actual kiosk state afterwards.
function lockDown(win, enabled) {
  win.setKiosk(enabled);
  return win.isKiosk();
}

// Ends the lockdown session: takes the window out of kiosk mode, then adds the
// whole minutes the session ran to the logged-in user's minutes studied and
// 1/60 of a point per minute to their points. Kiosk mode is turned off even if
// those can't be saved.
async function endSession(win) {
  const locked = lockDown(win, false);
  const minutes = sessionStartedAt === null ? 0 : Math.floor((Date.now() - sessionStartedAt) / 60000);
  sessionStartedAt = null;

  const result = { locked, minutes, pointsEarned: minutes * POINTS_PER_MINUTE, saved: false, error: null };
  const user = currentUser();
  if (!user || minutes === 0) return result;

  try {
    const profile = await getProfile(user.uid);
    if (!profile) throw new Error('No profile found');

    // Minutes go first: if the points write then fails, the user is short of
    // points rather than holding points that verifyPoints can't account for.
    await setMinutesStudied(user.uid, (profile.minutes_studied ?? 0) + minutes);
    // Rounded so repeated additions don't pick up floating point noise.
    await setPoints(user.uid, Math.round((profile.points + result.pointsEarned) * 10000) / 10000);
    result.saved = true;
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    backgroundColor: '#1565c0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '..', 'frontend', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('lock-down', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const locked = lockDown(win, Boolean(enabled));
    if (!locked) sessionStartedAt = null;
    else sessionStartedAt ??= Date.now();
    return locked;
  });
  ipcMain.handle('end-session', (event) => endSession(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.handle('create-account', (event, account) => createAccount(account));
  ipcMain.handle('get-profile', (event, uid) => getProfile(uid));
  ipcMain.handle('get-points', (event, uid) => getPoints(uid));
  ipcMain.handle('verify-points', (event, uid) => verifyPoints(uid));
  ipcMain.handle('log-in', (event, credentials) => logIn(credentials));
  ipcMain.handle('log-out', () => logOut());
  ipcMain.handle('get-current-user', async () => {
    // Renews an expired session. If that fails for a reason other than Supabase
    // ending the session (e.g. being offline), the user stays logged in.
    await getAccessToken().catch(() => {});
    return currentUser();
  });

  restoreSession();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
