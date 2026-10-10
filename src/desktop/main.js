const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { createAccount } = require('../database/accounts');
const { getProfile, getPoints } = require('./profiles');
const { restoreSession, startSession, endSession, currentUser, getAccessToken } = require('./session');

// Puts the given window into kiosk mode (enabled = true) or takes it back out
// (enabled = false). Returns the window's actual kiosk state afterwards.
function lockDown(win, enabled) {
  win.setKiosk(enabled);
  return win.isKiosk();
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
    return lockDown(win, Boolean(enabled));
  });

  ipcMain.handle('create-account', (event, account) => createAccount(account));
  ipcMain.handle('get-profile', (event, uid) => getProfile(uid));
  ipcMain.handle('get-points', (event, uid) => getPoints(uid));
  ipcMain.handle('log-in', (event, credentials) => startSession(credentials));
  ipcMain.handle('log-out', () => endSession());
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
