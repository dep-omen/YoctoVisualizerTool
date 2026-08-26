export function createVirtualFileSystem(files: FileList | File[]): any {
  const fileArray = files instanceof FileList ? Array.from(files) : files;
  if (fileArray.length === 0) throw new Error("No files selected.");

  // Get the root directory name from the first file's webkitRelativePath
  const firstPath = fileArray[0].webkitRelativePath || fileArray[0].name;
  const rootName = firstPath.split('/')[0] || 'root';

  interface VDir {
    kind: 'directory';
    name: string;
    children: Map<string, VDir | VFile>;
  }

  interface VFile {
    kind: 'file';
    name: string;
    file: File;
  }

  const root: VDir = { kind: 'directory', name: rootName, children: new Map() };

  for (const file of fileArray) {
    if (!file.webkitRelativePath) continue;
    
    // Ignore hidden files like .DS_Store
    if (file.name === '.DS_Store' || file.name.startsWith('._')) continue;
    
    const pathParts = file.webkitRelativePath.split('/');
    let currentDir = root;
    
    // Build directory tree (skip the root name part at index 0)
    for (let j = 1; j < pathParts.length - 1; j++) {
      const part = pathParts[j];
      if (!currentDir.children.has(part)) {
        currentDir.children.set(part, { kind: 'directory', name: part, children: new Map() });
      }
      currentDir = currentDir.children.get(part) as VDir;
    }
    
    const fileName = pathParts[pathParts.length - 1];
    if (fileName) {
      currentDir.children.set(fileName, { kind: 'file', name: fileName, file });
    }
  }

  function createDirHandle(vdir: VDir): any {
    return {
      kind: 'directory',
      name: vdir.name,
      getFileHandle: async (name: string) => {
        const child = vdir.children.get(name);
        if (!child || child.kind !== 'file') throw new Error(`NotFoundError: ${name}`);
        return createFileHandle(child);
      },
      getDirectoryHandle: async (name: string) => {
        const child = vdir.children.get(name);
        if (!child || child.kind !== 'directory') throw new Error(`NotFoundError: ${name}`);
        return createDirHandle(child);
      },
      entries: async function* () {
        for (const [name, child] of vdir.children.entries()) {
          yield [name, child.kind === 'directory' ? createDirHandle(child) : createFileHandle(child)];
        }
      }
    };
  }

  function createFileHandle(vfile: VFile): any {
    return {
      kind: 'file',
      name: vfile.name,
      getFile: async () => vfile.file
    };
  }

  return createDirHandle(root);
}
