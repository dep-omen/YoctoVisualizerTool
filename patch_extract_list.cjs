const fs = require('fs');
let code = fs.readFileSync('src/utils/yoctoParser.ts', 'utf8');

code = code.replace(
  /let val = match\[1\].trim\(\);\s+if \(\(val\.startsWith\('"'\) && val\.endsWith\('"'\)\) \|\| \(val\.startsWith\("'"\) && val\.endsWith\("'"\)\)\) \{\s+val = val\.slice\(1, -1\);\s+\}\s+\/\/ Split by whitespace and strip any enclosed quotes\s+const tokens = val\.split\(\/\\s\+\/\)/,
  `let val = match[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Remove inline bitbake version constraints before splitting (e.g. core (>= 12) -> core)
      val = val.replace(/\\([^)]*\\)/g, ' ');
      // Split by whitespace and strip any enclosed quotes
      const tokens = val.split(/\\s+/)`
);

fs.writeFileSync('src/utils/yoctoParser.ts', code, 'utf8');
