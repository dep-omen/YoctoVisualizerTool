const fs = require('fs');
let code = fs.readFileSync('src/components/BuildEstimator.tsx', 'utf8');

// Add useEffect for SSTATE_DIR
code = code.replace(/const \[sstate, setSstate\] = useState\<'Yes'\|'No'\>\('No'\);/, 
  `const [sstate, setSstate] = useState<'Yes'|'No'>('No');\n  useEffect(() => {\n    if (config?.variables?.SSTATE_DIR || config?.variables?.SSTATE_MIRRORS) {\n      setSstate('Yes');\n    }\n  }, [config]);`);

// Fix optimal threading advice
code = code.replace(/Set BB_NUMBER_THREADS and PARALLEL_MAKE in local.conf to match your CPU core count./,
  'Set BB_NUMBER_THREADS and PARALLEL_MAKE based on available RAM (at least 2GB per thread recommended to prevent OOM).');

code = code.replace(/fix: \`BB_NUMBER_THREADS = "\\\$\{cores\}"\\nPARALLEL_MAKE = "-j \\\$\{cores\}"\`/,
  'fix: `BB_NUMBER_THREADS = "${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"\nPARALLEL_MAKE = "-j ${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"`');

code = code.replace(/# Build performance settings — generated\\nBB_NUMBER_THREADS = "\\\$\{cores\}"\\nPARALLEL_MAKE = "-j \\\$\{cores\}"/,
  '# Build performance settings — generated\\nBB_NUMBER_THREADS = "${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"\\nPARALLEL_MAKE = "-j ${Math.min(cores, Math.max(1, Math.floor(ram / 2)))}"');

fs.writeFileSync('src/components/BuildEstimator.tsx', code, 'utf8');
