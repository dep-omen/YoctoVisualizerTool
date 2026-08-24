const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Native folder picker
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),

  // Native File System Operations
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),

  // Menu Event Listeners
  onMenuOpenDirectory: (callback) => {
    const handler = (event, dirPath) => callback(dirPath);
    ipcRenderer.on('menu:open-directory', handler);
    return () => ipcRenderer.removeListener('menu:open-directory', handler);
  }
});
