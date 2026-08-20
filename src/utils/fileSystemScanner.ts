import { YoctoBbappend, YoctoBuildConfig, YoctoLayer, YoctoRecipe } from '../types';
import {
  determineLayerCategory,
  parseBbappendFilename,
  parseLayerConf,
  parseLocalConf,
  parseRecipeFilename
} from './yoctoParser';

// File System Access API types
interface FileSystemHandleLike {
  kind: 'file' | 'directory';
  name: string;
}

export type ScanProgressCallback = (status: {
  phase: 'finding_conf' | 'parsing_layers' | 'scanning_recipes' | 'done';
  message: string;
  processed?: number;
  total?: number;
}) => void;

/**
 * Read text content from a FileSystemFileHandle
 */
async function readFileText(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return await file.text();
}

/**
 * Look for a file in a given directory handle by path tokens (e.g. ['build', 'conf', 'bblayers.conf'])
 */
async function findFileByPath(
  rootHandle: FileSystemDirectoryHandle,
  pathParts: string[]
): Promise<{ handle: FileSystemFileHandle; resolvedPath: string } | null> {
  let currentDir = rootHandle;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (part === '.' || part === '') continue;
    try {
      currentDir = await currentDir.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }

  const fileName = pathParts[pathParts.length - 1];
  try {
    const fileHandle = await currentDir.getFileHandle(fileName);
    return { handle: fileHandle, resolvedPath: pathParts.join('/') };
  } catch {
    return null;
  }
}

/**
 * Search recursively for a file by name up to a max depth
 */
async function searchFileRecursively(
  dirHandle: FileSystemDirectoryHandle,
  targetFileName: string,
  maxDepth = 3,
  currentPath = ''
): Promise<{ handle: FileSystemFileHandle; path: string; parentDir: FileSystemDirectoryHandle } | null> {
  if (maxDepth < 0) return null;

  try {
    // Check direct children first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'file' && name === targetFileName) {
        return {
          handle: handle as FileSystemFileHandle,
          path: currentPath ? `${currentPath}/${name}` : name,
          parentDir: dirHandle
        };
      }
    }

    // Then search subdirectories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'directory') {
        // Skip common build heavy folders to keep search instant
        if (['tmp', 'downloads', 'sstate-cache', 'cache', '.git', 'node_modules'].includes(name)) {
          continue;
        }
        const subPath = currentPath ? `${currentPath}/${name}` : name;
        const result = await searchFileRecursively(
          handle as FileSystemDirectoryHandle,
          targetFileName,
          maxDepth - 1,
          subPath
        );
        if (result) return result;
      }
    }
  } catch (err) {
    console.warn('Error reading directory:', err);
  }

  return null;
}

/**
 * Locate a directory handle corresponding to a layer path
 */
