import { YoctoLayer, YoctoRecipe } from '../types';
import { extractBitbakeVar, extractBitbakeList } from './yoctoParser';

const fileCache = new Map<string, string>();

export async function readRecipeContent(rootHandle: any, layer: YoctoLayer, recipe: YoctoRecipe): Promise<string> {
  if (!rootHandle || !layer.absolutePath) return '';
  const fullPath = `${layer.absolutePath}/${recipe.relativePath}`;
  if (fileCache.has(fullPath)) {
    return fileCache.get(fullPath)!;
  }
  
  try {
    const parts = fullPath.split('/').filter(Boolean);
    let current = rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    const file = await fileHandle.getFile();
    const text = await file.text();
    fileCache.set(fullPath, text);
    return text;
  } catch (err) {
    console.warn('Failed to read recipe file', recipe.relativePath, err);
    return '';
  }
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
