const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  getDirname: () => __dirname,
  joinPath: (...args) => path.join(...args),
  
  sendMessage: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  invokeAction: async (channel, args) => {
    return await ipcRenderer.invoke(channel, args);
  },
  
  onReply: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  
  // File management
  readDirectory: (dirPath, options) => ipcRenderer.invoke('read-directory', dirPath, options),
  batchRename: (data) => ipcRenderer.invoke('batch-rename', data),
  renameFile: (data) => ipcRenderer.invoke('rename-file', data),
  batchRenameV2: (data) => ipcRenderer.invoke('batch-rename-v2', data),
  
  // System dialogs
  showConfirmDialog: (options) => ipcRenderer.invoke('show-confirm-dialog', options),
  showSystemNotification: (options) => ipcRenderer.invoke('show-system-notification', options),
  
  // Shortcuts
  updateLockShortcut: (oldSc, newSc) => ipcRenderer.invoke('update-lock-shortcut', oldSc, newSc),
  
  // Listen to lock event
  onLockScreen: (callback) => {
    ipcRenderer.on('lock-screen', () => callback());
  }
});