async function resolveLayerDirectory(
  rootHandle: FileSystemDirectoryHandle,
  rawPath: string,
  allDirMap: Map<string, FileSystemDirectoryHandle>
): Promise<{ handle: FileSystemDirectoryHandle; relativePath: string } | null> {
  // Normalize rawPath: remove ${TOPDIR}, replace /home/... or relative ../
  let clean = rawPath.replace(/\$\{TOPDIR\}/g, '').trim();
  clean = clean.replace(/\\/g, '/');

  // If path contains segments, take the last segment or relative path
  const segments = clean.split('/').filter(Boolean);
  const folderName = segments[segments.length - 1];

  // 1. Check if folderName is in our pre-indexed directories map
  if (folderName && allDirMap.has(folderName)) {
    return {
      handle: allDirMap.get(folderName)!,
      relativePath: folderName
    };
  }

  // 2. Try to match suffix (e.g. meta-openembedded/meta-oe)
  if (segments.length >= 2) {
    const doubleSuffix = `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    for (const [key, handle] of allDirMap.entries()) {
      if (key.endsWith(doubleSuffix) || key === folderName) {
        return { handle, relativePath: key };
      }
    }
  }

  // 3. Try step-by-step traversal from root
  let currentDir = rootHandle;
  let success = true;
  let resolved = '';
  // find starting index if absolute path
  let startIdx = 0;
  const rootName = rootHandle.name;
  const rootIndex = segments.indexOf(rootName);
  if (rootIndex >= 0) {
    startIdx = rootIndex + 1;
  }

  for (let i = startIdx; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '.' || seg === '..') continue;
    try {
      currentDir = await currentDir.getDirectoryHandle(seg);
      resolved = resolved ? `${resolved}/${seg}` : seg;
    } catch {
      success = false;
      break;
    }
  }

  if (success && resolved) {
    return { handle: currentDir, relativePath: resolved };
  }

  return null;
}

/**
 * Scan a single layer directory for conf/layer.conf, .bb files, and .bbappend files
 */
async function scanLayerContent(
  layerDirHandle: FileSystemDirectoryHandle,
  layerName: string,
  layerPath: string
): Promise<{
  layerConfContent?: string;
  recipes: YoctoRecipe[];
  bbappends: YoctoBbappend[];
  recipeCategories: string[];
}> {
  let layerConfContent: string | undefined;
  const recipes: YoctoRecipe[] = [];
  const bbappendsList: YoctoBbappend[] = [];
  const categoriesSet = new Set<string>();

  // Check conf/layer.conf
  try {
    const confDir = await layerDirHandle.getDirectoryHandle('conf');
    const layerConfFile = await confDir.getFileHandle('layer.conf');
    layerConfContent = await readFileText(layerConfFile);
  } catch {
    // layer.conf not found in direct conf/
  }

  // Helper to walk layer directory
  async function walkDir(dirHandle: FileSystemDirectoryHandle, currentRelPath: string, depth = 0) {
    if (depth > 6) return; // safety boundary

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'file') {
          if (name.endsWith('.bb')) {
            const { name: rName, version } = parseRecipeFilename(name);
            const pathParts = currentRelPath.split('/');
            // Check if one of the parent path parts is recipes-*
            const catPart = pathParts.find(p => p.startsWith('recipes-')) || 'recipes';
            categoriesSet.add(catPart);

            recipes.push({
              name: rName,
              filename: name,
              version,
              category: catPart,
              relativePath: currentRelPath ? `${currentRelPath}/${name}` : name
            });
          } else if (name.endsWith('.bbappend')) {
            const target = parseBbappendFilename(name);
            const pathParts = currentRelPath.split('/');
            const catPart = pathParts.find(p => p.startsWith('recipes-')) || 'recipes';
            categoriesSet.add(catPart);

            bbappendsList.push({
              filename: name,
              targetRecipe: target,
              category: catPart,
              relativePath: currentRelPath ? `${currentRelPath}/${name}` : name
            });
          }
        } else if (handle.kind === 'directory') {
          // Skip build artifacts and cache folders
          if (['files', 'patches', '.git', 'test', 'tests'].includes(name) && depth > 2) {
            continue;
          }
          await walkDir(
            handle as FileSystemDirectoryHandle,
            currentRelPath ? `${currentRelPath}/${name}` : name,
            depth + 1
          );
        }
      }
    } catch (e) {
      console.warn(`Error scanning directory ${currentRelPath}:`, e);
    }
  }

  await walkDir(layerDirHandle, '');

  return {
    layerConfContent,
    recipes,
    bbappends: bbappendsList,
    recipeCategories: Array.from(categoriesSet).sort()
  };
}

/**
 * Main function to scan a picked Yocto directory
 */
export async function scanYoctoDirectory(
  rootDirHandle: FileSystemDirectoryHandle,
  onProgress?: ScanProgressCallback
): Promise<YoctoBuildConfig> {
  onProgress?.({
    phase: 'finding_conf',
    message: 'Searching for build/conf/bblayers.conf and local.conf...'
  });

  // 1. Locate bblayers.conf
  // Try standard locations first
  let bblayersResult = await findFileByPath(rootDirHandle, ['build', 'conf', 'bblayers.conf']);
  if (!bblayersResult) {
    bblayersResult = await findFileByPath(rootDirHandle, ['conf', 'bblayers.conf']);
  }
  if (!bblayersResult) {
    // Search recursively up to 3 levels
    const recursiveRes = await searchFileRecursively(rootDirHandle, 'bblayers.conf', 3);
    if (recursiveRes) {
      bblayersResult = { handle: recursiveRes.handle, resolvedPath: recursiveRes.path };
    }
  }

  if (!bblayersResult) {
    throw new Error(
      "Couldn't find build/conf/bblayers.conf — make sure you selected the root of your Yocto project (containing the 'build' or 'conf' directory)."
    );
  }

  const bblayersContent = await readFileText(bblayersResult.handle);
  const bblayersLines = bblayersContent.split(/\r?\n/);
  
  // Extract layer paths from bblayers.conf
  // BitBake BBLAYERS:
  // BBLAYERS ?= " \
  //   /home/.../poky/meta \
  //   /home/.../poky/meta-poky \
  //   ..."
  const rawLayerPaths: string[] = [];
  let inBblayers = false;
  let bblayersBuffer = '';

  for (const line of bblayersLines) {
    const trimmed = line.trim();
    if (/^BBLAYERS\b/.test(trimmed)) {
      inBblayers = true;
      bblayersBuffer += ' ' + trimmed.replace(/^BBLAYERS[^\w]*[=]/, '');
    } else if (inBblayers) {
      bblayersBuffer += ' ' + trimmed;
    }

    if (inBblayers && trimmed.endsWith('"') && !trimmed.endsWith('\\"')) {
      inBblayers = false;
    }
  }

  // Extract quoted paths or tokens
  const cleanTokens = bblayersBuffer
    .replace(/["'\\]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !t.startsWith('#'));

  rawLayerPaths.push(...cleanTokens);

  // 2. Locate local.conf
  let localConfResult = await findFileByPath(rootDirHandle, ['build', 'conf', 'local.conf']);
  if (!localConfResult) {
    localConfResult = await findFileByPath(rootDirHandle, ['conf', 'local.conf']);
  }
  if (!localConfResult) {
    const recLocal = await searchFileRecursively(rootDirHandle, 'local.conf', 3);
    if (recLocal) {
      localConfResult = { handle: recLocal.handle, resolvedPath: recLocal.path };
    }
  }

  let localConfig: Partial<ReturnType<typeof parseLocalConf>> = {};
  if (localConfResult) {
    const localContent = await readFileText(localConfResult.handle);
    localConfig = parseLocalConf(localContent);
  }

  onProgress?.({
    phase: 'parsing_layers',
    message: `Discovered ${rawLayerPaths.length} layers in BBLAYERS. Indexing directories...`,
    total: rawLayerPaths.length
  });

  // Pre-index top-level and second-level directories in root directory to quickly match layer paths
  const allDirMap = new Map<string, FileSystemDirectoryHandle>();
  async function indexDirs(dirHandle: FileSystemDirectoryHandle, prefix = '', depth = 0) {
    if (depth > 3) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'directory') {
          if (['tmp', 'downloads', 'sstate-cache', '.git'].includes(name)) continue;
          const full = prefix ? `${prefix}/${name}` : name;
          allDirMap.set(name, handle as FileSystemDirectoryHandle);
          allDirMap.set(full, handle as FileSystemDirectoryHandle);
          await indexDirs(handle as FileSystemDirectoryHandle, full, depth + 1);
        }
      }
    } catch {
      // ignore
    }
  }
  await indexDirs(rootDirHandle);

  // 3. Process each layer
  const parsedLayers: YoctoLayer[] = [];
  const collectionToLayerMap = new Map<string, YoctoLayer>();
  let processedCount = 0;

  for (const rawPath of rawLayerPaths) {
    processedCount++;
    const pathParts = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
    const fallbackName = pathParts[pathParts.length - 1] || 'layer';

    onProgress?.({
      phase: 'scanning_recipes',
      message: `Scanning ${fallbackName} (${processedCount}/${rawLayerPaths.length})...`,
      processed: processedCount,
      total: rawLayerPaths.length
    });

    const dirRes = await resolveLayerDirectory(rootDirHandle, rawPath, allDirMap);

    if (!dirRes) {
      // Layer not found on disk
      const layerObj: YoctoLayer = {
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
      parsedLayers.push(layerObj);
      collectionToLayerMap.set(fallbackName, layerObj);
      continue;
    }

    // Scan layer content
    const layerContent = await scanLayerContent(dirRes.handle, fallbackName, dirRes.relativePath);
    let layerConfData: ReturnType<typeof parseLayerConf> = {
      collectionName: fallbackName,
      dependsOn: [],
      recommends: [],
      priority: undefined,
      seriesCompat: [],
      raw: ''
    };

    if (layerContent.layerConfContent) {
      layerConfData = parseLayerConf(layerContent.layerConfContent, fallbackName);
    }

    const catType = determineLayerCategory(fallbackName, layerConfData.collectionName);

    const layerObj: YoctoLayer = {
      id: layerConfData.collectionName || fallbackName,
      collectionName: layerConfData.collectionName || fallbackName,
      name: fallbackName,
      path: rawPath,
      absolutePath: dirRes.relativePath,
      priority: layerConfData.priority,
      seriesCompat: layerConfData.seriesCompat,
      dependsOn: layerConfData.dependsOn,
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
  }

  // 4. Identify ghost dependencies (dependencies in LAYERDEPENDS not in BBLAYERS)
  const unmetDependenciesSet = new Set<string>();
  const ghostLayers: YoctoLayer[] = [];

  for (const layer of parsedLayers) {
    for (const dep of layer.dependsOn) {
      if (!collectionToLayerMap.has(dep)) {
        unmetDependenciesSet.add(dep);
      }
    }
  }

  for (const unmet of unmetDependenciesSet) {
    const ghostLayer: YoctoLayer = {
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

  // 5. Calculate statistics & active release
  let totalRecipes = 0;
  let totalBbappends = 0;
  let totalDeps = 0;
  const releaseCountMap: Record<string, number> = {};

  for (const l of parsedLayers) {
    totalRecipes += l.recipes.length;
    totalBbappends += l.bbappends.length;
    totalDeps += l.dependsOn.length;
    for (const rel of l.seriesCompat) {
      releaseCountMap[rel] = (releaseCountMap[rel] || 0) + 1;
    }
  }

  // Find most frequent release compat tag (e.g. "scarthgap", "kirkstone", "nanbield", "mickledore")
  let primaryRelease = 'Unknown';
  let maxCount = 0;
  for (const [rel, count] of Object.entries(releaseCountMap)) {
    if (count > maxCount) {
      maxCount = count;
      primaryRelease = rel;
    }
  }

  onProgress?.({
    phase: 'done',
    message: 'Finished building Yocto layer graph!'
  });

  return {
    folderName: rootDirHandle.name,
    bblayersPath: bblayersResult.resolvedPath,
    localConfPath: localConfResult ? localConfResult.resolvedPath : 'local.conf (not found)',
    machine: localConfig.machine,
    distro: localConfig.distro,
    imageInstall: localConfig.imageInstall,
    distroFeatures: localConfig.distroFeatures,
    imageFeatures: localConfig.imageFeatures,
    packageClasses: localConfig.packageClasses,
    parallelMake: localConfig.parallelMake,
    bbNumberThreads: localConfig.bbNumberThreads,
    layers: allLayers,
    unmetDependencies: Array.from(unmetDependenciesSet),
    activeYoctoRelease: primaryRelease !== 'Unknown' ? primaryRelease : undefined,
    stats: {
      totalLayers: allLayers.length,
      activeLayers: parsedLayers.filter(l => !l.isMissing).length,
      missingLayers: parsedLayers.filter(l => l.isMissing).length,
      ghostLayers: ghostLayers.length,
      totalRecipes,
      totalBbappends,
      totalDependencies: totalDeps,
      primaryRelease
    }
  };
}
