# Yocto Layer Visualizer — Desktop (Electron) Guide

This application runs both as a modern web app in the browser and as a high-performance native desktop application powered by **Electron**.

---

## 🚀 Running with Electron

### 1. Development Mode (with Live Reload)
To run the Electron desktop app in development mode with hot-reloading:
```bash
npm run electron:dev
```
*(or `npm run dev:electron`)*

This command automatically launches the Vite dev server and opens the native Electron desktop window once the server is ready.

### 2. Launch directly with a Yocto build directory (CLI Argument)
You can open any Yocto project directly from your terminal:
```bash
# In dev mode:
npx electron . /path/to/your/yocto/project

# Or after building/packaging:
./release/Yocto\ Layer\ Visualizer.AppImage /path/to/your/yocto/project
```

### 3. Standalone Production Launch (Local Build)
```bash
npm run build
npm run electron
```

---

## ⚡ Native Desktop Advantages

1. **Ultra-Fast Native Scanner (`electron/yoctoScannerNode.cjs`)**:
   - Performs parallel directory traversal directly via Node.js `fs.promises`, parsing complex Yocto environments in milliseconds without browser sandbox limits.
2. **Native OS Directory Dialog (`dialog.showOpenDialog`)**:
   - Opens local directories directly from the OS file picker, avoiding browser `showDirectoryPicker` compatibility or iframe security restrictions.
3. **Application Menu & Shortcuts**:
   - `Ctrl+O` / `Cmd+O`: Open Yocto Project Root Folder.
   - `Ctrl+R` / `Cmd+R`: Reload workspace.
   - `Ctrl+Shift+I` / `Cmd+Option+I`: Toggle developer tools.
4. **Native File Save Dialogs**:
   - Export standalone interactive HTML files and PNG graph renders directly to anywhere on your disk.
5. **Reveal in File Manager**:
   - Open layer repositories and recipe files directly in your OS file manager (Nautilus, Dolphin, Finder, Explorer).

---

## 📦 Packaging for Linux, Windows & macOS

You can package this visualizer into native distribution packages (AppImage, deb, dmg, exe) using `electron-builder`:

### Build Distribution Packages
- **Linux (AppImage & .deb for Ubuntu/Debian/Fedora):**
  ```bash
  npm run build
  npx electron-builder --linux
  ```
- **macOS (.dmg & zip):**
  ```bash
  npm run build
  npx electron-builder --mac
  ```
- **Windows (.exe installer):**
  ```bash
  npm run build
  npx electron-builder --win
  ```

All generated binaries and installers will be saved in the `release/` directory.
