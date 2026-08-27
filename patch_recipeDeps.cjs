const fs = require('fs');
let code = fs.readFileSync('src/utils/recipeParser.ts', 'utf8');

// replace parseRecipeDeps
code = code.replace(/export function parseRecipeDeps[\s\S]*?\{[\s\S]*?const lines = content[\s\S]*?\.filter\(Boolean\);/, `import { cleanBitbakeText } from './yoctoParser';\n\n$&`);

// Wait, the regex above will fail if we don't do it carefully.
