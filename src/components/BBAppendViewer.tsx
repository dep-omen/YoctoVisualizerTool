import React, { useState, useMemo, useEffect } from 'react';
import { YoctoBuildConfig, YoctoLayer, YoctoRecipe, YoctoBbappend } from '../types';
import { Search, Loader2, AlertCircle, FileCode, Layers, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { readYoctoFile } from '../utils/recipeParser';
import { parseBbFile, BbItem } from '../utils/bbParser';

interface BBAppendViewerProps {
  config: YoctoBuildConfig | null;
  rootHandle: any;
  onBbappendCountChange?: (count: number, orphans: number) => void;
  initialFilterLayer?: string | null;
}

interface BbappendEntry {
  bbappend: YoctoBbappend;
  layer: YoctoLayer;
  targetRecipe?: YoctoRecipe;
  targetLayer?: YoctoLayer;
  status: 'VALID' | 'ORPHAN' | 'OVERRIDE';
}

const SyntaxHighlighted: React.FC<{ text: string, highlights?: Map<number, 'green' | 'amber' | 'red'> }> = ({ text, highlights }) => {
  const lines = text.split('\n');
  return (
    <pre className="font-mono text-xs text-[var(--text-primary)] w-full">
      {lines.map((line, i) => {
        let bg = 'bg-transparent';
        if (highlights && highlights.has(i)) {
          const type = highlights.get(i);
          if (type === 'green') bg = 'bg-[#28a74526]'; // 15% opacity green
          else if (type === 'amber') bg = 'bg-[#ffc10726]';
          else if (type === 'red') bg = 'bg-[#dc354526]';
        }

        // Extremely simple syntax highlighting
        let renderedLine: React.ReactNode = line;
        
        if (line.trim().startsWith('#')) {
          renderedLine = <span className="text-[#6a737d]">{line}</span>;
        } else {
          // highlight strings
          const parts = line.split(/("[^"]*")/g);
          renderedLine = parts.map((part, idx) => {
            if (part.startsWith('"') && part.endsWith('"')) {
              return <span key={idx} className="text-[#9ecbff]">{part}</span>;
            }
            
            // Highlight variable assignment start
            const varMatch = part.match(/^([a-zA-Z0-9_$-]+(?::[a-zA-Z0-9_-]+)*)(\s*[?+:]*=)/);
            if (varMatch && idx === 0) {
               return (
                 <span key={idx}>
                   <span className="text-[#79b8ff]">{varMatch[1]}</span>
                   {varMatch[2]}
                   {part.substring(varMatch[0].length)}
                 </span>
               );
            }
            
            // Highlight function def start
            const fnMatch = part.match(/^([a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)*)(\s*\(\)\s*\{)/);
            if (fnMatch && idx === 0) {
               return (
                 <span key={idx}>
                   <span className="text-[#b392f0]">{fnMatch[1]}</span>
                   {fnMatch[2]}
                   {part.substring(fnMatch[0].length)}
                 </span>
               );
            }
            
            return <span key={idx}>{part}</span>;
          });
        }
        
        return <div key={i} className={`px-4 py-0.5 whitespace-pre ${bg}`}>{renderedLine || ' '}</div>;
      })}
    </pre>
  );
};

// Next chunk of code...

export const BBAppendViewer: React.FC<BBAppendViewerProps> = ({ config, rootHandle, onBbappendCountChange, initialFilterLayer }) => {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'ORPHAN' | 'OVERRIDE'>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<BbappendEntry | null>(null);

  const [recipeContent, setRecipeContent] = useState<string>('');
  const [bbappendContent, setBbappendContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Build recipe index and bbappend list
  const { entries, validCount, orphanCount, overrideCount } = useMemo(() => {
    if (!config) return { entries: [], validCount: 0, orphanCount: 0, overrideCount: 0 };

    const recipeIndex = new Map<string, { layer: YoctoLayer, recipe: YoctoRecipe, priority: number }>();
    config.layers.forEach(layer => {
      if (layer.isMissing) return;
      layer.recipes.forEach(recipe => {
        const priority = layer.priority || 0;
        const existing = recipeIndex.get(recipe.name);
        if (!existing || priority > existing.priority) {
          recipeIndex.set(recipe.name, { layer, recipe, priority });
        }
      });
    });

    const allEntries: BbappendEntry[] = [];
    let vc = 0, oc = 0, ovc = 0;

    config.layers.forEach(layer => {
      if (layer.isMissing) return;
      layer.bbappends.forEach(bba => {
        const target = recipeIndex.get(bba.targetRecipe);
        let status: 'VALID' | 'ORPHAN' | 'OVERRIDE' = 'ORPHAN';
        
        if (target) {
          if (target.layer.name === layer.name) {
            status = 'VALID';
            vc++;
          } else {
            status = 'OVERRIDE';
            ovc++;
          }
        } else {
          oc++;
        }

        allEntries.push({
          bbappend: bba,
          layer,
          targetRecipe: target?.recipe,
          targetLayer: target?.layer,
          status
        });
      });
    });
    
    // Initial sort
    allEntries.sort((a, b) => a.bbappend.filename.localeCompare(b.bbappend.filename));

    return { entries: allEntries, validCount: vc, orphanCount: oc, overrideCount: ovc };
  }, [config]);

  // Update counts on load
  useEffect(() => {
    if (onBbappendCountChange) {
      onBbappendCountChange(entries.length, orphanCount);
    }
  }, [entries.length, orphanCount, onBbappendCountChange]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (initialFilterLayer && e.layer.name !== initialFilterLayer) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        if (!e.bbappend.filename.toLowerCase().includes(q) && 
            !e.layer.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filterText, statusFilter, initialFilterLayer]);

  // Handle selection
  useEffect(() => {
    const loadContents = async () => {
      if (!selectedEntry || !rootHandle) {
        setRecipeContent('');
        setBbappendContent('');
        return;
      }
      setIsLoading(true);
      
      const bbaContent = await readYoctoFile(rootHandle, selectedEntry.layer.absolutePath || '', selectedEntry.bbappend.relativePath);
      setBbappendContent(bbaContent);

      if (selectedEntry.targetLayer && selectedEntry.targetRecipe) {
        const rContent = await readYoctoFile(rootHandle, selectedEntry.targetLayer.absolutePath || '', selectedEntry.targetRecipe.relativePath);
        setRecipeContent(rContent);
      } else {
        setRecipeContent('');
      }
      
      setIsLoading(false);
    };
    
    loadContents();
  }, [selectedEntry, rootHandle]);

// ... next chunk

  // Diff Analysis
  const { recipeHighlights, bbappendHighlights, changes } = useMemo(() => {
    const rh = new Map<number, 'green' | 'amber' | 'red'>();
    const bh = new Map<number, 'green' | 'amber' | 'red'>();
    const chgs: { label: string, desc: string }[] = [];

    if (!bbappendContent) return { recipeHighlights: rh, bbappendHighlights: bh, changes: chgs };

    const bbaParsed = parseBbFile(bbappendContent);
    const recParsed = recipeContent ? parseBbFile(recipeContent) : new Map();

    bbaParsed.forEach((items, name) => {
      items.forEach(item => {
        const targetItems = recParsed.get(name);
        
        // Mark bbappend lines
        for (let i = item.startLine; i <= item.endLine; i++) {
           bh.set(i, item.op.includes('append') || item.op.includes('+') ? 'green' : 'amber');
        }

        if (item.type === 'variable') {
          if (name === 'SRC_URI' && (item.op.includes('+') || item.op.includes('append'))) {
             const files = item.value.match(/file:\/\/[^\s"]+/g) || [];
             chgs.push({ label: `Adds ${files.length} patch/file(s)`, desc: `Extends SRC_URI with local files.` });
          } else if (name === 'DEPENDS') {
             chgs.push({ label: `Compile dependency`, desc: `${item.op.includes('+')||item.op.includes('append') ? 'Adds' : 'Overrides'} DEPENDS: ${item.value}` });
          } else if (name.startsWith('RDEPENDS')) {
             chgs.push({ label: `Runtime dependency`, desc: `${item.op.includes('+')||item.op.includes('append') ? 'Adds' : 'Overrides'} runtime package: ${item.value}` });
          } else if (name === 'LICENSE') {
             chgs.push({ label: `Changes license`, desc: `Review required: changes to ${item.value}` });
          } else if (name.startsWith('FILESEXTRAPATHS')) {
             chgs.push({ label: `Adds local file search path`, desc: `Likely adding patch files or config overrides` });
          } else {
             if (item.op.includes('+') || item.op.includes('append')) {
                chgs.push({ label: `Appends to ${name}`, desc: `Adds: ${item.value}` });
             } else {
                chgs.push({ label: `Overrides ${name}`, desc: `Changes value completely` });
             }
          }
          
          if (targetItems && !item.op.includes('+') && !item.op.includes('append')) {
             // It's an override, mark the original as red
             targetItems.forEach(tItem => {
                for(let i = tItem.startLine; i <= tItem.endLine; i++) rh.set(i, 'red');
             });
          }
        } else if (item.type === 'function') {
          if (item.op.includes('append') || item.name.includes(':append')) {
             chgs.push({ label: `Appends to ${item.name.replace(':append', '')}()`, desc: `Extends upstream logic` });
          } else {
             chgs.push({ label: `Overrides ${item.name}()`, desc: `Replaces upstream logic completely` });
             if (targetItems) {
                targetItems.forEach(tItem => {
                   for(let i = tItem.startLine; i <= tItem.endLine; i++) rh.set(i, 'red');
                });
             }
          }
        }
      });
    });

    return { recipeHighlights: rh, bbappendHighlights: bh, changes: chgs };
  }, [recipeContent, bbappendContent]);

// ... next chunk
  return (
    <div className="flex-1 flex h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* Left panel: List */}
      <div className="w-[25%] min-w-[300px] border-r border-[var(--border)] bg-[var(--bg-panel)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-blue-400" />
            BBAppend List
          </h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter by recipe or layer..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded py-1.5 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['ALL', 'VALID', 'ORPHAN', 'OVERRIDE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded border ${statusFilter === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] mt-3 font-mono">
            <span className="text-green-400">Valid: {validCount}</span>
            <span className="text-red-400">Orphan: {orphanCount}</span>
            <span className="text-amber-400">Override: {overrideCount}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEntries.map(e => (
            <button
              key={`${e.layer.name}-${e.bbappend.filename}`}
              onClick={() => setSelectedEntry(e)}
              className={`w-full text-left p-2 rounded flex flex-col gap-1.5 transition ${selectedEntry === e ? 'bg-blue-900/30 border border-blue-500/50' : 'hover:bg-gray-800 border border-transparent'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-mono text-[var(--text-primary)] truncate">{e.bbappend.filename}</span>
                {e.status === 'VALID' && <div className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 text-[9px] font-bold">VALID</div>}
                {e.status === 'ORPHAN' && <div className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 text-[9px] font-bold">ORPHAN</div>}
                {e.status === 'OVERRIDE' && <div className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 text-[9px] font-bold">OVERRIDE</div>}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Layers className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{e.layer.name}</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[100px]">{e.bbappend.targetRecipe}</span>
              </div>
            </button>
          ))}
          {filteredEntries.length === 0 && (
             <div className="p-4 text-center text-sm text-[var(--text-muted)]">No matching bbappends found.</div>
          )}
        </div>
      </div>

      {/* Center panel: Original Recipe */}
      <div className="w-[40%] min-w-[300px] border-r border-[var(--border)] bg-[var(--bg-primary)] flex flex-col">
        {selectedEntry ? (
          <>
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-panel)] shrink-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Target Recipe</h3>
              {selectedEntry.targetRecipe ? (
                 <div className="text-xs text-[var(--text-muted)] font-mono break-all">{selectedEntry.targetRecipe.relativePath}</div>
              ) : (
                 <div className="text-xs text-red-400 font-mono">Not found</div>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-[var(--bg-primary)] relative">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
              ) : selectedEntry.targetRecipe ? (
                <SyntaxHighlighted text={recipeContent} highlights={recipeHighlights} />
              ) : (
                <div className="p-6">
                  <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-lg">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertCircle className="w-5 h-5 text-red-400" />
                       <h4 className="font-bold text-red-400">Target recipe not found</h4>
                     </div>
                     <p className="text-sm text-[var(--text-primary)] mb-2">Looking for a recipe matching: <span className="font-mono bg-black/30 px-1 rounded">{selectedEntry.bbappend.targetRecipe}</span></p>
                     <p className="text-xs text-[var(--text-muted)]">This bbappend might be orphaned, or the layer was written for a different Yocto configuration/release where this recipe existed.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600"><FileCode className="w-8 h-8 opacity-20" /></div>
        )}
      </div>

      {/* Right panel: BBAppend & Summary */}
      <div className="w-[35%] min-w-[250px] bg-[var(--bg-primary)] flex flex-col">
        {selectedEntry ? (
          <>
            <div className="flex-1 overflow-auto bg-[var(--bg-primary)] relative border-b border-[var(--border)]">
               {isLoading ? (
                 <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
               ) : (
                 <SyntaxHighlighted text={bbappendContent} highlights={bbappendHighlights} />
               )}
            </div>
            
            <div className="h-[40%] min-h-[250px] bg-[var(--bg-panel)] p-4 flex flex-col shrink-0">
               <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4 text-amber-400" />
                 Change Summary
               </h3>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                 {changes.length > 0 ? changes.map((c, i) => (
                   <div key={i} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-3">
                     <div className="text-xs font-bold text-amber-400 mb-1">{c.label}</div>
                     <div className="text-xs text-[var(--text-primary)]">{c.desc}</div>
                     <div className="mt-2 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        by {selectedEntry.layer.name}
                     </div>
                   </div>
                 )) : (
                   <div className="text-sm text-[var(--text-muted)] italic">No significant variable or function changes detected.</div>
                 )}
               </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
