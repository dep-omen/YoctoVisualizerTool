import { LayerCategory, YoctoBbappend, YoctoBuildConfig, YoctoLayer, YoctoRecipe } from '../types';

/**
 * Determine layer category type based on its path and collection name
 */
export function determineLayerCategory(nameOrPath: string, collection: string): LayerCategory {
  const lower = (nameOrPath + ' ' + collection).toLowerCase();
  
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

/**
 * Clean up BitBake config text (handle line continuations with backslash \)
 */
export function cleanBitbakeText(content: string): string[] {
  const rawLines = content.split(/\r?\n/);
  const normalized: string[] = [];
  let buffer = '';

  for (let line of rawLines) {
    // Strip trailing comments (only if not inside quotes)
    const commentIdx = line.indexOf('#');
    if (commentIdx >= 0) {
      // Simple check if # is outside quotes
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

/**
 * Extract a variable value from BitBake lines
 */
export function extractBitbakeVar(lines: string[], varName: string): string | null {
  // Regex to match VAR =, VAR ?=, VAR ??=, VAR +=, VAR_append =, VAR:append =, etc.
  const regex = new RegExp(`^${varName}(?:_[a-zA-Z0-9_-]+|:[a-zA-Z0-9_-]+)?\\s*(?:\\?\\?=|\\?=|\\+=|=\\+|:=|=)\\s*(.*)$`);
  
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      let val = match[1].trim();
      // Remove outer quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return val.trim();
    }
  }
  return null;
}

/**
 * Extract a list/array of items from BitBake variable (e.g. BBLAYERS, DISTRO_FEATURES)
 */
export function extractBitbakeList(lines: string[], varName: string): string[] {
  // Can be defined across multiple occurrences with += or =
  const regex = new RegExp(`^${varName}(?:_[a-zA-Z0-9_-]+|:[a-zA-Z0-9_-]+)?\\s*(?:\\?\\?=|\\?=|\\+=|=\\+|:=|=)\\s*(.*)$`);
  const results: string[] = [];

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      let val = match[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Split by whitespace
      const tokens = val.split(/\s+/).map(t => t.trim()).filter(Boolean);
      results.push(...tokens);
    }
  }

  return Array.from(new Set(results));
}

/**
 * Parse layer.conf content
 */
export function parseLayerConf(content: string, layerFallbackName: string) {
  const lines = cleanBitbakeText(content);

  // BBFILE_COLLECTIONS is usually: BBFILE_COLLECTIONS += "core" or "meta-python"
  const collections = extractBitbakeList(lines, 'BBFILE_COLLECTIONS');
  const collectionName = collections[0] || layerFallbackName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  // LAYERDEPENDS can be LAYERDEPENDS_collection or just LAYERDEPENDS
  let dependsOn: string[] = [];
  for (const col of collections.length ? collections : [collectionName]) {
    const depList = extractBitbakeList(lines, `LAYERDEPENDS_${col}`);
    if (depList.length > 0) {
      dependsOn.push(...depList);
    }
  }
  if (dependsOn.length === 0) {
    dependsOn = extractBitbakeList(lines, 'LAYERDEPENDS');
  }

  // LAYERRECOMMENDS
  let recommends: string[] = [];
  for (const col of collections.length ? collections : [collectionName]) {
    const recList = extractBitbakeList(lines, `LAYERRECOMMENDS_${col}`);
    if (recList.length > 0) {
      recommends.push(...recList);
    }
  }

  // BBFILE_PRIORITY
  let priorityStr: string | null = null;
  for (const col of collections.length ? collections : [collectionName]) {
    priorityStr = extractBitbakeVar(lines, `BBFILE_PRIORITY_${col}`);
    if (priorityStr) break;
  }
  if (!priorityStr) {
    priorityStr = extractBitbakeVar(lines, 'BBFILE_PRIORITY');
  }
  const priority = priorityStr ? parseInt(priorityStr, 10) : undefined;

  // LAYERSERIES_COMPAT
  let seriesCompat: string[] = [];
  for (const col of collections.length ? collections : [collectionName]) {
    const compatList = extractBitbakeList(lines, `LAYERSERIES_COMPAT_${col}`);
    if (compatList.length > 0) {
      seriesCompat.push(...compatList);
    }
  }
  if (seriesCompat.length === 0) {
    seriesCompat = extractBitbakeList(lines, 'LAYERSERIES_COMPAT');
  }

  return {
    collectionName,
    dependsOn: Array.from(new Set(dependsOn)),
    recommends: Array.from(new Set(recommends)),
    priority: isNaN(priority as number) ? undefined : priority,
    seriesCompat: Array.from(new Set(seriesCompat)),
    raw: content
  };
}

/**
 * Parse local.conf content
 */
export function parseLocalConf(content: string) {
  const lines = cleanBitbakeText(content);

  const machine = extractBitbakeVar(lines, 'MACHINE') || undefined;
  const distro = extractBitbakeVar(lines, 'DISTRO') || undefined;
  const imageInstall = extractBitbakeList(lines, 'IMAGE_INSTALL');
  const distroFeatures = extractBitbakeList(lines, 'DISTRO_FEATURES');
  const imageFeatures = extractBitbakeList(lines, 'IMAGE_FEATURES');
  const packageClasses = extractBitbakeVar(lines, 'PACKAGE_CLASSES') || undefined;
  const parallelMake = extractBitbakeVar(lines, 'PARALLEL_MAKE') || undefined;
  const bbNumberThreads = extractBitbakeVar(lines, 'BB_NUMBER_THREADS') || undefined;

  return {
    machine,
    distro,
    imageInstall: imageInstall.length ? imageInstall : undefined,
    distroFeatures: distroFeatures.length ? distroFeatures : undefined,
    imageFeatures: imageFeatures.length ? imageFeatures : undefined,
    packageClasses,
    parallelMake,
    bbNumberThreads
  };
}

/**
 * Parse recipe filename (e.g. "busybox_1.36.1.bb" -> name: "busybox", version: "1.36.1")
 */
export function parseRecipeFilename(filename: string): { name: string; version?: string } {
  const base = filename.replace(/\.bb$/, '');
  const lastUnderscore = base.lastIndexOf('_');
  if (lastUnderscore > 0) {
    return {
      name: base.substring(0, lastUnderscore),
      version: base.substring(lastUnderscore + 1)
    };
  }
  return { name: base };
}

/**
 * Parse bbappend filename (e.g. "linux-stm32mp_%.bbappend" -> targetRecipe: "linux-stm32mp")
 */
export function parseBbappendFilename(filename: string): string {
  const base = filename.replace(/\.bbappend$/, '');
  const lastUnderscore = base.lastIndexOf('_');
  if (lastUnderscore > 0) {
    return base.substring(0, lastUnderscore);
  }
  return base;
}
