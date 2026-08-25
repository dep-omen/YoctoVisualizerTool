const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { scanYoctoProjectNative } = require('./yoctoScannerNode.cjs');

let mainWindow = null;
let cliProjectPath = null;

// Parse CLI argument for project path (e.g. `electron . /path/to/yocto`)
const args = process.argv.slice(app.isPackaged ? 1 : 2);
for (const arg of args) {
  if (!arg.startsWith('-') && fs.existsSync(arg)) {
    cliProjectPath = path.resolve(arg);
    break;
  }
}

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Yocto Layer Visualizer',
    backgroundColor: '#090d16', // Slate dark canvas matching theme
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (cliProjectPath) {
      setTimeout(() => {
        mainWindow.webContents.send('cli:open-directory', cliProjectPath);
      }, 800);
    }
  });

  // Open external web links in OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load URL or build file
  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (isDev) {
    const devUrl = 'http://localhost:3000';
    mainWindow.loadURL(devUrl).catch(() => {
      console.log('Dev server not yet ready, loading fallback file...');
      const distIndex = path.join(__dirname, '../dist/index.html');
      if (fs.existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      } else {
        setTimeout(() => mainWindow.loadURL(devUrl), 1500);
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  createAppMenu();
}

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Yocto Project Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (mainWindow) {
              const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Yocto Project Root Folder',
                properties: ['openDirectory']
              });
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow.webContents.send('menu:open-directory', result.filePaths[0]);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Explore Sample STM32MP1 Demo',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:load-demo');
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Yocto Project Documentation',
          click: async () => {
            await shell.openExternal('https://docs.yoctoproject.org/');
          }
        },
        {
          label: 'OpenEmbedded Layer Index',
          click: async () => {
            await shell.openExternal('https://layers.openembedded.org/');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Yocto Project Root (Containing build/conf or layers)',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('yocto:scanProject', async (event, rootPath) => {
  try {
    const onProgress = (status) => {
      event.sender.send('scan:progress', status);
    };
    return await scanYoctoProjectNative(rootPath, onProgress);
  } catch (err) {
    console.error('Native scan error:', err);
    throw new Error(err.message || 'Failed to scan Yocto directory');
  }
});

ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, options);
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    throw new Error(`Failed to write file ${filePath}: ${err.message}`);
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read file ${filePath}: ${err.message}`);
  }
});

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
  if (fs.existsSync(fullPath)) {
    shell.showItemInFolder(fullPath);
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
