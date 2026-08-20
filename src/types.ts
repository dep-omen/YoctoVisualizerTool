export interface YoctoRecipe {
  name: string;
  filename: string;
  category: string; // e.g. "recipes-kernel", "recipes-bsp", "recipes-core"
  relativePath: string;
  version?: string;
}

export interface YoctoBbappend {
  filename: string;
  targetRecipe: string;
  category: string;
  relativePath: string;
}

export type LayerCategory = 
  | 'core'
  | 'openembedded'
  | 'oe-sublayer'
  | 'st-bsp'
  | 'bsp'
  | 'custom'
  | 'missing'
  | 'ghost';

export type ConflictType = 'VERSION BUMP' | 'FORK' | 'CRITICAL';

export interface LosingRecipeInfo {
  layer: YoctoLayer;
  version?: string;
  priority: number;
  filename: string;
  path: string;
  relativePath: string;
}

export interface ConflictItem {
  id: string;
  recipeName: string;
  winningLayer: YoctoLayer;
  winningVersion?: string;
  winningPriority: number;
  winningFilename: string;
  winningPath: string;
  winningRelativePath: string;
  losingLayers: LosingRecipeInfo[];
  type: ConflictType;
  isCritical: boolean;
  explanation: string;
}

export interface OrphanBbappend {
  id: string;
  filename: string;
  layer: YoctoLayer;
  targetRecipe: string;
  category: string;
  relativePath: string;
  fullPath: string;
}

export interface ConflictDetectionResult {
  conflicts: ConflictItem[];
  orphanBbappends: OrphanBbappend[];
  stats: {
    totalConflicts: number;
    silentOverrides: number;
    criticalConflicts: number;
    orphanBbappends: number;
  };
}

export interface YoctoLayer {
  id: string; // canonical name from BBFILE_COLLECTIONS or folder name
  collectionName: string;
  name: string; // human readable / folder name
  path: string;
  absolutePath?: string;
  priority?: number;
  seriesCompat: string[];
  dependsOn: string[]; // layer collection names
  recommends?: string[];
  recipes: YoctoRecipe[];
  bbappends: YoctoBbappend[];
  recipeCategories: string[];
  categoryType: LayerCategory;
  isMissing: boolean;
  isGhost: boolean; // Not in BBLAYERS but required by a dependency
  layerConfFound: boolean;
  rawLayerConf?: string;
}

export interface YoctoBuildConfig {
  folderName: string;
  bblayersPath: string;
  localConfPath: string;
  machine?: string;
  distro?: string;
  imageInstall?: string[];
  distroFeatures?: string[];
  imageFeatures?: string[];
  packageClasses?: string;
  parallelMake?: string;
  bbNumberThreads?: string;
  layers: YoctoLayer[];
  unmetDependencies: string[];
  activeYoctoRelease?: string;
  stats: {
    totalLayers: number;
    activeLayers: number;
    missingLayers: number;
    ghostLayers: number;
    totalRecipes: number;
    totalBbappends: number;
    totalDependencies: number;
    primaryRelease: string;
  };
}

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  collectionName: string;
  layer: YoctoLayer;
  radius: number;
  categoryType: LayerCategory;
  recipeCount: number;
  bbappendCount: number;
  isGhost: boolean;
  isMissing: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  isGhostLink?: boolean;
}
