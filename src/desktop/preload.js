const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fishtank', {
  lockDown: (enabled) => ipcRenderer.invoke('lock-down', enabled),
  createAccount: (account) => ipcRenderer.invoke('create-account', account),
  getProfile: (uid) => ipcRenderer.invoke('get-profile', uid),
  getPoints: (uid) => ipcRenderer.invoke('get-points', uid),
  logIn: (credentials) => ipcRenderer.invoke('log-in', credentials),
  logOut: () => ipcRenderer.invoke('log-out'),
  getCurrentUser: () => ipcRenderer.invoke('get-current-user'),
  createGroup: (name) => ipcRenderer.invoke('create-group', name),
  listGroups: () => ipcRenderer.invoke('list-groups'),
  addMember: (groupId, username) => ipcRenderer.invoke('add-member', groupId, username),
  groupRoster: (groupId) => ipcRenderer.invoke('group-roster', groupId),
  searchUsernames: (query) => ipcRenderer.invoke('search-usernames', query),
});
