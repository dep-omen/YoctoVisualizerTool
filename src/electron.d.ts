export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  openDirectoryDialog: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<string>;
  readDir: (dirPath: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>;
  onMenuOpenDirectory: (callback: (dirPath: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
