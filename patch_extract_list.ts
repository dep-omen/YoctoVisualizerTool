const val = "core (>= 12) openembedded-layer (= 3.0)";
const cleaned = val.replace(/\([^)]*\)/g, ' ');
const tokens = cleaned.split(/\s+/).map(t => t.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
console.log(tokens);
