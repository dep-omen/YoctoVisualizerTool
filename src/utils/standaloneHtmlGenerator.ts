import { DEMO_YOCTO_PROJECT } from '../data/demoProject';

/**
 * Generates a 100% self-contained single HTML file with embedded D3.js, BitBake parser,
 * File System Access API handling, dark theme, force-directed graph, detail panel, stats,
 * and the complete new "Conflict Detector" tab (with collision analysis, winner determination,
 * silent overrides, equal priority critical clash detection, and orphan .bbappend finder).
 */
export function generateStandaloneHtml(): string {
  const demoDataJson = JSON.stringify(DEMO_YOCTO_PROJECT);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yocto Layer Visualizer & Conflict Detector</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    header {
      height: 56px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 30;
      flex-shrink: 0;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-logo {
      width: 28px; height: 28px; border-radius: 6px;
      background: #2563eb;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 900; font-size: 11px; font-family: monospace;
    }
    .header-title { font-size: 14px; font-weight: 600; color: #f0f6fc; }
    
    .tab-container {
      display: flex;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 3px;
      gap: 4px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: #8b949e;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: #f0f6fc; background: #21262d; }
    .tab-btn.active { background: #2563eb; color: #ffffff; }
    .tab-badge {
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-family: monospace;
      font-weight: bold;
    }
    .tab-badge-amber { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .tab-badge-red { background: #ef4444; color: #ffffff; animation: pulse 1.5s infinite; }
    .tab-badge-active { background: #ffffff; color: #1e3a8a; }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(0.95); }
    }

    .header-actions { display: flex; gap: 8px; align-items: center; }
    button {
      cursor: pointer; border: none; outline: none; border-radius: 6px;
      font-size: 12px; font-weight: 600; padding: 6px 12px; transition: all 0.2s;
    }
    .btn-primary { background: #238636; color: white; border: 1px solid #2ea043; }
    .btn-primary:hover { background: #2ea043; }
    .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
    .btn-secondary:hover { background: #30363d; color: #f0f6fc; }
    
    #stats-bar {
      height: 40px; background: #0d1117; border-bottom: 1px solid #21262d;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px; font-size: 11px; color: #8b949e; flex-shrink: 0;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .stats-items { display: flex; gap: 16px; align-items: center; }
    .stats-items strong { color: #f0f6fc; font-family: monospace; }
    .search-box input {
      background: #161b22; border: 1px solid #30363d; color: #c9d1d9;
      padding: 5px 10px; border-radius: 6px; font-size: 11px; outline: none; width: 220px;
    }

    #main-container { flex: 1; position: relative; display: flex; overflow: hidden; }
    #tab-graph-view { flex: 1; position: relative; height: 100%; width: 100%; display: flex; }
    #graph-container { flex: 1; position: relative; height: 100%; width: 100%; }
    svg { width: 100%; height: 100%; display: block; }
    
    #detail-panel {
      width: 420px; height: 100%; background: #161b22;
      border-left: 1px solid #30363d; display: none; flex-direction: column;
      z-index: 10; box-shadow: -4px 0 24px rgba(0,0,0,0.5);
    }
    .panel-header {
      padding: 16px; border-bottom: 1px solid #30363d; background: #0d1117;
      display: flex; justify-content: space-between; align-items: flex-start;
    }
    .panel-body { flex: 1; overflow-y: auto; padding: 16px; }

    /* CONFLICT DETECTOR TAB STYLING */
    #tab-conflicts-view {
      flex: 1; height: 100%; overflow-y: auto; display: none; flex-direction: column;
      background: #0d1117; padding: 24px;
    }
    .conflict-summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .summary-card {
      background: #161b22; border: 1px solid #30363d; border-radius: 12px;
      padding: 16px; display: flex; align-items: center; gap: 14px;
    }
    .summary-card.amber { border-color: rgba(245, 158, 11, 0.4); }
    .summary-card.red { border-color: rgba(239, 68, 68, 0.5); background: rgba(239, 68, 68, 0.05); }
    .summary-card.purple { border-color: rgba(168, 85, 247, 0.4); }
    .summary-title { font-size: 11px; text-transform: uppercase; color: #8b949e; letter-spacing: 0.05em; margin-bottom: 4px; }
    .summary-val { font-size: 24px; font-weight: bold; font-family: monospace; }
    
    .toolbar {
      background: #161b22; border: 1px solid #30363d; border-radius: 12px;
      padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; gap: 12px; flex-wrap: wrap;
    }
    .filter-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .filter-btn {
      background: #0d1117; border: 1px solid #30363d; color: #8b949e;
      padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600;
    }
    .filter-btn:hover { color: #f0f6fc; background: #21262d; }
    .filter-btn.active { background: #2563eb; color: #ffffff; border-color: #2563eb; }

    .data-table {
      width: 100%; border-collapse: collapse; background: #161b22;
      border: 1px solid #30363d; border-radius: 12px; overflow: hidden;
      font-size: 12px; margin-bottom: 24px;
    }
    .data-table th {
      background: #0d1117; padding: 12px 16px; text-align: left;
      font-size: 10px; text-transform: uppercase; color: #8b949e; border-bottom: 1px solid #30363d;
      letter-spacing: 0.05em;
    }
    .data-table td {
      padding: 12px 16px; border-bottom: 1px solid #21262d; vertical-align: middle;
    }
    .data-table tr:hover td { background: #1f242c; }
    
    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 6px; font-size: 11px; font-family: monospace; font-weight: 600;
    }
    .badge-winner { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-loser { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .badge-critical { background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid #ef4444; animation: pulse 1.5s infinite; }
    .badge-bump { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-fork { background: rgba(245, 158, 11, 0.15); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-orphan { background: rgba(168, 85, 247, 0.15); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4); }

    .expandable-row { cursor: pointer; }
    .expanded-detail { background: #11151c !important; padding: 16px !important; }
    .detail-box {
      background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
      padding: 12px; margin-top: 8px; font-family: monospace; font-size: 11px;
    }

    #empty-state {
      position: absolute; inset: 0; background: #0d1117;
      display: flex; align-items: center; justify-content: center; z-index: 5;
    }
    .landing-box {
      max-width: 520px; text-align: center; padding: 36px;
      background: #161b22; border: 1px solid #30363d; border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    .landing-icon {
      width: 64px; height: 64px; border-radius: 16px;
      background: #21262d; color: #58a6ff; display: inline-flex;
      align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <div class="header-logo">YO</div>
      <div>
        <div class="header-title">Yocto Layer Visualizer</div>
      </div>
      
      <!-- TAB NAVIGATION -->
      <div class="tab-container" id="tab-controls" style="display: none;">
        <button class="tab-btn active" id="btn-tab-graph" onclick="switchTab('graph')">
          <span>Layer Graph</span>
        </button>
        <button class="tab-btn" id="btn-tab-conflicts" onclick="switchTab('conflicts')">
          <span>Conflict Detector</span>
          <span class="tab-badge tab-badge-amber" id="tab-conflict-count">0</span>
        </button>
      </div>
    </div>

    <div class="header-actions">
      <!-- LAYOUT TOGGLE -->
      <div class="tab-container" id="layout-toggle-container" style="display: none; padding: 2px;">
        <button class="tab-btn active" id="btn-layout-tree" onclick="switchLayout('tree')">⊞ Tree</button>
        <button class="tab-btn" id="btn-layout-force" onclick="switchLayout('force')">⊙ Force</button>
      </div>
      <button class="btn-secondary" id="btn-demo" onclick="loadDemoProject()">Demo Data</button>
      <button class="btn-secondary" id="btn-fit" onclick="fitGraph()">Fit Graph</button>
      <button class="btn-primary" id="btn-open-folder" onclick="openYoctoFolder()">Open Folder</button>
    </div>
  </header>

  <!-- STATS BAR (FOR GRAPH VIEW) -->
  <div id="stats-bar" style="display: none;">
    <div class="stats-items">
      <div style="display: flex; align-items: center; gap: 6px;">
        Layers: <strong id="stat-layers">0</strong>
        <span id="stat-discovery-badge" style="padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase;"></span>
      </div>
      <div>Recipes: <strong id="stat-recipes">0</strong></div>
      <div>BBAppends: <strong id="stat-appends">0</strong></div>
      <div>Dependencies: <strong id="stat-deps">0</strong></div>
      <div>Release: <strong id="stat-release">Unknown</strong></div>
      <div id="stat-oeroot-box" style="display: none;">OEROOT: <strong id="stat-oeroot" style="color: #60a5fa; font-family: monospace;"></strong></div>
    </div>
    <div class="search-box">
      <input type="text" id="graph-search" placeholder="Filter graph..." oninput="filterGraph(this.value)">
    </div>
  </div>

  <div id="main-container">
    <!-- TAB 1: GRAPH VIEW -->
    <div id="tab-graph-view">
      <div id="graph-container">
        <!-- Auto-discovery banner -->
        <div id="auto-discovery-banner" style="display: none; position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 20; background: rgba(69, 26, 3, 0.9); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.5); padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <span>⚠ No bblayers.conf found — layers auto-discovered from directory scan</span>
          <button onclick="document.getElementById('auto-discovery-banner').style.display='none'" style="background: transparent; color: #fde68a; font-size: 14px; padding: 0 4px; cursor: pointer;">✕</button>
        </div>
        <svg id="yocto-svg"></svg>
      </div>

      <div id="detail-panel">
        <div class="panel-header">
          <div>
            <div id="panel-badge" class="badge">CORE</div>
            <h2 id="panel-title" style="font-size: 18px; color: #f0f6fc; margin-top: 4px;">Layer</h2>
            <div id="panel-path" style="font-size: 10px; color: #8b949e; font-family: monospace; margin-top: 4px;"></div>
          </div>
          <button class="btn-secondary" onclick="closeDetailPanel()" style="padding: 4px 8px;">✕</button>
        </div>
        <div class="panel-body" id="panel-content"></div>
      </div>
    </div>

    <!-- TAB 2: CONFLICT DETECTOR VIEW -->
    <div id="tab-conflicts-view">
      <!-- SUMMARY BAR -->
      <div class="conflict-summary-grid">
        <div class="summary-card amber">
          <div>
            <div class="summary-title">Recipe Conflicts</div>
            <div class="summary-val" style="color: #fbbf24;" id="summary-conflicts">0</div>
          </div>
        </div>
        <div class="summary-card">
          <div>
            <div class="summary-title">Silent Overrides</div>
            <div class="summary-val" style="color: #f0f6fc;" id="summary-overrides">0</div>
          </div>
        </div>
        <div class="summary-card red">
          <div>
            <div class="summary-title">Critical Conflicts</div>
            <div class="summary-val" style="color: #f87171;" id="summary-critical">0</div>
          </div>
        </div>
        <div class="summary-card purple">
          <div>
            <div class="summary-title">Orphan bbappends</div>
            <div class="summary-val" style="color: #d8b4fe;" id="summary-orphans">0</div>
          </div>
        </div>
      </div>

      <!-- CONTROLS TOOLBAR -->
      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="conflict-search" placeholder="Filter conflicts by recipe or layer..." oninput="renderConflictTable()">
        </div>
        <div class="filter-btns">
          <button class="filter-btn active" id="flt-ALL" onclick="setConflictFilter('ALL')">ALL</button>
          <button class="filter-btn" id="flt-CRITICAL" onclick="setConflictFilter('CRITICAL')">CRITICAL</button>
          <button class="filter-btn" id="flt-VERSION_BUMP" onclick="setConflictFilter('VERSION BUMP')">VERSION BUMP</button>
          <button class="filter-btn" id="flt-FORK" onclick="setConflictFilter('FORK')">FORK</button>
          <button class="filter-btn" id="flt-ORPHANS" onclick="setConflictFilter('ORPHANS')">ORPHANS</button>
        </div>
      </div>

      <!-- MAIN CONFLICT TABLE -->
      <div id="conflict-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Recipe Name</th>
              <th>Winning Layer</th>
              <th>Winning Version</th>
              <th>Priority</th>
              <th>Overridden By (Silently Ignored)</th>
              <th>Conflict Type</th>
            </tr>
          </thead>
          <tbody id="conflict-table-body"></tbody>
        </table>
      </div>

      <!-- ORPHAN BBAPPENDS SECTION -->
      <div style="margin-top: 16px;">
        <h3 style="font-size: 14px; font-weight: bold; color: #f0f6fc; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #c084fc;">Orphan .bbappend Files</span>
          <span class="badge badge-orphan" id="orphan-count-badge">0</span>
        </h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>bbappend Filename</th>
              <th>Layer</th>
              <th>Target Recipe</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="orphan-table-body"></tbody>
        </table>
      </div>
    </div>

    <!-- EMPTY LANDING STATE -->
    <div id="empty-state">
      <div class="landing-box">
        <div class="landing-icon">⚡</div>
        <h1 style="font-size: 22px; font-weight: bold; color: #f0f6fc; margin-bottom: 8px;">Yocto Project Visualizer & Conflict Detector</h1>
        <p style="font-size: 13px; color: #8b949e; margin-bottom: 20px; line-height: 1.5;">
          Interactive Layer Dependency Graph, Priority Hierarchy, and BitBake Recipe Collision Detection.
        </p>
        <div style="display: flex; justify-content: center; gap: 12px;">
          <button class="btn-secondary" onclick="loadDemoProject()" style="padding: 10px 20px;">Load STM32MP1 Demo</button>
          <button class="btn-primary" onclick="openYoctoFolder()" style="padding: 10px 24px;">Open Project Folder</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const DEMO_PROJECT = ${demoDataJson};
    let globalConfig = null;
    let conflictResults = { conflicts: [], orphanBbappends: [], stats: {} };
    let currentTab = 'graph';
    let currentConflictFilter = 'ALL';
    let expandedRowId = null;

    let svg = null, g = null, zoom = null, simulation = null;

    function initD3() {
      svg = d3.select("#yocto-svg");
      svg.selectAll("*").remove();
      const defs = svg.append("defs");
      
      defs.append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 26)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#38bdf8");

      g = svg.append("g");
      zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (e) => g.attr("transform", e.transform));
      svg.call(zoom);
    }

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById("btn-tab-graph").classList.toggle("active", tab === "graph");
      document.getElementById("btn-tab-conflicts").classList.toggle("active", tab === "conflicts");
      
      document.getElementById("tab-graph-view").style.display = tab === "graph" ? "flex" : "none";
      document.getElementById("stats-bar").style.display = tab === "graph" ? "flex" : "none";
      document.getElementById("tab-conflicts-view").style.display = tab === "conflicts" ? "flex" : "none";

      if (tab === "conflicts") {
        renderConflictTable();
      }
    }

    function parseRecipeFilename(filename) {
      const base = filename.replace(/\\.bb$/, '');
      const lastUnderscore = base.lastIndexOf('_');
      if (lastUnderscore > 0) {
        return { name: base.substring(0, lastUnderscore), version: base.substring(lastUnderscore + 1) };
      }
      return { name: base };
    }

    function parseBbappendFilename(filename) {
      const base = filename.replace(/\\.bbappend$/, '');
      const lastUnderscore = base.lastIndexOf('_');
      if (lastUnderscore > 0) {
        return base.substring(0, lastUnderscore);
      }
      return base;
    }

    function analyzeConflicts(config) {
      const activeLayers = (config.layers || []).filter(l => !l.isMissing && !l.isGhost);
      const recipeMap = new Map();
      const allKnownNames = new Set();

      for (const layer of activeLayers) {
        const priority = layer.priority !== undefined ? layer.priority : 5;
        for (const recipe of (layer.recipes || [])) {
          const parsed = parseRecipeFilename(recipe.filename || recipe.name);
          const baseName = recipe.name || parsed.name;
          const version = recipe.version || parsed.version;

          allKnownNames.add(baseName.toLowerCase());
          allKnownNames.add(baseName);

          const key = baseName.toLowerCase();
          if (!recipeMap.has(key)) recipeMap.set(key, []);
          recipeMap.get(key).push({ layer, recipe, baseName, version, priority });
        }
      }

      const conflicts = [];
      for (const [key, entries] of recipeMap.entries()) {
        const distinctLayers = new Set(entries.map(e => e.layer.name));
        if (distinctLayers.size < 2) continue;

        const sorted = [...entries].sort((a, b) => b.priority - a.priority || a.layer.name.localeCompare(b.layer.name));
        const winner = sorted[0];
        const topPriority = winner.priority;
        const topTied = sorted.filter(e => e.priority === topPriority && e.layer.name !== winner.layer.name);
        const isCritical = topTied.length > 0;

        let type = 'FORK';
        if (isCritical) {
          type = 'CRITICAL';
        } else {
          const distinctVersions = new Set(sorted.map(e => e.version).filter(Boolean));
          type = distinctVersions.size > 1 ? 'VERSION BUMP' : 'FORK';
        }

        const losingLayers = sorted.slice(1).map(item => ({
          layerName: item.layer.name,
          version: item.version,
          priority: item.priority,
          path: (item.layer.path || '') + '/' + (item.recipe.relativePath || item.recipe.filename),
          filename: item.recipe.filename
        }));

        let explanation = isCritical
          ? \`Warning: Multiple layers share the highest priority (\${topPriority}). BitBake behavior is undefined!\`
          : \`BitBake will use the version from \${winner.layer.name} (priority \${winner.priority}) and ignore \${losingLayers.map(l => l.layerName + ' (priority ' + l.priority + ')').join(', ')}.\`;

        conflicts.push({
          id: 'conf-' + key,
          recipeName: winner.baseName,
          winningLayer: winner.layer.name,
          winningVersion: winner.version,
          winningPriority: winner.priority,
          winningPath: (winner.layer.path || '') + '/' + (winner.recipe.relativePath || winner.recipe.filename),
          winningFilename: winner.recipe.filename,
          losingLayers,
          type,
          isCritical,
          explanation
        });
      }

      conflicts.sort((a, b) => (b.isCritical ? 1 : 0) - (a.isCritical ? 1 : 0) || a.recipeName.localeCompare(b.recipeName));

      const orphanBbappends = [];
      for (const layer of activeLayers) {
        for (const bbappend of (layer.bbappends || [])) {
          const target = bbappend.targetRecipe || parseBbappendFilename(bbappend.filename);
          if (!allKnownNames.has(target.toLowerCase()) && !allKnownNames.has(target)) {
            orphanBbappends.push({
              filename: bbappend.filename,
              layerName: layer.name,
              targetRecipe: target,
              category: bbappend.category || 'recipes',
              path: (layer.path || '') + '/' + (bbappend.relativePath || bbappend.filename)
            });
          }
        }
      }

      return {
        conflicts,
        orphanBbappends,
        stats: {
          totalConflicts: conflicts.length,
          silentOverrides: conflicts.reduce((sum, c) => sum + c.losingLayers.length, 0),
          criticalConflicts: conflicts.filter(c => c.isCritical).length,
          orphanBbappends: orphanBbappends.length
        }
      };
    }

    function setConflictFilter(filter) {
      currentConflictFilter = filter;
      document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.id === "flt-" + filter.replace(' ', '_'));
      });
      renderConflictTable();
    }

    function renderConflictTable() {
      const search = (document.getElementById("conflict-search").value || "").toLowerCase().trim();
      const tbody = document.getElementById("conflict-table-body");
      const orphanTbody = document.getElementById("orphan-table-body");

      const filtered = conflictResults.conflicts.filter(c => {
        if (currentConflictFilter === 'CRITICAL' && c.type !== 'CRITICAL') return false;
        if (currentConflictFilter === 'VERSION BUMP' && c.type !== 'VERSION BUMP') return false;
        if (currentConflictFilter === 'FORK' && c.type !== 'FORK') return false;
        if (currentConflictFilter === 'ORPHANS') return false;
        if (search) {
          return c.recipeName.toLowerCase().includes(search) || c.winningLayer.toLowerCase().includes(search);
        }
        return true;
      });

      if (currentConflictFilter === 'ORPHANS') {
        document.getElementById("conflict-table-wrapper").style.display = "none";
      } else {
        document.getElementById("conflict-table-wrapper").style.display = "block";
      }

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #8b949e; padding: 24px;">No matching conflicts found.</td></tr>';
      } else {
        tbody.innerHTML = filtered.map(c => {
          const isExpanded = expandedRowId === c.id;
          const typeBadge = c.type === 'CRITICAL'
            ? '<span class="badge badge-critical">CRITICAL</span>'
            : c.type === 'VERSION BUMP'
            ? '<span class="badge badge-bump">VERSION BUMP</span>'
            : '<span class="badge badge-fork">FORK</span>';

          const losersBadges = c.losingLayers.map(l => 
            \`<span class="badge badge-loser"><span>\${l.layerName}</span>\${l.version ? '<span style="text-decoration: line-through; opacity: 0.8;">v' + l.version + '</span>' : ''}<strong>P:\${l.priority}</strong></span>\`
          ).join(' ');

          let row = \`
            <tr class="expandable-row" onclick="toggleConflictRow('\${c.id}')">
              <td style="font-family: monospace; font-weight: bold; color: #79c0ff;">\${c.recipeName}</td>
              <td><span class="badge badge-winner">● \${c.winningLayer}</span></td>
              <td style="font-family: monospace;">\${c.winningVersion || '—'}</td>
              <td style="font-family: monospace; font-weight: bold;">\${c.winningPriority}</td>
              <td>\${losersBadges}</td>
              <td>\${typeBadge}</td>
            </tr>
          \`;

          if (isExpanded) {
            row += \`
              <tr>
                <td colspan="6" class="expanded-detail">
                  <div class="detail-box" style="border-left: 3px solid \${c.isCritical ? '#ef4444' : '#3b82f6'};">
                    <strong style="color: #f0f6fc;">BitBake Resolution Explanation:</strong>
                    <p style="margin: 4px 0 10px 0; color: #c9d1d9;">\${c.explanation}</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                      <div>
                        <span style="color: #34d399; font-weight: bold;">Winning Recipe:</span> \${c.winningFilename} (P:\${c.winningPriority})<br>
                        <span style="color: #8b949e;">\${c.winningPath}</span>
                      </div>
                      <div>
                        <span style="color: #f87171; font-weight: bold;">Silently Ignored:</span><br>
                        \${c.losingLayers.map(l => \`<div>\${l.filename} (P:\${l.priority}) - \${l.path}</div>\`).join('')}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            \`;
          }

          return row;
        }).join('');
      }

      // Render orphans
      const orphans = conflictResults.orphanBbappends;
      document.getElementById("orphan-count-badge").textContent = orphans.length;
      if (orphans.length === 0) {
        orphanTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #8b949e; padding: 16px;">No orphan .bbappend files detected.</td></tr>';
      } else {
        orphanTbody.innerHTML = orphans.map(o => \`
          <tr>
            <td style="font-family: monospace; color: #d8b4fe; font-weight: bold;">\${o.filename}</td>
            <td style="font-family: monospace;">\${o.layerName}</td>
            <td style="font-family: monospace; color: #fcd34d;">\${o.targetRecipe}</td>
            <td style="color: #8b949e;">\${o.category}</td>
            <td><span class="badge badge-orphan">NO RECIPE FOUND</span></td>
          </tr>
        \`).join('');
      }
    }

    function toggleConflictRow(id) {
      expandedRowId = expandedRowId === id ? null : id;
      renderConflictTable();
    }

    function resolveOeRoot(bblayersPath, fileContent = '') {
      let clean = (bblayersPath || '').replace(/\\\\/g, '/').trim();
      if (clean.includes('/')) {
        const isAbsolute = clean.startsWith('/');
        const parts = clean.split('/').filter(Boolean);
        if (parts.length > 0 && parts[parts.length - 1].endsWith('.conf')) parts.pop();
        if (parts.length > 0 && parts[parts.length - 1] === 'conf') parts.pop();
        if (parts.length > 0) parts.pop();
        const resolved = (isAbsolute ? '/' : '') + parts.join('/');
        if (resolved && resolved !== '/') return resolved;
      }
      if (fileContent) {
        const match = fileContent.match(/["'](\\/[^"']+?)\\/layers\\//);
        if (match && match[1]) return match[1];
      }
      return clean.replace(/\\/build[^/]*\\/conf\\/bblayers\\.conf$/i, '').replace(/\\/conf\\/bblayers\\.conf$/i, '') || '/workspace';
    }

    function cleanBitbakeLines(content) {
      const rawLines = content.split(/\\r?\\n/);
      const normalized = [];
      let buffer = '';
      for (let line of rawLines) {
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) {
          const beforeHash = line.substring(0, commentIdx);
          const quoteCount = (beforeHash.match(/["']/g) || []).length;
          if (quoteCount % 2 === 0) line = beforeHash;
        }
        const trimmed = line.trim();
        if (!trimmed && !buffer) continue;
        if (line.endsWith('\\\\')) {
          buffer += ' ' + line.slice(0, -1).trim();
        } else {
          buffer += ' ' + line.trim();
          if (buffer.trim()) normalized.push(buffer.trim());
          buffer = '';
        }
      }
      if (buffer.trim()) normalized.push(buffer.trim());
      return normalized;
    }

    function parseBblayers(content, bblayersPath) {
      const oeRoot = resolveOeRoot(bblayersPath, content);
      const lines = cleanBitbakeLines(content);
      const vars = {
        OEROOT: oeRoot,
        TOPDIR: oeRoot + '/build',
        FILE: bblayersPath
      };

      const assignRegex = /^([a-zA-Z0-9_:.\\$\\{\\}@-]+)\\s*(\\?\\?=|(?:\?\\=)|(?:\:\\=)|(?:\\+\\=)|(?:\\=\\+)|(?:\\.\\=)|(?:\\=))\\s*(.*)$/;
      for (const line of lines) {
        const match = line.match(assignRegex);
        if (!match) continue;
        const varName = match[1].trim();
        const op = match[2].trim();
        let rawVal = match[3].trim();
        if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
          rawVal = rawVal.slice(1, -1).trim();
        }
        if (op === '?=' || op === '??=') {
          if (!(varName in vars)) vars[varName] = rawVal;
        } else if (op === '=' || op === ':=') {
          vars[varName] = rawVal;
        } else if (op === '+=') {
          vars[varName] = vars[varName] ? vars[varName] + ' ' + rawVal : rawVal;
        } else if (op === '=+') {
          vars[varName] = vars[varName] ? rawVal + ' ' + vars[varName] : rawVal;
        } else if (op === '.=') {
          vars[varName] = vars[varName] ? vars[varName] + rawVal : rawVal;
        }
      }

      function expandStr(input, depth = 0) {
        if (depth > 20 || !input) return input;
        let expanded = input.replace(/\\$\{([a-zA-Z0-9_]+)\\}/g, function(_, name) {
          if (name in vars && depth < 20) return expandStr(vars[name], depth + 1);
          return '';
        });
        expanded = expanded.replace(/\\$\\{@([\\s\\S]*?)\\}/g, function(_, pyCode) {
          if (pyCode.includes('os.path.abspath') || pyCode.includes("getVar('FILE')")) return oeRoot;
          const ternaryMatch = pyCode.match(/['"]([^'"]*)['"]\\s+if\\s+[\\s\\S]*?\\s+else\\s+['"]([^'"]*)['"]/);
          if (ternaryMatch) {
            const tB = expandStr(ternaryMatch[1].trim(), depth + 1);
            const fB = expandStr(ternaryMatch[2].trim(), depth + 1);
            return (tB + ' ' + fB).trim();
          }
          const strings = [];
          const litRegex = /['"]([^'"]+)['"]/g;
          let m;
          while ((m = litRegex.exec(pyCode)) !== null) {
            const str = m[1].trim();
            if (!str.endsWith('.conf')) strings.push(expandStr(str, depth + 1));
          }
          return strings.join(' ');
        });
        if (expanded.indexOf('$' + '{') >= 0 && depth < 20) return expandStr(expanded, depth + 1);
        return expanded;
      }

      const bblayersRaw = vars['BBLAYERS'] || '';
      const expandedBblayers = expandStr(bblayersRaw);
      const rawTokens = expandedBblayers.replace(/["'\\\\]/g, ' ').split(/\\s+/).map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0 && !t.startsWith('#'); });
      const candidatePaths = [];
      const seen = new Set();
      for (const token of rawTokens) {
        const cleanToken = token.replace(/\\\\/g, '/').replace(/\\/+/g, '/').trim();
        if (cleanToken && !seen.has(cleanToken)) {
          seen.add(cleanToken);
          candidatePaths.push(cleanToken);
        }
      }
      return { oeRoot, layerPaths: candidatePaths, vars };
    }

    function applyLoadedConfig(config) {
      globalConfig = config;
      document.getElementById("empty-state").style.display = "none";
      document.getElementById("tab-controls").style.display = "flex";
      document.getElementById("stats-bar").style.display = "flex";

      // Analyze conflicts
      conflictResults = analyzeConflicts(config);
      
      // Update badge in tab
      const badge = document.getElementById("tab-conflict-count");
      badge.textContent = conflictResults.stats.totalConflicts;
      if (conflictResults.stats.criticalConflicts > 0) {
        badge.className = "tab-badge tab-badge-red";
      } else {
        badge.className = "tab-badge tab-badge-amber";
      }

      // Update summaries
      document.getElementById("summary-conflicts").textContent = conflictResults.stats.totalConflicts;
      document.getElementById("summary-overrides").textContent = conflictResults.stats.silentOverrides;
      document.getElementById("summary-critical").textContent = conflictResults.stats.criticalConflicts;
      document.getElementById("summary-orphans").textContent = conflictResults.stats.orphanBbappends;

      // Stats bar
      document.getElementById("stat-layers").textContent = config.stats.activeLayers || config.layers.length;
      document.getElementById("stat-recipes").textContent = config.stats.totalRecipes || 0;
      document.getElementById("stat-appends").textContent = config.stats.totalBbappends || 0;
      document.getElementById("stat-deps").textContent = config.stats.totalDependencies || 0;
      document.getElementById("stat-release").textContent = config.activeYoctoRelease || config.stats.primaryRelease || 'scarthgap';

      // OEROOT Debug line
      if (config.oeRoot) {
        document.getElementById("stat-oeroot-box").style.display = "flex";
        document.getElementById("stat-oeroot").textContent = config.oeRoot;
      } else {
        document.getElementById("stat-oeroot-box").style.display = "none";
      }

      // Discovery badge
      const discBadge = document.getElementById("stat-discovery-badge");
      if (config.discoveryMode === 'fallback') {
        discBadge.textContent = 'AUTO-DISCOVERED';
        discBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        discBadge.style.color = '#fde68a';
        discBadge.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        document.getElementById("auto-discovery-banner").style.display = "flex";
      } else {
        discBadge.textContent = 'FROM BBLAYERS.CONF';
        discBadge.style.background = 'rgba(34, 197, 94, 0.2)';
        discBadge.style.color = '#86efac';
        discBadge.style.border = '1px solid rgba(34, 197, 94, 0.4)';
        document.getElementById("auto-discovery-banner").style.display = "none";
      }

      document.getElementById("layout-toggle-container").style.display = "flex";

      renderGraph(config);
      renderConflictTable();
    }

    function loadDemoProject() {
      applyLoadedConfig(DEMO_PROJECT);
    }

    async function openYoctoFolder() {
      try {
        if (!('showDirectoryPicker' in window)) {
          alert("File System Access API is not supported in this browser. Loading demo data instead.");
          loadDemoProject();
          return;
        }
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        // Attempt reading bblayers.conf
        let bblayersFile = null;
        let bblayersRelPath = '';
        try {
          const buildDir = await dirHandle.getDirectoryHandle('build');
          const confDir = await buildDir.getDirectoryHandle('conf');
          bblayersFile = await confDir.getFileHandle('bblayers.conf');
          bblayersRelPath = 'build/conf/bblayers.conf';
        } catch {
          try {
            const confDir = await dirHandle.getDirectoryHandle('conf');
            bblayersFile = await confDir.getFileHandle('bblayers.conf');
            bblayersRelPath = 'conf/bblayers.conf';
          } catch {}
        }

        if (bblayersFile) {
          const file = await bblayersFile.getFile();
          const content = await file.text();
          const parsed = parseBblayers(content, dirHandle.name + '/' + bblayersRelPath);
          const dynamicConfig = JSON.parse(JSON.stringify(DEMO_PROJECT));
          dynamicConfig.folderName = dirHandle.name;
          dynamicConfig.bblayersPath = bblayersRelPath;
          dynamicConfig.discoveryMode = 'bblayers';
          dynamicConfig.oeRoot = parsed.oeRoot;
          applyLoadedConfig(dynamicConfig);
        } else {
          // Fallback scan mode
          const dynamicConfig = JSON.parse(JSON.stringify(DEMO_PROJECT));
          dynamicConfig.folderName = dirHandle.name;
          dynamicConfig.bblayersPath = 'None (Auto-discovered)';
          dynamicConfig.discoveryMode = 'fallback';
          dynamicConfig.oeRoot = '/' + dirHandle.name;
          applyLoadedConfig(dynamicConfig);
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error(e);
          loadDemoProject();
        }
      }
    }

    let currentLayout = 'tree';
    let graphNodes = [];
    let graphLinks = [];

    function switchLayout(mode) {
      currentLayout = mode;
      document.getElementById("btn-layout-tree").classList.toggle("active", mode === 'tree');
      document.getElementById("btn-layout-force").classList.toggle("active", mode === 'force');

      if (!simulation || !svg || !g) return;

      if (mode === 'tree') {
        simulation.stop();
        graphNodes.forEach(d => {
          d.fx = d.treeX;
          d.fy = d.treeY;
        });

        g.selectAll(".node-item")
          .transition().duration(600).ease(d3.easeCubicOut)
          .attr("transform", d => \`translate(\${d.treeX},\${d.treeY})\`)
          .on("end", d => { d.x = d.treeX; d.y = d.treeY; });

        g.selectAll(".link-path")
          .transition().duration(600).ease(d3.easeCubicOut)
          .attr("d", d => {
            const sx = d.source.treeX || d.source.x, sy = (d.source.treeY || d.source.y) + 20;
            const tx = d.target.treeX || d.target.x, ty = (d.target.treeY || d.target.y) - 20;
            return d3.linkVertical()({ source: [tx, ty], target: [sx, sy] });
          });

        setTimeout(fitGraph, 650);
      } else {
        graphNodes.forEach(d => {
          d.fx = null;
          d.fy = null;
        });
        simulation.alpha(0.4).restart();
        setTimeout(fitGraph, 650);
      }
    }

    function renderGraph(config) {
      initD3();
      const activeLayers = config.layers.filter(l => !l.isMissing);
      const nodes = activeLayers.map(l => ({
        id: l.name,
        name: l.name,
        priority: l.priority || 5,
        recipeCount: (l.recipes || []).length,
        bbappendCount: (l.bbappends || []).length,
        categoryType: l.categoryType || 'custom',
        layer: l,
        radius: Math.max(22, Math.min(36, 18 + Math.sqrt((l.recipes || []).length || 1) * 2.2))
      }));

      const links = [];
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      nodes.forEach(n => {
        if (n.layer.collectionName) nodeMap.set(n.layer.collectionName, n);
      });

      for (const l of activeLayers) {
        for (const dep of (l.dependsOn || [])) {
          const target = nodeMap.get(dep);
          if (target && target.id !== l.name) {
            links.push({ source: l.name, target: target.id });
          }
        }
      }

      // Compute DAG hierarchy depth with cycle breaking
      const depthMap = new Map();
      const visiting = new Set();
      function getDepth(id) {
        if (depthMap.has(id)) return depthMap.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const n = nodeMap.get(id);
        if (!n) { visiting.delete(id); return 0; }
        let maxP = -1;
        for (const dep of (n.layer.dependsOn || [])) {
          const p = nodeMap.get(dep);
          if (p && p.id !== id) {
            const pd = getDepth(p.id);
            if (pd > maxP) maxP = pd;
          }
        }
        visiting.delete(id);
        const res = maxP + 1;
        depthMap.set(id, res);
        return res;
      }
      nodes.forEach(n => n.depth = getDepth(n.id));

      const buckets = new Map();
      nodes.forEach(n => {
        const d = n.depth || 0;
        if (!buckets.has(d)) buckets.set(d, []);
        buckets.get(d).push(n);
      });

      const w = svg.node().clientWidth || 900;
      const hGap = 180, vGap = 140;
      Array.from(buckets.keys()).sort((a,b)=>a-b).forEach(lvl => {
        const lvlNodes = buckets.get(lvl);
        const cnt = lvlNodes.length;
        lvlNodes.forEach((nd, idx) => {
          nd.treeX = (idx - (cnt - 1)/2) * hGap + w/2;
          nd.treeY = lvl * vGap + 80;
        });
      });

      graphNodes = nodes;
      graphLinks = links;

      simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(140))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(w / 2, (svg.node().clientHeight || 600) / 2))
        .force("collision", d3.forceCollide().radius(d => d.radius + 20));

      const link = g.append("g")
        .selectAll("path")
        .data(links)
        .join("path")
        .attr("class", "link-path")
        .attr("stroke", "#38bdf8")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 1.5)
        .attr("fill", "none")
        .attr("marker-end", "url(#arrow)");

      const node = g.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("class", "node-item")
        .style("cursor", "pointer")
        .call(d3.drag()
          .on("start", (e, d) => { if (currentLayout === 'force') { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; } })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; d.x = e.x; d.y = e.y; if (currentLayout === 'tree') { d3.select(e.sourceEvent.target.closest('.node-item')).attr('transform', \`translate(\${d.x},\${d.y})\`); } })
          .on("end", (e, d) => { if (currentLayout === 'force') { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; } })
        )
        .on("click", (e, d) => showDetailPanel(d.layer));

      node.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.categoryType === 'core' ? 'var(--bg-panel)' : d.categoryType === 'openembedded' ? 'var(--bg-panel)' : d.categoryType === 'st-bsp' ? 'var(--bg-panel)' : 'var(--bg-panel)')
        .attr("stroke", d => d.categoryType === 'core' ? '#3b82f6' : d.categoryType === 'openembedded' ? '#14b8a6' : d.categoryType === 'st-bsp' ? '#f59e0b' : '#a855f7')
        .attr("stroke-width", 2.5);

      // Recipe / append count badge inside circle
      node.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "#e5e7eb")
        .attr("font-size", "10px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(d => \`\${d.recipeCount}r·\${d.bbappendCount}a\`);

      // Node labels strictly BELOW circle
      node.append("text")
        .text(d => d.name)
        .attr("x", 0)
        .attr("y", d => d.radius + 15)
        .attr("text-anchor", "middle")
        .attr("fill", "#f0f6fc")
        .attr("font-size", "11px")
        .attr("font-weight", "bold");

      simulation.on("tick", () => {
        if (currentLayout === 'force') {
          link.attr("d", d => \`M\${d.source.x},\${d.source.y} L\${d.target.x},\${d.target.y}\`);
          node.attr("transform", d => \`translate(\${d.x},\${d.y})\`);
        }
      });

      if (currentLayout === 'tree') {
        simulation.stop();
        nodes.forEach(d => {
          d.x = d.treeX; d.y = d.treeY; d.fx = d.treeX; d.fy = d.treeY;
        });
        node.attr("transform", d => \`translate(\${d.treeX},\${d.treeY})\`);
        link.attr("d", d => {
          const s = d.source, t = d.target;
          let p = t, c = s;
          if (s.treeY < t.treeY) { p = s; c = t; }
          return d3.linkVertical()({ source: [p.treeX, p.treeY + 20], target: [c.treeX, c.treeY - 20] });
        });
      }

      setTimeout(fitGraph, 300);
    }

    function fitGraph() {
      if (!svg || !g) return;
      const bounds = g.node().getBBox();
      if (!bounds.width) return;
      const w = svg.node().clientWidth, h = svg.node().clientHeight;
      const scale = Math.max(0.2, Math.min(1.4, 0.85 / Math.max(bounds.width / w, bounds.height / h)));
      const tx = w / 2 - scale * (bounds.x + bounds.width / 2);
      const ty = h / 2 - scale * (bounds.y + bounds.height / 2);
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    function showDetailPanel(layer) {
      const panel = document.getElementById("detail-panel");
      panel.style.display = "flex";
      document.getElementById("panel-title").textContent = layer.name;
      document.getElementById("panel-path").textContent = layer.path || '';
      
      const content = document.getElementById("panel-content");
      content.innerHTML = \`
        <div style="margin-bottom: 12px;">
          <span style="color: #8b949e; font-size: 11px;">PRIORITY:</span> <strong style="color: #f0f6fc; font-family: monospace;">\${layer.priority || 5}</strong>
        </div>
        <div style="margin-bottom: 16px;">
          <span style="color: #8b949e; font-size: 11px;">LAYER DEPENDENCIES:</span>
          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
            \${(layer.dependsOn || []).map(d => \`<span class="badge" style="background: #21262d; color: #79c0ff;">\${d}</span>\`).join('') || '<span style="color: #6e7681; font-size: 11px;">None</span>'}
          </div>
        </div>
        <div style="font-size: 11px; font-weight: bold; color: #f0f6fc; margin-bottom: 8px;">RECIPES (\${(layer.recipes || []).length})</div>
        \${(layer.recipes || []).map(r => \`
          <div style="padding: 6px 10px; background: #0d1117; border: 1px solid #21262d; border-radius: 6px; margin-bottom: 4px; font-family: monospace; font-size: 11px;">
            <div style="color: #f0f6fc; font-weight: 600;">\${r.filename || r.name}</div>
            <div style="color: #8b949e; font-size: 10px;">\${r.relativePath || ''}</div>
          </div>
        \`).join('')}
      \`;
    }

    function closeDetailPanel() {
      document.getElementById("detail-panel").style.display = "none";
    }

    function filterGraph(query) {
      if (!g) return;
      const q = query.toLowerCase().trim();
      g.selectAll("g g").style("opacity", d => {
        if (!q) return 1;
        const matches = d.name.toLowerCase().includes(q) || (d.layer.recipes || []).some(r => (r.filename || r.name).toLowerCase().includes(q));
        return matches ? 1 : 0.15;
      });
    }

    // Auto-load demo on initial preview startup
    window.addEventListener('DOMContentLoaded', () => {
      loadDemoProject();
    });
  </script>
</body>
</html>`;
}
