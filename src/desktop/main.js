const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Puts the given window into kiosk mode (enabled = true) or takes it back out
// (enabled = false). Returns the window's actual kiosk state afterwards.
function lockDown(win, enabled) {
  win.setKiosk(enabled);
  return win.isKiosk();
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

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'frontend', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('lock-down', (event, enabled) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return lockDown(win, Boolean(enabled));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
