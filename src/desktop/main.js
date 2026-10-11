const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { createAccount } = require('../database/accounts');
const {
  isValidCommitment,
  sessionEarnings,
  getProfile,
  getPoints,
  setPoints,
  setMinutesStudied,
  verifyPoints,
} = require('./profiles');
const {
  createGroup, listGroups, deleteGroup, leaveGroup, addMember, groupRoster, searchUsernames,
  inviteMember, listInvites, acceptInvite, declineInvite, groupInvites,
} = require('./groups');
const { listNotes, submitNote, deleteNote, noteFileUrl } = require('./notes');
const { listFish, buyFish, setFishInTank, setAvatarFish } = require('./fish');
const { restoreSession, logIn, logOut, currentUser, getAccessToken } = require('./session');
const { listRunningApps, getAllowedApps, setAllowedApps, startStudy, stopStudy } = require('./study-mode');

// When the running session (strict lockdown or study mode) started (ms since
// epoch), or null.
let sessionStartedAt = null;
// How many minutes the user committed to for the running session, or null.
let sessionCommitMinutes = null;

// Puts the given window into kiosk mode (enabled = true) or takes it back out
// (enabled = false). Returns the window's actual kiosk state afterwards.
function lockDown(win, enabled) {
  win.setKiosk(enabled);
  return win.isKiosk();
}

// Starts timing a session the user committed commitMinutes to. A session
// already running keeps its start and commitment.
function beginSession(commitMinutes) {
  if (!isValidCommitment(commitMinutes)) throw new Error('Choose how long to focus for first');
  if (sessionStartedAt !== null) return;
  sessionStartedAt = Date.now();
  sessionCommitMinutes = commitMinutes;
}

// Ends the running session, whichever kind it is: takes the window out of
// kiosk mode and stops study mode, then adds the minutes the session ran to
// the logged-in user's minutes studied. Points are only added when the
// session lasted as long as the user committed to (see sessionEarnings).
// Kiosk and study mode are turned off even if nothing can be saved.
async function endSession(win) {
  const locked = lockDown(win, false);
  await stopStudy();
  const seconds = sessionStartedAt === null ? 0 : Math.floor((Date.now() - sessionStartedAt) / 1000);
  const commitMinutes = sessionCommitMinutes;
  sessionStartedAt = null;
  sessionCommitMinutes = null;

  const { completed, minutes, pointsEarned } = sessionEarnings(seconds, commitMinutes);
  const result = { locked, completed, commitMinutes, minutes, pointsEarned, saved: false, error: null };
  const user = currentUser();
  if (!user || minutes === 0) return result;

  try {
    const profile = await getProfile(user.uid);
    if (!profile) throw new Error('No profile found');

    // Minutes go first: if the points write then fails, the user is short of
    // points rather than holding points that verifyPoints can't account for.
    await setMinutesStudied(user.uid, (profile.minutes_studied ?? 0) + minutes);
    if (pointsEarned > 0) {
      // Rounded so repeated additions don't pick up floating point noise.
      await setPoints(user.uid, Math.round((profile.points + pointsEarned) * 10000) / 10000);
    }
    result.saved = true;
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

// TEMPORARY: typing this code on the home screen adds CODE_POINTS to the
// logged-in user's saved points. Keep in sync with POINTS_CODE in
// src/frontend/useFishtank.ts. Remove before release.
const POINTS_CODE = 'p02162008';
const CODE_POINTS = 1_000_000;

// Adds CODE_POINTS to the logged-in user's saved points if code is
// POINTS_CODE. Returns the new balance.
async function redeemCode(code) {
  if (code !== POINTS_CODE) throw new Error('That code does nothing');
  const user = currentUser();
  if (!user) throw new Error('Log in first');
  const points = await getPoints(user.uid);
  if (points === null) throw new Error('No profile found');
  return setPoints(user.uid, points + CODE_POINTS);
}

// Set by `npm run dev` (scripts/dev.mjs) to load the Vite dev server with hot
// reload. Otherwise the built frontend in dist/frontend is loaded.
const devServerUrl = process.env.FISHTANK_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#6fcdf7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Closing the window ends study mode, so notifications don't stay silenced.
  win.on('closed', () => void stopStudy());

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'frontend', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('lock-down', (event, enabled, commitMinutes) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (enabled) beginSession(commitMinutes);
    const locked = lockDown(win, Boolean(enabled));
    if (!locked) {
      sessionStartedAt = null;
      sessionCommitMinutes = null;
    }
    return locked;
  });
  ipcMain.handle('start-study', (event, commitMinutes) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    beginSession(commitMinutes);
    return startStudy(win, (appName) => {
      if (!win.isDestroyed()) win.webContents.send('study-app-blocked', appName);
    });
  });
  ipcMain.handle('list-running-apps', () => listRunningApps());
  ipcMain.handle('get-allowed-apps', () => getAllowedApps());
  ipcMain.handle('set-allowed-apps', (event, apps) => setAllowedApps(apps));
  ipcMain.handle('end-session', (event) => endSession(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.handle('create-account', (event, account) => createAccount(account));
  ipcMain.handle('get-profile', (event, uid) => getProfile(uid));
  ipcMain.handle('get-points', (event, uid) => getPoints(uid));
  ipcMain.handle('verify-points', (event, uid) => verifyPoints(uid));
  ipcMain.handle('redeem-code', (event, code) => redeemCode(code));
  ipcMain.handle('log-in', (event, credentials) => logIn(credentials));
  ipcMain.handle('log-out', () => logOut());
  ipcMain.handle('get-current-user', async () => {
    // Renews an expired session. If that fails for a reason other than Supabase
    // ending the session (e.g. being offline), the user stays logged in.
    await getAccessToken().catch(() => {});
    return currentUser();
  });

  ipcMain.handle('create-group', (event, name) => createGroup(name));
  ipcMain.handle('list-groups', () => listGroups());
  ipcMain.handle('delete-group', (event, groupId) => deleteGroup(groupId));
  ipcMain.handle('leave-group', (event, groupId) => leaveGroup(groupId));
  ipcMain.handle('add-member', (event, groupId, username) => addMember(groupId, username));
  ipcMain.handle('group-roster', (event, groupId) => groupRoster(groupId));
  ipcMain.handle('search-usernames', (event, query) => searchUsernames(query));
  ipcMain.handle('invite-member', (event, groupId, username) => inviteMember(groupId, username));
  ipcMain.handle('list-invites', () => listInvites());
  ipcMain.handle('accept-invite', (event, groupId) => acceptInvite(groupId));
  ipcMain.handle('decline-invite', (event, groupId) => declineInvite(groupId));
  ipcMain.handle('group-invites', (event, groupId) => groupInvites(groupId));

  ipcMain.handle('list-notes', () => listNotes());
  ipcMain.handle('submit-note', (event, note) => submitNote(note));
  ipcMain.handle('delete-note', (event, noteId) => deleteNote(noteId));
  // Opens the file in the default browser or viewer through a 5-minute link.
  ipcMain.handle('open-note-file', async (event, storagePath) => shell.openExternal(await noteFileUrl(storagePath)));

  ipcMain.handle('list-fish', () => listFish());
  ipcMain.handle('buy-fish', (event, fishId, price) => buyFish(fishId, price));
  ipcMain.handle('set-fish-in-tank', (event, fishId, inTank) => setFishInTank(fishId, inTank));
  ipcMain.handle('set-avatar-fish', (event, fishId) => setAvatarFish(fishId));

  restoreSession();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => void stopStudy());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
