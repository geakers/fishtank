const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { createAccount } = require('../database/accounts');

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

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
