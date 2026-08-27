import { YoctoBbappend, YoctoBuildConfig, YoctoLayer, YoctoRecipe } from '../types';
import {
  determineLayerCategory,
  parseBbappendFilename,
  parseBblayersConf,
  parseLayerConf,
  parseLocalConf,
  parseRecipeFilename,
  resolveOeRoot
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
 * Search recursively for all files matching a name (e.g. all layer.conf for fallback mode)
 */
async function searchAllFilesRecursively(
  dirHandle: FileSystemDirectoryHandle,
  targetFileName: string,
  maxDepth = 4,
  currentPath = ''
): Promise<Array<{ handle: FileSystemFileHandle; path: string; parentDir: FileSystemDirectoryHandle }>> {
  if (maxDepth < 0) return [];
  const results: Array<{ handle: FileSystemFileHandle; path: string; parentDir: FileSystemDirectoryHandle }> = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'file' && name === targetFileName) {
        results.push({
          handle: handle as FileSystemFileHandle,
          path: currentPath ? `${currentPath}/${name}` : name,
          parentDir: dirHandle
        });
      } else if (handle.kind === 'directory') {
        if (['tmp', 'downloads', 'sstate-cache', 'cache', '.git', 'node_modules'].includes(name)) {
          continue;
        }
        const subPath = currentPath ? `${currentPath}/${name}` : name;
        const subResults = await searchAllFilesRecursively(
          handle as FileSystemDirectoryHandle,
          targetFileName,
          maxDepth - 1,
          subPath
        );
        results.push(...subResults);
      }
    }
  } catch (err) {
    console.warn('Error searching files:', err);
  }

  return results;
}

/**
 * Locate a directory handle corresponding to a layer path
 */
