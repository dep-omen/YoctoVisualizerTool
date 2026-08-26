const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `      const virtualDirHandle = createVirtualFileSystem(files);
      await processDirectoryHandle(virtualDirHandle);`;

const replacement = `      if (files.length > 0 && files.length < 50) {
        setErrorMessage(\`Warning: The browser only loaded \${files.length} files. Embedded iframes often silently truncate large folder uploads. Please open this app in a dedicated new tab for full Yocto parsing.\`);
      }
      const virtualDirHandle = createVirtualFileSystem(files);
      await processDirectoryHandle(virtualDirHandle);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code, 'utf8');
  console.log("Patched App.tsx with warning");
} else {
  console.log("Target not found");
}
