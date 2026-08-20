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
 * Step 1 — Resolve OEROOT:
 * OEROOT is defined as a Python expression: ${@os.path.abspath(os.path.dirname(d.getVar('FILE')) + '/../..')}.
 * In the browser context d.getVar('FILE') means the path to the bblayers.conf file itself.
 * OEROOT = go two directories up from the bblayers.conf file.
 * (e.g. /home/rrp/openstlinux-workspace/build-foo/conf/bblayers.conf -> /home/rrp/openstlinux-workspace)
 */
export function resolveOeRoot(bblayersPath: string, fileContent = ''): string {
  const clean = bblayersPath.replace(/\\/g, '/').trim();

  if (clean.includes('/')) {
    const isAbsolute = clean.startsWith('/');
    const parts = clean.split('/').filter(Boolean);

    // Drop filename (e.g. bblayers.conf)
    if (parts.length > 0 && parts[parts.length - 1].endsWith('.conf')) {
      parts.pop();
    }
    // Drop conf directory
    if (parts.length > 0 && parts[parts.length - 1] === 'conf') {
      parts.pop();
    }
    // Drop build directory (e.g. build-openstlinuxweston-... or build)
    if (parts.length > 0) {
      parts.pop();
    }

    const resolved = (isAbsolute ? '/' : '') + parts.join('/');
    if (resolved && resolved !== '/') {
      return resolved;
    }
  }

  // Check if file content contains hardcoded absolute paths to layers
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

/**
 * Step 2 & 3 & 4 — Advanced BitBake bblayers.conf parser:
 * - Parses all BitBake assignment operators: =, ?=, ??=, :=, +=, =+, .=
 * - Resolves OEROOT first
 * - Iteratively expands ${VAR} variables
 * - Extracts candidate paths from Python expressions ${@...}
 * - Preserves prepend (=+) and append (+=) ordering
 */
export function parseBblayersConf(
  content: string,
  bblayersPath: string
): {
  oeRoot: string;
  layerPaths: string[];
  variables: Record<string, string>;
} {
  const oeRoot = resolveOeRoot(bblayersPath, content);
  const lines = cleanBitbakeText(content);

  // Initial variable map with OEROOT, TOPDIR, FILE
  const vars: Record<string, string> = {
    OEROOT: oeRoot,
    TOPDIR: `${oeRoot}/build`,
    FILE: bblayersPath
  };

  // Track assignments in line-by-line order
  const assignmentRegex = /^([a-zA-Z0-9_:.${}@-]+)\s*(\?\?=|(?:\?\=)|(?:\:\=)|(?:\+\=)|(?:\=\+)|(?:\.\=)|(?:\=))\s*(.*)$/;

  for (const line of lines) {
    const match = line.match(assignmentRegex);
    if (!match) continue;

    const varName = match[1].trim();
    const op = match[2].trim();
    let rawVal = match[3].trim();

    // Strip outer matching quotes
    if (
      (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'") && rawVal.length >= 2)
    ) {
      rawVal = rawVal.slice(1, -1).trim();
    }

    // Handle compound variable operators
    if (op === '?=' || op === '??=') {
      if (!(varName in vars)) {
        vars[varName] = rawVal;
      }
    } else if (op === '=' || op === ':=') {
      vars[varName] = rawVal;
    } else if (op === '+=') {
      vars[varName] = vars[varName] ? `${vars[varName]} ${rawVal}` : rawVal;
    } else if (op === '=+') {
      vars[varName] = vars[varName] ? `${rawVal} ${vars[varName]}` : rawVal;
    } else if (op === '.=') {
      vars[varName] = vars[varName] ? `${vars[varName]}${rawVal}` : rawVal;
    }
  }

  // Iteratively expand variable references and Python expressions
  function expandString(input: string, depth = 0): string {
    if (depth > 20 || !input) return input;

    // 1. Expand standard ${VAR} references
    let expanded = input.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_, name) => {
      if (name in vars && depth < 20) {
        return expandString(vars[name], depth + 1);
      }
      return '';
    });

    // 2. Resolve Python expressions ${@...}
    expanded = expanded.replace(/\$\{@([\s\S]*?)\}/g, (_, pyCode) => {
      // If it's abspath/dirname(FILE) -> OEROOT
      if (pyCode.includes('os.path.abspath') || pyCode.includes('getVar(\'FILE\')')) {
        return oeRoot;
      }

      // Ternary pattern: ${@'true_path' if condition else 'false_path'}
      const ternaryMatch = pyCode.match(/['"]([^'"]*)['"]\s+if\s+[\s\S]*?\s+else\s+['"]([^'"]*)['"]/);
      if (ternaryMatch) {
        const trueBranch = expandString(ternaryMatch[1].trim(), depth + 1);
        const falseBranch = expandString(ternaryMatch[2].trim(), depth + 1);
        return `${trueBranch} ${falseBranch}`.trim();
      }

      // Extract all string literals inside pyCode (excluding .conf condition checks)
      const stringLiterals: string[] = [];
      const litRegex = /['"]([^'"]+)['"]/g;
      let litMatch: RegExpExecArray | null;
      while ((litMatch = litRegex.exec(pyCode)) !== null) {
        const str = litMatch[1].trim();
        if (!str.endsWith('.conf')) {
          stringLiterals.push(expandString(str, depth + 1));
        }
      }

      return stringLiterals.join(' ');
    });

    // Re-check for any newly exposed variable expressions
    if (expanded.includes('${') && depth < 20) {
      return expandString(expanded, depth + 1);
    }

    return expanded;
  }

  // Expand all variables in the map
  const expandedVars: Record<string, string> = {};
  for (const [key, val] of Object.entries(vars)) {
    expandedVars[key] = expandString(val);
  }

  // Extract from BBLAYERS
  const bblayersRaw = vars['BBLAYERS'] || '';
  const expandedBblayers = expandString(bblayersRaw);

  const rawTokens = expandedBblayers
    .replace(/["'\\]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !t.startsWith('#'));

  // Collect candidate paths
  const candidatePaths: string[] = [];
  const seen = new Set<string>();

  for (const token of rawTokens) {
    if (!token) continue;
    const cleanToken = token.replace(/\\/g, '/').replace(/\/+/g, '/').trim();
    if (cleanToken && !seen.has(cleanToken)) {
      seen.add(cleanToken);
      candidatePaths.push(cleanToken);
    }
  }

  return {
    oeRoot,
    layerPaths: candidatePaths,
    variables: expandedVars
  };
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
