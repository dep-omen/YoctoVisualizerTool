const fs = require('fs');
const path = require('path');

/**
 * Determine layer category type based on its path and collection name
 */
function determineLayerCategory(nameOrPath, collection) {
  const lower = (nameOrPath + ' ' + (collection || '')).toLowerCase();
  
  if (lower.includes('meta-st') || lower.includes('openstlinux') || lower.includes('st-openstlinux')) {
    return 'st-bsp';
  }
  
  if (
    lower.includes('meta-python') ||
    lower.includes('meta-networking') ||
    lower.includes('meta-multimedia') ||
    lower.includes('meta-filesystems') ||
    lower.includes('meta-gnome') ||
    lower.includes('meta-perl') ||
    lower.includes('meta-webserver') ||
    lower.includes('meta-initramfs')
  ) {
    return 'oe-sublayer';
  }

  if (lower.includes('meta-oe') || lower.includes('openembedded') || collection === 'openembedded-layer') {
    return 'openembedded';
  }

  if (
    nameOrPath === 'meta' ||
    nameOrPath.endsWith('/meta') ||
    lower.includes('meta-poky') ||
    lower.includes('meta-yocto') ||
    collection === 'core'
  ) {
    return 'core';
  }

  if (
    lower.includes('meta-arm') ||
    lower.includes('meta-ti') ||
    lower.includes('meta-freescale') ||
    lower.includes('meta-xilinx') ||
    lower.includes('meta-intel') ||
    lower.includes('meta-raspberrypi') ||
    lower.includes('meta-bsp')
  ) {
    return 'bsp';
  }

  return 'custom';
}

