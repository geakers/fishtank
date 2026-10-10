const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fishtank', {
  lockDown: (enabled) => ipcRenderer.invoke('lock-down', enabled),
  createAccount: (account) => ipcRenderer.invoke('create-account', account),
});
