# Yocto Layer Visualizer — Desktop (Electron) Guide

This application runs as a modern web app in the browser and as a high-performance native desktop application powered by **Electron**.

---

## 🛠️ Root Cause & Fix for the Blank Screen

In Chromium/Electron, loading compiled Vite ES module bundles (`<script type="module" crossorigin ...>`) directly via `file://` causes a silent CORS rejection by Chromium's security sandbox.

### The Solution:
`electron/main.cjs` has been updated with an **embedded zero-dependency static server** that:
1. Automatically checks if the live dev server (`http://localhost:3000`) is running.
2. If running, connects immediately to Vite with live reload (`npm run electron:dev`).
3. If not running (standalone production mode), automatically starts an internal loopback server serving `dist/` over HTTP with zero CORS or protocol restrictions.

---

## 🚀 Running with Electron

### Option A: Development Mode (with Live Reload)
Runs the Vite dev server and starts Electron with hot-reloading:
```bash
npm run electron:dev
```
*(or `npm run dev:electron`)*

---

### Option B: Standalone Production Mode
Builds the latest assets and launches the standalone desktop app:
```bash
npm run build
npm run electron
```

---

### Option C: Launch Directly with a Yocto Build Directory (CLI Argument)
Open any Yocto project directory directly on launch:
```bash
# In Dev Mode:
npm run electron:dev -- /path/to/your/yocto/build

# In Standalone Mode:
npx electron . /path/to/your/yocto/build
```

---

## ⚡ Native Desktop Capabilities

1. **Native OS Directory Dialog (`dialog.showOpenDialog`)**:
   - Direct access to any local or network filesystem path without browser sandbox restrictions.
2. **High-Speed Native Scanner (`electron/yoctoScannerNode.cjs`)**:
   - Traverses thousands of recipes and `.bbappend` files natively via Node.js in milliseconds.
3. **OS File Save Dialogs**:
   - Export SVG/PNG graphs and standalone interactive HTML bundles to any directory.
4. **Reveal in File Manager**:
   - Click the folder icon in the Layer Details panel to open layer repositories in your system file manager (Nautilus, Dolphin, Finder, Windows Explorer).
5. **Keyboard Shortcuts**:
   - `Ctrl+O` / `Cmd+O`: Open Yocto Project Folder
   - `Ctrl+D` / `Cmd+D`: Load Sample STM32MP1 Demo
   - `Ctrl+Shift+I` / `Cmd+Option+I`: Toggle Developer Tools
   - `Ctrl+R` / `Cmd+R`: Reload workspace