function cleanBitbakeText(content) {
  const rawLines = content.split(/\r?\n/);
  const normalized = [];
  let buffer = '';

  for (let line of rawLines) {
    const commentIdx = line.indexOf('#');
    if (commentIdx >= 0) {
      const beforeHash = line.substring(0, commentIdx);
      const quoteCount = (beforeHash.match(/["']/g) || []).length;
      if (quoteCount % 2 === 0) {
        line = beforeHash;
      }
    }

    const trimmed = line.trim();
    if (!trimmed && !buffer) continue;

    if (line.endsWith('\\')) {
      buffer += ' ' + line.slice(0, -1).trim();
    } else {
      buffer += ' ' + line.trim();
      if (buffer.trim()) {
        normalized.push(buffer.trim());
      }
      buffer = '';
    }
  }

  if (buffer.trim()) {
    normalized.push(buffer.trim());
  }

  return normalized;
}

function resolveOeRoot(bblayersPath, fileContent = '') {
  const clean = bblayersPath.replace(/\\/g, '/').trim();

  if (clean.includes('/')) {
    const isAbsolute = clean.startsWith('/');
    const parts = clean.split('/').filter(Boolean);

    if (parts.length > 0 && parts[parts.length - 1].endsWith('.conf')) {
      parts.pop();
    }
    if (parts.length > 0 && parts[parts.length - 1] === 'conf') {
      parts.pop();
    }
    if (parts.length > 0) {
      parts.pop();
    }

    const resolved = (isAbsolute ? '/' : '') + parts.join('/');
    if (resolved && resolved !== '/') {
      return resolved;
    }
  }

  if (fileContent) {
    const match = fileContent.match(/["'](\/[^"']+?)\/layers\//);
    if (match && match[1]) {
      return match[1];
    }
  }

  return clean
    .replace(/\/build[^/]*\/conf\/bblayers\.conf$/i, '')
    .replace(/\/conf\/bblayers\.conf$/i, '') || '/workspace';
}

function parseBblayersConf(content, bblayersPath) {
  const oeRoot = resolveOeRoot(bblayersPath, content);
  const lines = cleanBitbakeText(content);

  const variables = {
    OEROOT: oeRoot,
    TOPDIR: path.dirname(bblayersPath),
    FILE: bblayersPath
  };

  let bblayersRawList = [];

  for (const line of lines) {
    const assignMatch = line.match(/^([A-Za-z0-9_$.-]+)\s*(=|\?=|\?\?=|:=|\+=|=\+|\.=)\s*["']?([\s\S]*?)["']?$/);
    if (!assignMatch) continue;

    const [, varName, op, rawVal] = assignMatch;
    const cleanVal = rawVal.replace(/^["']|["']$/g, '').trim();

    if (varName === 'BBLAYERS' || varName.startsWith('BBLAYERS')) {
      const parts = cleanVal.split(/\s+/).filter(Boolean);
      if (op === '=+') {
        bblayersRawList = [...parts, ...bblayersRawList];
      } else {
        bblayersRawList.push(...parts);
      }
    } else {
      variables[varName] = cleanVal;
    }
  }

  function expandVariables(raw) {
    let result = raw;
    for (let i = 0; i < 5; i++) {
      let replaced = false;
      result = result.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => {
        if (variables[key] !== undefined) {
          replaced = true;
          return variables[key];
        }
        return `\${${key}}`;
      });
      if (!replaced) break;
    }

    // Handle python expressions like ${@'${OEROOT}/layers/meta-foo' if ...}
    if (result.includes('${@')) {
      const matches = result.matchAll(/["']([^"']*?\/layers\/[^"']*?)["']/g);
      const extracted = [];
      for (const m of matches) {
        extracted.push(m[1].replace(/\$\{OEROOT\}/g, oeRoot));
      }
      if (extracted.length > 0) {
        return extracted.join(' ');
      }
    }

    return result.replace(/\$\{OEROOT\}/g, oeRoot);
  }

  const finalLayers = [];
  for (const item of bblayersRawList) {
    const expanded = expandVariables(item);
    const subParts = expanded.split(/\s+/).filter(Boolean);
    for (const sub of subParts) {
      if (sub && !sub.startsWith('${@') && !finalLayers.includes(sub)) {
        finalLayers.push(sub);
      }
    }
  }

  return {
    oeRoot,
    layerPaths: finalLayers,
    variables
  };
}

function parseLayerConf(content, fallbackName) {
  const lines = cleanBitbakeText(content);
  const collections = [];
  const dependsOn = [];
  const dynamicDepends = [];
  const recommends = [];
  let priority = undefined;
  const seriesCompat = [];

  for (const line of lines) {
    // BBFILE_COLLECTIONS
    const colMatch = line.match(/^BBFILE_COLLECTIONS\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (colMatch) {
      const parts = colMatch[2].split(/\s+/).filter(Boolean);
      for (const p of parts) {
        if (!collections.includes(p)) collections.push(p);
      }
    }

    // BBFILE_PRIORITY
    const prioMatch = line.match(/^BBFILE_PRIORITY_([A-Za-z0-9_-]+)\s*=\s*["']?([0-9]+)["']?/);
    if (prioMatch) {
      priority = parseInt(prioMatch[2], 10);
    }

    // LAYERDEPENDS
    const depMatch = line.match(/^LAYERDEPENDS_([A-Za-z0-9_-]+)\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (depMatch) {
      const parts = depMatch[3].split(/\s+/).filter(Boolean);
      for (let p of parts) {
        // Strip optional version constraint e.g. "core:1" or "openembedded-layer:2"
        p = p.split(':')[0].trim();
        if (p && !dependsOn.includes(p)) dependsOn.push(p);
      }
    }

    // LAYERRECOMMENDS
    const recMatch = line.match(/^LAYERRECOMMENDS_([A-Za-z0-9_-]+)\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (recMatch) {
      const parts = recMatch[3].split(/\s+/).filter(Boolean);
      for (let p of parts) {
        p = p.split(':')[0].trim();
        if (p && !recommends.includes(p)) recommends.push(p);
      }
    }

    // LAYERSERIES_COMPAT
    const compatMatch = line.match(/^LAYERSERIES_COMPAT_([A-Za-z0-9_-]+)\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (compatMatch) {
      const parts = compatMatch[3].split(/\s+/).filter(Boolean);
      for (const p of parts) {
        if (p && !seriesCompat.includes(p)) seriesCompat.push(p);
      }
    }

    // BBFILES_DYNAMIC
    const dynMatch = line.match(/^BBFILES_DYNAMIC\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (dynMatch) {
      const parts = dynMatch[2].split(/\s+/).filter(Boolean);
      for (let p of parts) {
        const trigger = p.split(':')[0].trim();
        if (trigger && !dynamicDepends.includes(trigger)) {
          dynamicDepends.push(trigger);
        }
      }
    }
  }

  return {
    collectionName: collections[0] || fallbackName,
    collections: collections.length > 0 ? collections : [fallbackName],
    dependsOn,
    dynamicDepends,
    recommends,
    priority,
    seriesCompat,
    raw: content
  };
}

function parseLocalConf(content) {
  const lines = cleanBitbakeText(content);
  const result = {
    machine: undefined,
    distro: undefined,
    imageInstall: [],
    distroFeatures: [],
    imageFeatures: [],
    packageClasses: [],
    parallelMake: undefined,
    bbNumberThreads: undefined
  };

  for (const line of lines) {
    const mMatch = line.match(/^MACHINE\s*(\?\?=|\?=|:=|=)\s*["']?([^"'\s]+)["']?/);
    if (mMatch && !result.machine) result.machine = mMatch[2];

    const dMatch = line.match(/^DISTRO\s*(\?\?=|\?=|:=|=)\s*["']?([^"'\s]+)["']?/);
    if (dMatch && !result.distro) result.distro = dMatch[2];

    const pmMatch = line.match(/^PARALLEL_MAKE\s*(\?\?=|\?=|:=|=)\s*["']?([^"']+)["']?/);
    if (pmMatch) result.parallelMake = pmMatch[2];

    const bbMatch = line.match(/^BB_NUMBER_THREADS\s*(\?\?=|\?=|:=|=)\s*["']?([^"']+)["']?/);
    if (bbMatch) result.bbNumberThreads = bbMatch[2];

    const imgInstMatch = line.match(/^IMAGE_INSTALL(_append)?\s*(\+?=|=|\+=)\s*["']?([^"']+)["']?/);
    if (imgInstMatch) {
      result.imageInstall.push(...imgInstMatch[3].split(/\s+/).filter(Boolean));
    }
  }

  return result;
}

function parseRecipeFilename(filename) {
  const base = filename.replace(/\.bb$/, '');
  const lastUnderscore = base.lastIndexOf('_');
  if (lastUnderscore > 0) {
    return {
      name: base.slice(0, lastUnderscore),
      version: base.slice(lastUnderscore + 1)
    };
  }
  return { name: base, version: 'git' };
}

function parseBbappendFilename(filename) {
  const base = filename.replace(/\.bbappend$/, '');
  const lastUnderscore = base.lastIndexOf('_');
  if (lastUnderscore > 0) {
    return base.slice(0, lastUnderscore);
  }
  return base.replace(/%$/, '');
}

/**
 * High speed recursive file search helper in Node.js
 */
async function findFileRecursive(dir, targetName, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === targetName) {
        return path.join(dir, entry.name);
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (['tmp', 'downloads', 'sstate-cache', 'cache', '.git', 'node_modules'].includes(entry.name)) {
          continue;
        }
        const found = await findFileRecursive(path.join(dir, entry.name), targetName, maxDepth, currentDepth + 1);
        if (found) return found;
      }
    }
  } catch (err) {
    // skip unreadable
  }
  return null;
}

async function findAllFilesRecursive(dir, targetName, maxDepth = 5, currentDepth = 0) {
  const results = [];
  if (currentDepth > maxDepth) return results;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name === targetName) {
        results.push(path.join(dir, entry.name));
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (['tmp', 'downloads', 'sstate-cache', 'cache', '.git', 'node_modules'].includes(entry.name)) {
          continue;
        }
        const sub = await findAllFilesRecursive(path.join(dir, entry.name), targetName, maxDepth, currentDepth + 1);
        results.push(...sub);
      }
    }
  } catch (err) {
    // skip unreadable
  }
  return results;
}

/**
 * Scan recipes and bbappends in a layer folder natively
 */
async function scanLayerContentNative(layerDir) {
  let layerConfContent = undefined;
  const recipes = [];
  const bbappends = [];
  const categoriesSet = new Set();

  const layerConfPath = path.join(layerDir, 'conf', 'layer.conf');
  if (fs.existsSync(layerConfPath)) {
    try {
      layerConfContent = await fs.promises.readFile(layerConfPath, 'utf-8');
    } catch (e) {}
  }

  async function walk(dir, relPath = '', depth = 0) {
    if (depth > 6) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullChild = path.join(dir, entry.name);
        const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;

        if (entry.isFile()) {
          if (entry.name.endsWith('.bb')) {
            const { name: rName, version } = parseRecipeFilename(entry.name);
            const pathParts = relPath.split(/[\\/]/);
            const catPart = pathParts.find(p => p.startsWith('recipes-')) || 'recipes';
            categoriesSet.add(catPart);

            recipes.push({
              name: rName,
              filename: entry.name,
              version,
              category: catPart,
              relativePath: childRel
            });
          } else if (entry.name.endsWith('.bbappend')) {
            const target = parseBbappendFilename(entry.name);
            const pathParts = relPath.split(/[\\/]/);
            const catPart = pathParts.find(p => p.startsWith('recipes-')) || 'recipes';
            categoriesSet.add(catPart);

            bbappends.push({
              filename: entry.name,
              targetRecipe: target,
              category: catPart,
              relativePath: childRel
            });
          }
        } else if (entry.isDirectory()) {
          if (['files', 'patches', '.git', 'test', 'tests'].includes(entry.name) && depth > 2) {
            continue;
          }
          await walk(fullChild, childRel, depth + 1);
        }
      }
    } catch (e) {}
  }

  await walk(layerDir);

  return {
    layerConfContent,
    recipes,
    bbappends,
    recipeCategories: Array.from(categoriesSet).sort()
  };
}

/**
 * Main Native Yocto Project Scanner for Electron
 */
async function scanYoctoProjectNative(rootPath, onProgress) {
  onProgress?.({
    phase: 'finding_conf',
    message: 'Searching for build/conf/bblayers.conf and local.conf...'
  });

  const folderName = path.basename(rootPath);

  // 1. Locate bblayers.conf
  let bblayersPath = path.join(rootPath, 'build', 'conf', 'bblayers.conf');
  if (!fs.existsSync(bblayersPath)) {
    bblayersPath = path.join(rootPath, 'conf', 'bblayers.conf');
  }
  if (!fs.existsSync(bblayersPath)) {
    bblayersPath = await findFileRecursive(rootPath, 'bblayers.conf', 3);
  }

  const isFallbackMode = !bblayersPath || !fs.existsSync(bblayersPath);
  const discoveryMode = isFallbackMode ? 'fallback' : 'bblayers';

  let oeRoot = rootPath;
  let rawLayerPaths = [];

  if (!isFallbackMode) {
    const bblayersContent = await fs.promises.readFile(bblayersPath, 'utf-8');
    const parsedBblayers = parseBblayersConf(bblayersContent, bblayersPath);
    oeRoot = parsedBblayers.oeRoot;
    rawLayerPaths = parsedBblayers.layerPaths;
  }

  // 2. Locate local.conf
  let localConfPath = path.join(rootPath, 'build', 'conf', 'local.conf');
  if (!fs.existsSync(localConfPath)) {
    localConfPath = path.join(rootPath, 'conf', 'local.conf');
  }
  if (!fs.existsSync(localConfPath)) {
    localConfPath = await findFileRecursive(rootPath, 'local.conf', 3);
  }

  let localConfig = {};
  if (localConfPath && fs.existsSync(localConfPath) && !isFallbackMode) {
    try {
      const localContent = await fs.promises.readFile(localConfPath, 'utf-8');
      localConfig = parseLocalConf(localContent);
    } catch (e) {}
  }

  const parsedLayers = [];
  const collectionToLayerMap = new Map();

  if (!isFallbackMode) {
    onProgress?.({
      phase: 'parsing_layers',
      message: `Discovered ${rawLayerPaths.length} layer candidate(s) in BBLAYERS. Verifying layer content...`,
      total: rawLayerPaths.length
    });

    let processedCount = 0;
    for (const rawPath of rawLayerPaths) {
      processedCount++;
      const fallbackName = path.basename(rawPath) || 'layer';

      onProgress?.({
        phase: 'scanning_recipes',
        message: `Scanning ${fallbackName} (${processedCount}/${rawLayerPaths.length})...`,
        processed: processedCount,
        total: rawLayerPaths.length
      });

      // Try multiple resolution paths
      let resolvedDir = rawPath;
      if (!fs.existsSync(resolvedDir)) {
        resolvedDir = path.resolve(rootPath, rawPath);
      }
      if (!fs.existsSync(resolvedDir) && oeRoot) {
        resolvedDir = path.resolve(oeRoot, rawPath.replace(/^\$\{OEROOT\}\/?/, ''));
      }
      if (!fs.existsSync(resolvedDir)) {
        // Search inside rootPath for matching directory name
        const matchFound = await findFileRecursive(rootPath, 'layer.conf', 4);
        if (matchFound) {
          resolvedDir = path.dirname(path.dirname(matchFound));
        }
      }

      if (!fs.existsSync(resolvedDir)) {
        const missingLayer = {
          id: fallbackName,
          collectionName: fallbackName,
          name: fallbackName,
          path: rawPath,
          seriesCompat: [],
          dependsOn: [],
          recipes: [],
          bbappends: [],
          recipeCategories: [],
          categoryType: 'missing',
          isMissing: true,
          isGhost: false,
          layerConfFound: false
        };
        parsedLayers.push(missingLayer);
        collectionToLayerMap.set(fallbackName, missingLayer);
        continue;
      }

      const layerContent = await scanLayerContentNative(resolvedDir);
      let layerConfData = {
        collectionName: fallbackName,
        collections: [fallbackName],
        dependsOn: [],
        dynamicDepends: [],
        recommends: [],
        priority: undefined,
        seriesCompat: [],
        raw: ''
      };

      if (layerContent.layerConfContent) {
        layerConfData = parseLayerConf(layerContent.layerConfContent, fallbackName);
      }

      const canonicalName = layerConfData.collectionName || fallbackName;
      const catType = determineLayerCategory(fallbackName, canonicalName);

      const layerObj = {
        id: canonicalName,
        collectionName: canonicalName,
        collections: layerConfData.collections,
        name: canonicalName,
        path: rawPath,
        absolutePath: path.relative(rootPath, resolvedDir) || resolvedDir,
        priority: layerConfData.priority,
        seriesCompat: layerConfData.seriesCompat,
        dependsOn: layerConfData.dependsOn,
        dynamicDepends: layerConfData.dynamicDepends,
        recommends: layerConfData.recommends,
        recipes: layerContent.recipes,
        bbappends: layerContent.bbappends,
        recipeCategories: layerContent.recipeCategories,
        categoryType: catType,
        isMissing: false,
        isGhost: false,
        layerConfFound: !!layerContent.layerConfContent,
        rawLayerConf: layerContent.layerConfContent
      };

      parsedLayers.push(layerObj);
      collectionToLayerMap.set(layerObj.collectionName, layerObj);
      collectionToLayerMap.set(layerObj.name, layerObj);
      collectionToLayerMap.set(layerObj.id, layerObj);
      collectionToLayerMap.set(fallbackName, layerObj);
      for (const col of layerConfData.collections) {
        collectionToLayerMap.set(col, layerObj);
      }
    }
  }

  // Fallback Discovery Mode: triggers when no bblayers.conf found
  if (isFallbackMode || parsedLayers.filter(l => !l.isMissing).length === 0) {
    onProgress?.({
      phase: 'parsing_layers',
      message: 'No bblayers.conf found — discovering layers by scanning directory for layer.conf files...'
    });

    const allLayerConfs = await findAllFilesRecursive(rootPath, 'layer.conf', 5);

    for (const confPath of allLayerConfs) {
      const layerDir = path.dirname(path.dirname(confPath));
      let folderName = path.basename(layerDir);
      if (folderName.toLowerCase() === 'conf') {
        folderName = path.basename(path.dirname(layerDir));
      }

      const layerContent = await scanLayerContentNative(layerDir);
      let layerConfData = {
        collectionName: folderName,
        collections: [folderName],
        dependsOn: [],
        dynamicDepends: [],
        recommends: [],
        priority: undefined,
        seriesCompat: [],
        raw: ''
      };

      if (layerContent.layerConfContent) {
        layerConfData = parseLayerConf(layerContent.layerConfContent, folderName);
      }

      const canonicalName = layerConfData.collectionName || folderName;
      const catType = determineLayerCategory(folderName, canonicalName);
      const relPath = path.relative(rootPath, layerDir) || folderName;

      const fallbackLayer = {
        id: canonicalName,
        collectionName: canonicalName,
        collections: layerConfData.collections,
        name: canonicalName,
        path: relPath,
        absolutePath: relPath,
        priority: layerConfData.priority,
        seriesCompat: layerConfData.seriesCompat,
        dependsOn: layerConfData.dependsOn,
        dynamicDepends: layerConfData.dynamicDepends,
        recommends: layerConfData.recommends,
        recipes: layerContent.recipes,
        bbappends: layerContent.bbappends,
        recipeCategories: layerContent.recipeCategories,
        categoryType: catType,
        isMissing: false,
        isGhost: false,
        layerConfFound: true,
        rawLayerConf: layerContent.layerConfContent
      };

      if (!collectionToLayerMap.has(fallbackLayer.id)) {
        parsedLayers.push(fallbackLayer);
        collectionToLayerMap.set(fallbackLayer.collectionName, fallbackLayer);
        collectionToLayerMap.set(fallbackLayer.name, fallbackLayer);
        collectionToLayerMap.set(fallbackLayer.id, fallbackLayer);
        collectionToLayerMap.set(folderName, fallbackLayer);
        for (const col of layerConfData.collections) {
          collectionToLayerMap.set(col, fallbackLayer);
        }
      }
    }
  }

  if (parsedLayers.length === 0) {
    throw new Error(
      "No layers found — could not find bblayers.conf or any layer.conf files in the selected directory."
    );
  }

  // Ghost dependencies
  const unmetDependenciesSet = new Set();
  const ghostLayers = [];

  for (const layer of parsedLayers) {
    for (const dep of layer.dependsOn) {
      if (!collectionToLayerMap.has(dep)) {
        unmetDependenciesSet.add(dep);
      }
    }
  }

  for (const unmet of unmetDependenciesSet) {
    const ghostLayer = {
      id: unmet,
      collectionName: unmet,
      name: unmet,
      path: `(unmet external dependency: ${unmet})`,
      seriesCompat: [],
      dependsOn: [],
      recipes: [],
      bbappends: [],
      recipeCategories: [],
      categoryType: 'ghost',
      isMissing: false,
      isGhost: true,
      layerConfFound: false
    };
    ghostLayers.push(ghostLayer);
  }

  const allLayers = [...parsedLayers, ...ghostLayers];

  // Stats
  let totalRecipes = 0;
  let totalBbappends = 0;
  let totalDeps = 0;
  const releaseCountMap = {};

  for (const l of parsedLayers) {
    totalRecipes += l.recipes.length;
    totalBbappends += l.bbappends.length;
    totalDeps += l.dependsOn.length;
    for (const rel of l.seriesCompat) {
      releaseCountMap[rel] = (releaseCountMap[rel] || 0) + 1;
    }
  }

  let primaryRelease = undefined;
  let maxCount = 0;
  for (const [rel, count] of Object.entries(releaseCountMap)) {
    if (count > maxCount) {
      maxCount = count;
      primaryRelease = rel;
    }
  }
  if (!primaryRelease && Object.keys(releaseCountMap).length > 0) {
    primaryRelease = Object.keys(releaseCountMap)[0];
  }

  onProgress?.({
    phase: 'done',
    message: 'Finished building Yocto layer graph!'
  });

  return {
    folderName: path.basename(rootPath),
    fullPath: rootPath,
    discoveryMode,
    bblayersPath: bblayersPath ? (path.relative(rootPath, bblayersPath) || bblayersPath) : 'None (Auto-discovered)',
    localConfPath: localConfPath ? (path.relative(rootPath, localConfPath) || localConfPath) : 'local.conf (not found)',
    oeRoot,
    machine: isFallbackMode ? 'unknown' : (localConfig.machine || 'unknown'),
    distro: isFallbackMode ? 'unknown' : (localConfig.distro || 'unknown'),
    imageInstall: localConfig.imageInstall || [],
    distroFeatures: localConfig.distroFeatures || [],
    imageFeatures: localConfig.imageFeatures || [],
    packageClasses: localConfig.packageClasses || [],
    parallelMake: localConfig.parallelMake,
    bbNumberThreads: localConfig.bbNumberThreads,
    layers: allLayers,
    unmetDependencies: Array.from(unmetDependenciesSet),
    activeYoctoRelease: primaryRelease || 'Custom',
    stats: {
      totalLayers: allLayers.length,
      activeLayers: parsedLayers.filter(l => !l.isMissing).length,
      missingLayers: parsedLayers.filter(l => l.isMissing).length,
      ghostLayers: ghostLayers.length,
      totalRecipes,
      totalBbappends,
      totalDependencies: totalDeps,
      primaryRelease: primaryRelease || 'Custom'
    }
  };
}

module.exports = {
  scanYoctoProjectNative
};
