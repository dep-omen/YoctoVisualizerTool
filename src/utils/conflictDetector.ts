import {
  ConflictDetectionResult,
  ConflictItem,
  ConflictType,
  LosingRecipeInfo,
  OrphanBbappend,
  YoctoBuildConfig,
  YoctoLayer,
  YoctoRecipe
} from '../types';
import { parseBbappendFilename, parseRecipeFilename } from './yoctoParser';

interface RecipeEntry {
  layer: YoctoLayer;
  recipe: YoctoRecipe;
  baseName: string;
  version?: string;
  priority: number;
}

/**
 * Scans all parsed layer data and detects:
 * 1. Recipe collisions across multiple layers (with winner, silent overrides, and critical priority ties).
 * 2. Orphan .bbappend files that target recipes not present in any active layer.
 */
export function detectYoctoConflicts(config: YoctoBuildConfig): ConflictDetectionResult {
  const activeLayers = config.layers.filter(l => !l.isMissing && !l.isGhost);
  const recipeMap = new Map<string, RecipeEntry[]>();
  const allKnownRecipeBaseNames = new Set<string>();

  // 1. Index all recipes from active layers
  for (const layer of activeLayers) {
    const layerPriority = layer.priority !== undefined ? layer.priority : 5;

    for (const recipe of layer.recipes) {
      const parsed = parseRecipeFilename(recipe.filename);
      const baseName = recipe.name || parsed.name;
      const version = recipe.version || parsed.version;

      allKnownRecipeBaseNames.add(baseName.toLowerCase());
      allKnownRecipeBaseNames.add(baseName);

      const entry: RecipeEntry = {
        layer,
        recipe,
        baseName,
        version,
        priority: layerPriority
      };

      const key = baseName.toLowerCase();
      if (!recipeMap.has(key)) {
        recipeMap.set(key, []);
      }
      recipeMap.get(key)!.push(entry);
    }
  }

  const conflicts: ConflictItem[] = [];

  // 2. Identify collisions across distinct layers
  for (const [key, entries] of recipeMap.entries()) {
    // Check if at least 2 distinct layers provide this recipe
    const distinctLayers = new Set(entries.map(e => e.layer.id || e.layer.name));
    if (distinctLayers.size < 2) {
      continue;
    }

    // Sort entries by priority descending (highest priority wins)
    const sorted = [...entries].sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Stable secondary sort: layer name, then version descending
      if (a.layer.name !== b.layer.name) {
        return a.layer.name.localeCompare(b.layer.name);
      }
      return (b.version || '').localeCompare(a.version || '');
    });

    const winner = sorted[0];
    const topPriority = winner.priority;

    // Check if there is an equal priority tie between different layers at the top
    const topTiedEntries = sorted.filter(
      e => e.priority === topPriority && (e.layer.id !== winner.layer.id || e.layer.name !== winner.layer.name)
    );
    const isCritical = topTiedEntries.length > 0;

    // Determine conflict type
    let conflictType: ConflictType = 'FORK';
    if (isCritical) {
      conflictType = 'CRITICAL';
    } else {
      const distinctVersions = new Set(sorted.map(e => e.version).filter(Boolean));
      if (distinctVersions.size > 1) {
        conflictType = 'VERSION BUMP';
      } else {
        conflictType = 'FORK';
      }
    }

    // Losing layers & recipes
    const losingLayers: LosingRecipeInfo[] = sorted.slice(1).map(item => ({
      layer: item.layer,
      version: item.version,
      priority: item.priority,
      filename: item.recipe.filename,
      path: `${item.layer.path}/${item.recipe.relativePath}`,
      relativePath: item.recipe.relativePath
    }));

    // Explanation message
    let explanation = '';
    if (isCritical) {
      const allTopLayers = Array.from(
        new Set(sorted.filter(e => e.priority === topPriority).map(e => e.layer.name))
      );
      explanation = `Warning: Multiple layers (${allTopLayers.join(
        ', '
      )}) share the highest priority (${topPriority}). BitBake behavior is undefined and may lead to unpredictable recipe selection!`;
    } else {
      const losingSummary = losingLayers
        .map(l => `${l.layer.name} (priority ${l.priority})`)
        .join(', ');
      explanation = `BitBake will use the version from ${winner.layer.name} (priority ${winner.priority}) and ignore ${losingSummary}.`;
    }

    const recipeDisplay = winner.baseName;

    conflicts.push({
      id: `conflict-${key}`,
      recipeName: recipeDisplay,
      winningLayer: winner.layer,
      winningVersion: winner.version,
      winningPriority: winner.priority,
      winningFilename: winner.recipe.filename,
      winningPath: `${winner.layer.path}/${winner.recipe.relativePath}`,
      winningRelativePath: winner.recipe.relativePath,
      losingLayers,
      type: conflictType,
      isCritical,
      explanation
    });
  }

  // Sort conflicts: Critical first, then by recipe name
  conflicts.sort((a, b) => {
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return a.recipeName.localeCompare(b.recipeName);
  });

  // 3. Scan for orphan .bbappend files (no matching .bb in active layers)
  const orphanBbappends: OrphanBbappend[] = [];

  for (const layer of activeLayers) {
    for (const bbappend of layer.bbappends) {
      const derivedTarget = bbappend.targetRecipe || parseBbappendFilename(bbappend.filename);
      const targetLower = derivedTarget.toLowerCase();

      // Check if target recipe exists in any active layer
      const recipeExists =
        allKnownRecipeBaseNames.has(targetLower) ||
        allKnownRecipeBaseNames.has(derivedTarget);

      if (!recipeExists) {
        orphanBbappends.push({
          id: `orphan-${layer.id}-${bbappend.filename}`,
          filename: bbappend.filename,
          layer,
          targetRecipe: derivedTarget,
          category: bbappend.category || 'recipes-unknown',
          relativePath: bbappend.relativePath,
          fullPath: `${layer.path}/${bbappend.relativePath}`
        });
      }
    }
  }

  // Calculate statistics
  const totalConflicts = conflicts.length;
  const silentOverrides = conflicts.reduce((sum, c) => sum + c.losingLayers.length, 0);
  const criticalConflicts = conflicts.filter(c => c.isCritical).length;
  const totalOrphans = orphanBbappends.length;

  return {
    conflicts,
    orphanBbappends,
    stats: {
      totalConflicts,
      silentOverrides,
      criticalConflicts,
      orphanBbappends: totalOrphans
    }
  };
}
