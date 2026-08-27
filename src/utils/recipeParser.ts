import { YoctoLayer, YoctoRecipe } from '../types';
import { extractBitbakeVar, extractBitbakeList } from './yoctoParser';

const fileCache = new Map<string, string>();

export async function readYoctoFile(
  rootHandle: any,
  layerAbsolutePath: string,
  relativePath: string
): Promise<string> {
  if (!rootHandle || !layerAbsolutePath) return '';

  const fullPath = `${layerAbsolutePath}/${relativePath}`;
  if (fileCache.has(fullPath)) {
    return fileCache.get(fullPath)!;
  }

  try {
    // Get the root folder name to strip it from the absolute path
    const rootName = rootHandle.name;

    // Strip everything up to and including the root folder name
    // e.g. /home/user/openstlinux-workspace/layers/meta-oe/...
    // becomes layers/meta-oe/...
    const rootIndex = fullPath.indexOf('/' + rootName + '/');
    let relativeFull: string;

    if (rootIndex !== -1) {
      // Strip up to and including the root folder
      relativeFull = fullPath.slice(rootIndex + rootName.length + 2);
    } else if (fullPath.startsWith(rootName + '/')) {
      // Path already starts with root folder name
      relativeFull = fullPath.slice(rootName.length + 1);
    } else {
      // Last resort — use the path as-is and hope it's relative
      relativeFull = fullPath.startsWith('/') ? fullPath.slice(1) : fullPath;
    }

    const parts = relativeFull.split('/').filter(Boolean);
    let current = rootHandle;

    for (let i = 0; i < parts.length - 1; i++) {
      try {
        current = await current.getDirectoryHandle(parts[i]);
      } catch {
        console.warn(`Directory not found: ${parts[i]} in path ${relativeFull}`);
        return '';
      }
    }

    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    const text = await file.text();
    fileCache.set(fullPath, text);
    return text;
  } catch (err) {
    console.warn('Failed to read file', relativePath, err);
    return '';
  }
}

export async function readRecipeContent(rootHandle: any, layer: YoctoLayer, recipe: YoctoRecipe): Promise<string> {
  return readYoctoFile(rootHandle, layer.absolutePath, recipe.relativePath);
}

export function cleanDepList(list: string[], pn: string): string[] {
  const result = new Set<string>();
  for (const dep of list) {
    let clean = dep.split('(')[0].trim();
    if (clean.includes('${PN}')) clean = clean.replace(/\$\{PN\}/g, pn);
    clean = clean.replace(/^-dev$/, '').replace(/^-staticdev$/, ''); // edge cases
    if (clean && clean !== pn) {
      result.add(clean);
    }
  }
  return Array.from(result);
}

export function parseRecipeDeps(content: string, pn: string) {
  // Strip comments and continuation lines
  const lines = content
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map(line => line.split('#')[0].trim())
    .filter(Boolean);

  const depends = extractBitbakeList(lines, 'DEPENDS');
  
  // RDEPENDS can be RDEPENDS:${PN} or just RDEPENDS
  let rdepends = extractBitbakeList(lines, `RDEPENDS:${pn}`);
  if (rdepends.length === 0) {
    rdepends = extractBitbakeList(lines, 'RDEPENDS');
  }

  const desc = extractBitbakeVar(lines, 'DESCRIPTION') || extractBitbakeVar(lines, 'SUMMARY');
  const license = extractBitbakeVar(lines, 'LICENSE');
  const pv = extractBitbakeVar(lines, 'PV');

  return {
    depends: cleanDepList(depends, pn),
    rdepends: cleanDepList(rdepends, pn),
    description: desc,
    license: license,
    pv: pv
  };
}
