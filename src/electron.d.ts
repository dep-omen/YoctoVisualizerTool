export interface ScanProgressEvent {
  phase: 'finding_conf' | 'parsing_layers' | 'scanning_recipes' | 'done';
  message: string;
  processed?: number;
  total?: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openDirectoryDialog: () => Promise<string | null>;
  scanYoctoProject: (rootPath: string) => Promise<import('./types').YoctoBuildConfig>;
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  showItemInFolder: (fullPath: string) => Promise<boolean>;
  onMenuOpenDirectory: (callback: (dirPath: string) => void) => () => void;
  onCliOpenDirectory: (callback: (dirPath: string) => void) => () => void;
  onMenuLoadDemo: (callback: () => void) => () => void;
  onScanProgress: (callback: (status: ScanProgressEvent) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
