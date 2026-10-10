const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fishtank', {
  lockDown: (enabled) => ipcRenderer.invoke('lock-down', enabled),
  endSession: () => ipcRenderer.invoke('end-session'),
  createAccount: (account) => ipcRenderer.invoke('create-account', account),
  getProfile: (uid) => ipcRenderer.invoke('get-profile', uid),
  getPoints: (uid) => ipcRenderer.invoke('get-points', uid),
  verifyPoints: (uid) => ipcRenderer.invoke('verify-points', uid),
  logIn: (credentials) => ipcRenderer.invoke('log-in', credentials),
  logOut: () => ipcRenderer.invoke('log-out'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
});
