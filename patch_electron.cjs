const fs = require('fs');

let content = fs.readFileSync('electron/main.cjs', 'utf8');

content = content.replace(
  "const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');",
  "const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require('electron');"
);

content = content.replace(
  /backgroundColor: '#090d16'/g,
  "backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc'"
);

content = content.replace(
  /<style>body\{background:#090d16;color:#e2e8f0/g,
  "<style>body{background:${nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc'};color:${nativeTheme.shouldUseDarkColors ? '#f1f5f9' : '#0f172a'}"
);

fs.writeFileSync('electron/main.cjs', content, 'utf8');
