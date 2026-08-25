const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Native folder dialog & project scanning
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanYoctoProject: (rootPath) => ipcRenderer.invoke('yocto:scanProject', rootPath),

  // File System & Dialog Operations
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:showItemInFolder', fullPath),

  // Event Listeners from Main Process
  onMenuOpenDirectory: (callback) => {
    const handler = (_event, dirPath) => callback(dirPath);
    ipcRenderer.on('menu:open-directory', handler);
    return () => ipcRenderer.removeListener('menu:open-directory', handler);
  },

  onCliOpenDirectory: (callback) => {
    const handler = (_event, dirPath) => callback(dirPath);
    ipcRenderer.on('cli:open-directory', handler);
    return () => ipcRenderer.removeListener('cli:open-directory', handler);
  },

  onMenuLoadDemo: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('menu:load-demo', handler);
    return () => ipcRenderer.removeListener('menu:load-demo', handler);
  },

  onScanProgress: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  }
});