async function resolveLayerDirectory(
  rootHandle: FileSystemDirectoryHandle,
  rawPath: string,
  oeRoot: string,
  allDirMap: Map<string, FileSystemDirectoryHandle>
): Promise<{ handle: FileSystemDirectoryHandle; relativePath: string } | null> {
  let clean = rawPath.replace(/\\/g, '/').trim();

  // If path starts with resolved OEROOT, extract relative path
  if (oeRoot && clean.startsWith(oeRoot)) {
    const relFromOe = clean.slice(oeRoot.length).replace(/^\/+/, '');
    if (allDirMap.has(relFromOe)) {
      return {
        handle: allDirMap.get(relFromOe)!,
        relativePath: relFromOe
      };
    }
  }

  const segments = clean.split('/').filter(Boolean);
  const folderName = segments[segments.length - 1];

  // 1. Check direct folderName
  if (folderName && allDirMap.has(folderName)) {
    return {
      handle: allDirMap.get(folderName)!,
      relativePath: folderName
    };
  }

  // 2. Try match multi-segment suffixes (e.g. meta-openembedded/meta-oe or layers/meta-st/meta-st-stm32mp)
  if (segments.length >= 2) {
    const doubleSuffix = `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    if (allDirMap.has(doubleSuffix)) {
      return { handle: allDirMap.get(doubleSuffix)!, relativePath: doubleSuffix };
    }
    for (const [key, handle] of allDirMap.entries()) {
      if (key.endsWith(doubleSuffix)) {
        return { handle, relativePath: key };
      }
    }
  }

  if (segments.length >= 3) {
    const tripleSuffix = `${segments[segments.length - 3]}/${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    if (allDirMap.has(tripleSuffix)) {
      return { handle: allDirMap.get(tripleSuffix)!, relativePath: tripleSuffix };
    }
  }

  // 3. Try step-by-step traversal from root
  let currentDir = rootHandle;
  let success = true;
  let resolved = '';
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

  // Pre-index top-level, second-level, and third-level directories in root directory
  const allDirMap = new Map<string, FileSystemDirectoryHandle>();
  async function indexDirs(dirHandle: FileSystemDirectoryHandle, prefix = '', depth = 0) {
    if (depth > 4) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind === 'directory') {
          if (['tmp', 'downloads', 'sstate-cache', '.git', 'node_modules'].includes(name)) continue;
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

  // 1. Locate bblayers.conf
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

  let oeRoot = resolveOeRoot(bblayersResult ? bblayersResult.resolvedPath : rootDirHandle.name);
  let rawLayerPaths: string[] = [];
  const isFallbackMode = !bblayersResult;
  const discoveryMode: 'bblayers' | 'fallback' = isFallbackMode ? 'fallback' : 'bblayers';

  if (bblayersResult) {
    const bblayersContent = await readFileText(bblayersResult.handle);
    const parsedBblayers = parseBblayersConf(bblayersContent, bblayersResult.resolvedPath);
    oeRoot = parsedBblayers.oeRoot;
    rawLayerPaths = parsedBblayers.layerPaths;
  }

  // 2. Locate local.conf (only when bblayers.conf was found or local.conf exists)
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
  if (localConfResult && !isFallbackMode) {
    const localContent = await readFileText(localConfResult.handle);
    localConfig = parseLocalConf(localContent);
  }

  const parsedLayers: YoctoLayer[] = [];
  const collectionToLayerMap = new Map<string, YoctoLayer>();

  if (!isFallbackMode) {
    onProgress?.({
      phase: 'parsing_layers',
      message: `Discovered ${rawLayerPaths.length} layer candidate(s) in BBLAYERS. Verifying filesystem handles...`,
      total: rawLayerPaths.length
    });

    // 3. Process each layer candidate from BBLAYERS
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

      const dirRes = await resolveLayerDirectory(rootDirHandle, rawPath, oeRoot, allDirMap);

      if (!dirRes) {
        // Layer candidate not found on disk -> Ghost / Missing
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
        collections: [fallbackName],
        dependsOn: [],
        dynamicDepends: [],
        recommends: [],
        priority: undefined,
        seriesCompat: [],
        pattern: undefined,
        raw: ''
      };

      if (layerContent.layerConfContent) {
        layerConfData = parseLayerConf(layerContent.layerConfContent, fallbackName);
      }

      // Step 1 & 5: Determine display name and canonical ID
      // Preferred: first value from BBFILE_COLLECTIONS (canonical name)
      // Fallback: directory name (never 'conf')
      const canonicalName = layerConfData.collectionName || fallbackName;
      const catType = determineLayerCategory(fallbackName, canonicalName);

      const layerObj: YoctoLayer = {
        id: canonicalName,
        collectionName: canonicalName,
        collections: layerConfData.collections,
        name: canonicalName,
        path: rawPath,
        absolutePath: dirRes.relativePath,
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
      if (layerConfData.collections) {
        for (const col of layerConfData.collections) {
          collectionToLayerMap.set(col, layerObj);
        }
      }
    }
  }

  // Fallback Discovery Mode: triggers automatically when no bblayers.conf is found
  if (isFallbackMode || parsedLayers.filter(l => !l.isMissing).length === 0) {
    onProgress?.({
      phase: 'parsing_layers',
      message: 'No bblayers.conf found — discovering layers by scanning directory for layer.conf files...'
    });

    const allLayerConfs = await searchAllFilesRecursively(rootDirHandle, 'layer.conf', 5);
    const validConfs = allLayerConfs.filter(item => 
      item.path.endsWith('/conf/layer.conf') || 
      item.path === 'conf/layer.conf' ||
      item.path.endsWith('layer.conf')
    );

    for (const item of validConfs) {
      // item.path looks like "meta/conf/layer.conf" or "layers/meta-oe/conf/layer.conf"
      // Strip "/conf/layer.conf" to get the layer root relative path
      const layerRootRelPath = item.path
        .replace('/conf/layer.conf', '')
        .replace('conf/layer.conf', '')
        .trim();

      const pathSegments = layerRootRelPath.split('/').filter(Boolean);

      // Navigate directly from rootDirHandle through path segments
      // This is guaranteed to work because item.path was already found via recursive search
      let layerDirHandle: FileSystemDirectoryHandle = rootDirHandle;
      let navSuccess = true;
      for (const seg of pathSegments) {
        try {
          layerDirHandle = await (layerDirHandle as any).getDirectoryHandle(seg);
        } catch {
          navSuccess = false;
          break;
        }
      }
      if (!navSuccess) {
        // Last resort fallback
        layerDirHandle = item.parentDir;
      }

      // Derive layerRelPath and folderName from the resolved path
      const layerRelPath = layerRootRelPath || rootDirHandle.name;
      let folderName = pathSegments.length > 0 
        ? pathSegments[pathSegments.length - 1] 
        : rootDirHandle.name;
      if (folderName.toLowerCase() === 'conf') {
        folderName = pathSegments.length > 1 
          ? pathSegments[pathSegments.length - 2] 
          : rootDirHandle.name;
      }

      const layerContent = await scanLayerContent(layerDirHandle, folderName, layerRelPath);
      let layerConfData: ReturnType<typeof parseLayerConf> = {
        collectionName: folderName,
        collections: [folderName],
        dependsOn: [],
        dynamicDepends: [],
        recommends: [],
        priority: undefined,
        seriesCompat: [],
        pattern: undefined,
        raw: ''
      };

      if (layerContent.layerConfContent) {
        layerConfData = parseLayerConf(layerContent.layerConfContent, folderName);
      }

      const canonicalName = layerConfData.collectionName || folderName;
      const catType = determineLayerCategory(folderName, canonicalName);

      const fallbackLayer: YoctoLayer = {
        id: canonicalName,
        collectionName: canonicalName,
        collections: layerConfData.collections,
        name: canonicalName,
        path: `${oeRoot}/${layerRelPath}`,
        absolutePath: layerRelPath,
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
        if (layerConfData.collections) {
          for (const col of layerConfData.collections) {
            collectionToLayerMap.set(col, fallbackLayer);
          }
        }
      }
    }
  }

  if (parsedLayers.length === 0) {
    throw new Error(
      "No layers found — could not find bblayers.conf or any layer.conf files in the selected directory."
    );
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

  // Find most frequent release compat tag (e.g. "scarthgap", "kirkstone", "nanbield", "mickledore", "wrynose")
  let primaryRelease: string | undefined = undefined;
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
    folderName: rootDirHandle.name,
    discoveryMode,
    bblayersPath: bblayersResult ? bblayersResult.resolvedPath : 'None (Auto-discovered)',
    localConfPath: localConfResult ? localConfResult.resolvedPath : 'local.conf (not found)',
    oeRoot,
    machine: isFallbackMode ? 'unknown' : (localConfig.machine || 'unknown'),
    distro: isFallbackMode ? 'unknown' : (localConfig.distro || 'unknown'),
    imageInstall: localConfig.imageInstall,
    distroFeatures: localConfig.distroFeatures,
    imageFeatures: localConfig.imageFeatures,
    packageClasses: localConfig.packageClasses,
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
