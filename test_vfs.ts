import { createVirtualFileSystem } from './src/utils/virtualFileSystem.ts';

class MockFile {
  name: string;
  webkitRelativePath: string;
  constructor(name: string, path: string) {
    this.name = name;
    this.webkitRelativePath = path;
  }
}

const files = [
  new MockFile('layer.conf', 'poky/meta/conf/layer.conf'),
  new MockFile('bblayers.conf', 'poky/build/conf/bblayers.conf'),
] as any[];

globalThis.FileList = class FileList {} as any; // mock
const root = createVirtualFileSystem(files);

async function findFileByPath(
  rootDirHandle: any,
  segments: string[]
): Promise<any | null> {
  try {
    let currentDir = rootDirHandle;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (seg === '.' || seg === '..') continue;
      currentDir = await currentDir.getDirectoryHandle(seg);
    }
    const fileName = segments[segments.length - 1];
    const fileHandle = await currentDir.getFileHandle(fileName);
    return fileHandle;
  } catch (err) {
    console.error(err);
    return null;
  }
}

findFileByPath(root, ['build', 'conf', 'bblayers.conf']).then(res => {
  console.log("Result:", res ? "Found" : "Not Found");
});
