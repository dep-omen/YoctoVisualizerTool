const fs = require('fs');
let code = fs.readFileSync('src/components/BuildEstimator.tsx', 'utf8');

const safeCores = '${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}';

code = code.replace(/BB_NUMBER_THREADS = "\$\{cores\}"\\nPARALLEL_MAKE = "-j \$\{cores\}"/g, 
  `BB_NUMBER_THREADS = "${safeCores}"\\nPARALLEL_MAKE = "-j ${safeCores}"`);

// Wait, the block is:
// navigator.clipboard.writeText(`# Build performance settings
// BB_NUMBER_THREADS = "${cores}"
// PARALLEL_MAKE = "-j ${cores}"

code = code.replace(/BB_NUMBER_THREADS = "\$\{cores\}"\nPARALLEL_MAKE = "-j \$\{cores\}"/g, 
  `BB_NUMBER_THREADS = "${safeCores}"\nPARALLEL_MAKE = "-j ${safeCores}"`);

fs.writeFileSync('src/components/BuildEstimator.tsx', code, 'utf8');
