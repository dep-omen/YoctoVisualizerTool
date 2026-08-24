# Yocto Layer Visualizer

A browser-based tool for visualizing Yocto Project layer 
dependencies, recipe conflicts, and package dependency chains.
No backend, no build step — open the HTML file in Chrome or Edge.

## Features
- Layer dependency graph from real bblayers.conf parsing
- Conflict detector — finds BBFILE_PRIORITY clashes across layers
- Package tracer — traces DEPENDS/RDEPENDS chains visually
- Supports real ST OpenSTLinux, Raspberry Pi, and vanilla Poky stacks
- Handles BitBake variable expansion (${OEROOT}, compound operators)
- Auto-discovers layers without bblayers.conf

## Usage
1. Open YoctoVisualizer.html in Chrome or Edge
2. Click "Open Folder" and select your Yocto project root
3. The tool parses bblayers.conf and all layer.conf files automatically

## Tested with
- OpenSTLinux scarthgap (STM32MP157)
- meta-raspberrypi
- vanilla openembedded-core
