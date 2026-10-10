const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fishtank', {
  lockDown: (enabled) => ipcRenderer.invoke('lock-down', enabled),
  createAccount: (account) => ipcRenderer.invoke('create-account', account),
  getProfile: (uid) => ipcRenderer.invoke('get-profile', uid),
  getPoints: (uid) => ipcRenderer.invoke('get-points', uid),
  logIn: (credentials) => ipcRenderer.invoke('log-in', credentials),
  logOut: () => ipcRenderer.invoke('log-out'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  createClass: (className) => ipcRenderer.invoke('create-class', className),
  listClasses: () => ipcRenderer.invoke('list-classes'),
  addStudent: (classId, username) => ipcRenderer.invoke('add-student', classId, username),
  classRoster: (classId) => ipcRenderer.invoke('class-roster', classId),
  searchUsernames: (query) => ipcRenderer.invoke('search-usernames', query),
});
