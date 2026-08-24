# Yocto Layer Visualizer

An interactive developer tool and visualizer for Yocto Project and OpenEmbedded build environments. Inspect layer dependency topologies, detect recipe version bumps & forks, identify orphaned `.bbappend` files, simulate package dependencies, and analyze build estimates.

Runs directly in modern browsers via the **File System Access API** and as a native desktop application using **Electron**.

---

## ✨ Features

- **Interactive Layer Dependency Graph**:
  - D3.js force-directed topology map rendering layer priorities, dynamic links, and dependencies (`LAYERDEPENDS`, `LAYERRECOMMENDS`).
  - Interactive search, focus highlighting, category coloring (Core, OpenEmbedded, BSP, Custom), and dependency depth inspection.
- **Recipe & bbappend Conflict Detection**:
  - Automatically identifies overlapping recipes across layers.
  - Highlights version bumps, forks, priority overrides, and shadowed recipes.
  - Detects orphaned `.bbappend` files (appends targeting recipes not present in the active layer stack).
- **Deep `.bbappend` Stack Inspector**:
  - Step-by-step layer append order preview showing exact file paths and line-by-line BitBake syntax highlighting.
- **Package Dependency Tracer (`RDEPENDS` / `DEPENDS`)**:
  - Interactive dependency tree visualization for build-time (`DEPENDS`) and runtime (`RDEPENDS`) packages.
- **Build Time & Resource Estimator**:
  - Estimates build duration, disk usage, package counts, and recommended `BB_NUMBER_THREADS` / `PARALLEL_MAKE` settings based on active layers and target architectures.
- **Privacy & Security**:
  - 100% client-side parsing. Your source code, layers, and configuration files never leave your workstation.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd yocto-layer-visualizer

# Install dependencies
npm install
```

### Run Web Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### Run Desktop App (Electron)
```bash
npm run electron:dev
```

---

## 🖥️ Usage

1. **Open a Project**:
   - Click **"Open Folder"** and select your Yocto project root directory (the directory containing `build/conf/bblayers.conf` or layer repositories like `poky`, `meta-openembedded`, etc.).
   - Alternatively, click **"Explore Sample STM32MP1 Demo"** to explore a pre-loaded reference stack with sample conflicts, dependencies, and recipes.
2. **Navigate Views**:
   - **Layer Graph**: Explore layer hierarchy, drag nodes, inspect priorities, and see direct vs. indirect dependencies.
   - **Recipe Conflicts**: View all duplicate recipes, version overrides, and orphan `.bbappend` files with one-click path copying.
   - **bbappend Viewer**: View chained appends across layers with diff previews.
   - **Package Tracer**: Inspect package runtime and build-time dependency trees.
   - **Build Estimator**: Estimate compilation times and resource footprints.

---

## 📦 Desktop Packaging (Electron)

To package the application into standalone executables for your operating system:

```bash
# Build web assets first
npm run build

# Package for Linux (AppImage and .deb)
npx electron-builder --linux

# Package for macOS (.dmg and .zip)
npx electron-builder --mac

# Package for Windows (.exe installer)
npx electron-builder --win
```
Packaged binaries will be generated in the `release/` directory.

---

## 🛠️ Technology Stack

- **Framework**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Visualizations**: D3.js (`d3-force`, `d3-selection`, `d3-zoom`, `d3-hierarchy`)
- **Icons**: Lucide React
- **Desktop Runtime**: Electron
- **Parser**: Custom client-side parser for BitBake configuration files (`bblayers.conf`, `layer.conf`, `.bb`, `.bbappend`)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
