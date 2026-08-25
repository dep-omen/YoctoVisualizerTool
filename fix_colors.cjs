const fs = require('fs');
const path = require('path');

function replaceColorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Background replacements
  content = content.replace(/bg-\[#090c10\]/g, 'bg-[var(--bg-secondary)]');
  content = content.replace(/bg-\[#010409\]/g, 'bg-[var(--bg-secondary)]');
  content = content.replace(/bg-[#0d1117]/g, 'bg-[var(--bg-primary)]');
  content = content.replace(/bg-\[#0d1117\]/g, 'bg-[var(--bg-primary)]');
  
  content = content.replace(/bg-gray-800\/60/g, 'bg-[var(--bg-tertiary)]');
  content = content.replace(/bg-gray-800\/80/g, 'bg-[var(--bg-tertiary)]');
  content = content.replace(/bg-gray-800\/50/g, 'bg-[var(--bg-tertiary)]');
  content = content.replace(/bg-gray-800\/40/g, 'bg-[var(--bg-tertiary)]');
  content = content.replace(/bg-gray-800\/30/g, 'bg-[var(--bg-tertiary)]');
  content = content.replace(/bg-gray-800/g, 'bg-[var(--bg-tertiary)]');
  
  content = content.replace(/bg-gray-900/g, 'bg-[var(--bg-secondary)]');
  content = content.replace(/bg-gray-700/g, 'bg-[var(--border-strong)]');

  // Text colors
  content = content.replace(/text-gray-100/g, 'text-[var(--text-primary)]');
  content = content.replace(/text-[#c9d1d9]/g, 'text-[var(--text-primary)]');
  content = content.replace(/text-\[#c9d1d9\]/g, 'text-[var(--text-primary)]');
  content = content.replace(/text-white/g, 'text-[var(--text-primary)]');
  
  // Specific semantic color mappings that are safe (avoid mapping all grays blindly, but we can do a few)
  content = content.replace(/text-gray-600/g, 'text-[var(--text-muted)]');
  content = content.replace(/border-gray-600\/40/g, 'border-[var(--border)]');
  content = content.replace(/border-gray-600/g, 'border-[var(--border)]');
  content = content.replace(/border-gray-500/g, 'border-[var(--border-strong)]');

  // Ensure index.html doesn't have hardcoded class="dark"
  if (filePath.endsWith('index.html')) {
    content = content.replace(/class="dark"/g, '');
    content = content.replace(/class="bg-\[#0d1117\] text-\[#c9d1d9\]"/g, '');
  }

  if (original !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        walkDir(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.html') || fullPath.endsWith('.cjs')) {
      replaceColorsInFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
walkDir(path.join(__dirname, 'electron'));
replaceColorsInFile(path.join(__dirname, 'index.html'));
