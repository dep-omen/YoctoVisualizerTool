const fs = require('fs');
let code = fs.readFileSync('src/components/ConflictDetector.tsx', 'utf8');

// Change "Overridden By (Silently Ignored)" to "Overridden Layers (Silently Ignored)"
code = code.replace(/Overridden By \(Silently Ignored\)/g, 'Overridden Layers (Silently Ignored)');

// Change "Conflict Type" to "Override Type"
code = code.replace(/Conflict Type/g, 'Override Type');

// Change "No matching recipe conflicts found for your search query."
code = code.replace(/No matching recipe conflicts found/g, 'No matching recipes found');

// Change "No conflicts detected in active layers."
code = code.replace(/No conflicts detected in active layers\./g, 'No overrides or conflicts detected in active layers.');

fs.writeFileSync('src/components/ConflictDetector.tsx', code, 'utf8');
