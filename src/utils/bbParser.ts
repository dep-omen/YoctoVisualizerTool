export interface BbItem {
  type: 'variable' | 'function';
  name: string;
  op: string;
  value: string;
  startLine: number;
  endLine: number;
  lines: string[];
}

export function parseBbFile(content: string): Map<string, BbItem[]> {
  const items = new Map<string, BbItem[]>();
  
  const lines = content.split('\n');
  let currentItem: BbItem | null = null;
  let inFunction = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Continuation of a multiline variable
    if (currentItem && currentItem.type === 'variable' && currentItem.value.endsWith('\\')) {
      currentItem.value = currentItem.value.slice(0, -1) + ' ' + trimmed;
      currentItem.endLine = i;
      currentItem.lines.push(line);
      
      // If this line does not end with '\', the variable is done
      if (!trimmed.endsWith('\\')) {
         // Push to map
         const existing = items.get(currentItem.name) || [];
         existing.push(currentItem);
         items.set(currentItem.name, existing);
         currentItem = null;
      }
      continue;
    }
    
    // Continuation of a function
    if (currentItem && currentItem.type === 'function' && inFunction) {
      currentItem.value += '\n' + line;
      currentItem.endLine = i;
      currentItem.lines.push(line);
      if (trimmed === '}') {
         inFunction = false;
         const existing = items.get(currentItem.name) || [];
         existing.push(currentItem);
         items.set(currentItem.name, existing);
         currentItem = null;
      }
      continue;
    }
    
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Variable assignment: VAR = "x", VAR += "x", VAR:append = "x", etc.
    const varMatch = line.match(/^([a-zA-Z0-9_$-]+(?::[a-zA-Z0-9_-]+)*)\s*([?+:]*=)\s*(.*)$/);
    if (varMatch) {
      const name = varMatch[1];
      const op = varMatch[2];
      const val = varMatch[3];
      
      currentItem = {
        type: 'variable',
        name,
        op,
        value: val,
        startLine: i,
        endLine: i,
        lines: [line]
      };
      
      if (!val.endsWith('\\')) {
         const existing = items.get(currentItem.name) || [];
         existing.push(currentItem);
         items.set(currentItem.name, existing);
         currentItem = null;
      }
      continue;
    }
    
    // Function definition: do_install() {, do_install:append() {
    const fnMatch = line.match(/^([a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*)\s*\(\)\s*\{/);
    if (fnMatch) {
      const name = fnMatch[1];
      inFunction = true;
      currentItem = {
        type: 'function',
        name,
        op: '()',
        value: line,
        startLine: i,
        endLine: i,
        lines: [line]
      };
      // Single line function edge case: do_install() { echo "hi"; }
      if (trimmed.endsWith('}')) {
         inFunction = false;
         const existing = items.get(currentItem.name) || [];
         existing.push(currentItem);
         items.set(currentItem.name, existing);
         currentItem = null;
      }
      continue;
    }
  }
  
  return items;
}
