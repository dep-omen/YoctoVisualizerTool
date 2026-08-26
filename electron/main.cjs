const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { scanYoctoProjectNative } = require('./yoctoScannerNode.cjs');

let mainWindow = null;
let staticServer = null;
let staticServerUrl = null;
let cliProjectPath = null;

// Parse CLI argument for project path (e.g. `electron . /path/to/yocto`)
const args = process.argv.slice(app.isPackaged ? 1 : 2);
for (const arg of args) {
  if (!arg.startsWith('-') && fs.existsSync(arg)) {
    cliProjectPath = path.resolve(arg);
    break;
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

/**
 * Start a zero-dependency embedded HTTP server for the compiled dist directory.
 * This completely avoids file:// CORS restrictions with ES modules in Chromium.
 */
function startStaticDistServer(distDir) {
  return new Promise((resolve) => {
    if (!fs.existsSync(distDir)) {
      console.warn(`[Electron] Dist directory ${distDir} does not exist yet.`);
    }

    const server = http.createServer((req, res) => {
      try {
        let reqPath = decodeURIComponent(req.url.split('?')[0]);
        if (reqPath === '/' || !reqPath) reqPath = '/index.html';

        let filePath = path.join(distDir, reqPath);

        // Fallback for SPA routing
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distDir, 'index.html');
        }

        if (!fs.existsSync(filePath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>YoctoVisualizer</title><style>body{background:${nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc'};color:${nativeTheme.shouldUseDarkColors ? '#f1f5f9' : '#0f172a'};font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}</style></head>
              <body>
                <div>
                  <h2>Building application assets...</h2>
                  <p>Please run <code>npm run build</code> or start the dev server with <code>npm run electron:dev</code></p>
                </div>
              </body>
            </html>
          `);
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading asset');
            return;
          }
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          });
          res.end(data);
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      staticServer = server;
      staticServerUrl = `http://127.0.0.1:${port}`;
      console.log(`[Electron] Embedded static server listening on ${staticServerUrl}`);
      resolve(staticServerUrl);
    });

    server.on('error', (err) => {
      console.error('[Electron] Static server error:', err);
      resolve(null);
    });
  });
}

/**
 * Check if the Vite dev server is responding at a URL
 */
function checkDevServer(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      if (res.statusCode && res.statusCode < 400) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'YoctoVisualizer',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
      webSecurity: false // Enables loading local resources smoothly
    }
  });

  // Log renderer console messages to terminal
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levelStr = level === 3 ? 'ERROR' : level === 2 ? 'WARN' : 'INFO';
    console.log(`[Renderer ${levelStr}] ${message}`);
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

  // Determine URL to load:
  // 1. If ELECTRON_START_URL is explicitly set
  // 2. Or if localhost:3000 Vite dev server is running
  // 3. Or load from our local embedded static server (serving dist/)
  const devPortUrl = 'http://localhost:3000';
  const customStartUrl = process.env.ELECTRON_START_URL;

  let targetUrl = null;

  if (customStartUrl && (await checkDevServer(customStartUrl, 1000))) {
    targetUrl = customStartUrl;
    console.log(`[Electron] Connecting to custom URL: ${targetUrl}`);
  } else if (await checkDevServer(devPortUrl, 600)) {
    targetUrl = devPortUrl;
    console.log(`[Electron] Connecting to live Vite dev server: ${targetUrl}`);
  } else {
    // Start our embedded local server serving dist/
    const distDir = path.join(__dirname, '../dist');
    const localUrl = await startStaticDistServer(distDir);
    targetUrl = localUrl || devPortUrl;
    console.log(`[Electron] Serving production build at: ${targetUrl}`);
  }

  await mainWindow.loadURL(targetUrl);
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
          accelerator: 'CmdOrCtrl+D',
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
    // If base64 png
    if (typeof content === 'string' && !content.startsWith('<') && !content.startsWith('{') && content.length > 500 && /^[A-Za-z0-9+/=]+$/.test(content.slice(0, 100))) {
      await fs.promises.writeFile(filePath, Buffer.from(content, 'base64'));
    } else {
      await fs.promises.writeFile(filePath, content, 'utf-8');
    }
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

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
