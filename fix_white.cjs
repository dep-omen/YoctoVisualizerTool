const fs = require('fs');
const path = require('path');

function fixWhite(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Revert buttons that should have white text
  content = content.replace(/bg-blue-[0-9]+[^>]+text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));
  content = content.replace(/bg-red-[0-9]+[^>]+text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));
  content = content.replace(/bg-amber-[0-9]+[^>]+text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));
  content = content.replace(/bg-purple-[0-9]+[^>]+text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));
  content = content.replace(/bg-\[var\(--accent\)\][^>]+text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));
  content = content.replace(/bg-blue-600[^>]*text-\[var\(--text-primary\)\]/g, match => match.replace('text-[var(--text-primary)]', 'text-white'));

  fs.writeFileSync(filePath, content, 'utf8');
}

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.tsx')) {
    fixWhite(path.join(dir, file));
  }
}
