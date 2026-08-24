# Yocto Layer Visualizer — Desktop (Electron) Guide

This application can run both as a web app in the browser and as a native desktop application using **Electron**.

---

## 🚀 Running with Electron

### 1. Development Mode (with Live Reload)
To run the Electron desktop app in development mode:
```bash
npm run electron:dev
```
This command starts Vite on `http://localhost:3000` and launches the Electron application window once the server is ready.

### 2. Standalone Electron Launch (after build)
```bash
npm run build
npm run electron
```

---

## 📦 Packaging for Linux, Windows & macOS

You can package this visualizer into native distribution packages (AppImage, deb, dmg, exe) using `electron-builder`:

### Install builder (if not already installed)
```bash
npm install --save-dev electron-builder
```

### Build Distribution Packages
- **Linux (AppImage & .deb for Ubuntu/Debian/Fedora):**
  ```bash
  npx electron-builder --linux
  ```
- **macOS (.dmg & zip):**
  ```bash
  npx electron-builder --mac
  ```
- **Windows (.exe installer):**
  ```bash
  npx electron-builder --win
  ```

Packaged installers and executables will be output to the `release/` directory.

---

## 🧩 Electron Architecture

- **Main Process (`electron/main.cjs`)**:
  - Initializes `BrowserWindow` with native title controls and slate styling.
  - Native OS application menu with keyboard shortcuts (e.g. `Ctrl+O` / `Cmd+O` to open Yocto project folders).
  - Handles IPC events (`dialog:openDirectory`, `fs:readFile`, `fs:readDir`).
- **Preload Script (`electron/preload.cjs`)**:
  - Exposes `window.electronAPI` securely using `contextBridge`.
- **Renderer Process (`src/App.tsx`)**:
  - Seamlessly functions in standard modern browsers via the File System Access API and in Electron.
