const fs = require('fs');
const path = require('path');

function fixHighlights(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(/text-blue-300/g, 'text-[var(--text-code-blue)]');
  content = content.replace(/text-blue-400/g, 'text-[var(--text-code-blue)]');
  content = content.replace(/text-amber-300/g, 'text-[var(--text-code-amber)]');
  content = content.replace(/text-amber-400/g, 'text-[var(--text-code-amber)]');
  content = content.replace(/text-purple-300/g, 'text-[var(--text-code-purple)]');
  content = content.replace(/text-red-400/g, 'text-[var(--text-code-red)]');
  content = content.replace(/text-red-500/g, 'text-[var(--text-code-red)]');
  content = content.replace(/text-cyan-400/g, 'text-[var(--text-code-blue)]'); // mapping cyan to blue for code

  if (original !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated highlights in', filePath);
  }
}

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.tsx')) {
    fixHighlights(path.join(dir, file));
  }
}
