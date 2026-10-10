const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fishtank', {
  lockDown: (enabled) => ipcRenderer.invoke('lock-down', enabled),
});
