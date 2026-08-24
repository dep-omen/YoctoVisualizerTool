import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { YoctoBuildConfig, YoctoLayer, YoctoRecipe } from '../types';
import * as d3 from 'd3';
import { Search, Loader2, AlertCircle, Layers, FileCode } from 'lucide-react';
import { readRecipeContent, parseRecipeDeps } from '../utils/recipeParser';

interface PackageTracerProps {
  config: YoctoBuildConfig | null;
  rootHandle: any;
  onTraceCountChange?: (count: number) => void;
}

interface TraceNode {
  id: string; // package base name e.g. "openssl"
  recipe?: YoctoRecipe;
  layer?: YoctoLayer;
  version?: string;
  isVirtual: boolean;
  isExternal: boolean;
  isCycle: boolean;
  depends: string[];
  rdepends: string[];
  description?: string;
  license?: string;
  children: TraceNode[];
  type: 'DEPENDS' | 'RDEPENDS' | 'ROOT';
  conflicts?: { layer: YoctoLayer, version?: string, priority: number }[];
  expanded: boolean;
  depth: number;
  uid: string;
}

export const PackageTracer: React.FC<PackageTracerProps> = ({ config, rootHandle, onTraceCountChange }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDepends, setShowDepends] = useState(true);
  const [showRdepends, setShowRdepends] = useState(true);
  const [maxDepth, setMaxDepth] = useState<number>(2);
  const [isTracing, setIsTracing] = useState(false);
  const [traceStatus, setTraceStatus] = useState('');
  const [traceRoot, setTraceRoot] = useState<TraceNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Build recipe index
  const recipeIndex = useMemo(() => {
    const idx = new Map<string, { layer: YoctoLayer, recipe: YoctoRecipe, priority: number, conflicts?: { layer: YoctoLayer, version?: string, priority: number }[] }>();
    if (!config) return idx;
    config.layers.forEach(layer => {
      if (layer.isMissing) return;
      layer.recipes.forEach(recipe => {
        const priority = layer.priority || 0;
        const existing = idx.get(recipe.name);
        if (!existing) {
          idx.set(recipe.name, { layer, recipe, priority, conflicts: [] });
        } else {
          if (priority > existing.priority) {
            existing.conflicts!.push({ layer: existing.layer, version: existing.recipe.version, priority: existing.priority });
            idx.set(recipe.name, { layer, recipe, priority, conflicts: existing.conflicts });
          } else {
            existing.conflicts!.push({ layer, version: recipe.version, priority });
          }
        }
      });
    });
    return idx;
  }, [config]);

  const allRecipeNames = useMemo(() => Array.from(recipeIndex.keys()).sort(), [recipeIndex]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!searchQuery) {
      setSuggestions([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    setSuggestions(allRecipeNames.filter(n => n.toLowerCase().includes(q)).slice(0, 50));
  }, [searchQuery, allRecipeNames]);

  const handleTrace = async () => {
    if (!searchQuery) return;
    setIsTracing(true);
    setTraceRoot(null);
    setSelectedNode(null);

    const visited = new Set<string>();
    let totalNodes = 0;

    const buildNode = async (
      name: string,
      type: 'DEPENDS' | 'RDEPENDS' | 'ROOT',
      depth: number,
      pathSet: Set<string>
    ): Promise<TraceNode> => {
      totalNodes++;
      if (totalNodes % 10 === 0) setTraceStatus(`Resolving depth ${depth}... (${totalNodes} nodes)`);

      const isVirtual = name.startsWith('virtual/');
      const lookupName = isVirtual ? name.replace('virtual/', '') : name; // simplistic virtual mapping for demo
      
      const entry = recipeIndex.get(name) || recipeIndex.get(lookupName);
      
      const isCycle = pathSet.has(name);
      const isExternal = !entry;
      
      const node: TraceNode = {
        id: name,
        type,
        isVirtual,
        isExternal,
        isCycle,
        depends: [],
        rdepends: [],
        children: [],
        expanded: depth < maxDepth,
        depth,
        uid: `${name}-${depth}-${Math.random().toString(36).substring(2, 9)}`,
        layer: entry?.layer,
        recipe: entry?.recipe,
        version: entry?.recipe.version,
        conflicts: entry?.conflicts && entry.conflicts.length > 0 ? entry.conflicts : undefined
      };

      if (totalNodes > 200) {
         node.children = [];
         node.expanded = false;
         if (totalNodes === 201) {
            setTraceStatus(`Warning: Dependency chain is very large — showing first 200 packages`);
         }
         return node;
      }

      if (isCycle || isExternal || depth >= maxDepth) {
        return node;
      }

      if (entry && rootHandle) {
        const content = await readRecipeContent(rootHandle, entry.layer, entry.recipe);
        const deps = parseRecipeDeps(content, entry.recipe.name);
        node.depends = deps.depends;
        node.rdepends = deps.rdepends;
        node.description = deps.description;
        node.license = deps.license;
        if (deps.pv) node.version = deps.pv;

        const newPathSet = new Set(pathSet);
        newPathSet.add(name);

        const childrenPromises: Promise<TraceNode>[] = [];
        if (showDepends) {
          for (const d of node.depends) childrenPromises.push(buildNode(d, 'DEPENDS', depth + 1, newPathSet));
        }
        if (showRdepends) {
          for (const d of node.rdepends) childrenPromises.push(buildNode(d, 'RDEPENDS', depth + 1, newPathSet));
        }
        node.children = await Promise.all(childrenPromises);
      }
      return node;
    };

    try {
      const root = await buildNode(searchQuery, 'ROOT', 0, new Set());
      setTraceRoot(root);
      setSelectedNode(root);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTracing(false);
      setTraceStatus('');
    }
  };

  // Render tree with D3
  useEffect(() => {
    if (!traceRoot || !svgRef.current || !containerRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const root = d3.hierarchy(traceRoot, d => d.expanded ? d.children : null);
    
    // Dynamic node height based on depth to spread out dense graphs
    const dx = 30; 
    const dy = width / (root.height + 2);
    
    const tree = d3.tree<TraceNode>().nodeSize([dx, dy]);
    tree(root);

    let x0 = Infinity, x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', e => g.attr('transform', e.transform));
    
    svg.call(zoom as any);

    const g = svg.append('g');
    
    svg.call(zoom.transform as any, d3.zoomIdentity.translate(dy, height / 2 - (x0 + x1) / 2).scale(0.8));

    // Links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(root.links())
      .join('path')
      .attr('stroke', d => d.target.data.type === 'RDEPENDS' ? '#10b981' : '#3b82f6')
      .attr('stroke-dasharray', d => d.target.data.type === 'RDEPENDS' ? '4,4' : 'none')
      .attr('d', d3.linkHorizontal<any, any>().x(d => d.y).y(d => d.x));

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Circle
    node.append('circle')
      .attr('fill', d => {
        if (d.data.isExternal) return '#ef4444';
        if (d.data.isVirtual) return '#a855f7';
        return '#3b82f6';
      })
      .attr('r', 5)
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (e, d) => setSelectedNode(d.data));

    // Label
    node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -8 : 8)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.data.id + (d.data.version ? ` @ ${d.data.version}` : ''))
      .attr('fill', d => d.data.isExternal ? '#ef4444' : '#c9d1d9')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .style('cursor', 'pointer')
      .on('click', (e, d) => setSelectedNode(d.data));
      
    // Badges
    node.each(function(d) {
      if (d.data.isCycle) {
        d3.select(this).append('text')
          .attr('dy', '0.31em')
          .attr('x', d.children ? -8 : 8)
          .attr('y', 12)
          .attr('text-anchor', d.children ? 'end' : 'start')
          .text('(cycle)')
          .attr('fill', '#ef4444')
          .attr('font-size', '8px');
      }
      if (d.data.children.length > 0 && !d.data.expanded) {
         d3.select(this).append('text')
          .attr('dy', '0.31em')
          .attr('x', d.children ? -8 : 8)
          .attr('y', -12)
          .attr('text-anchor', d.children ? 'end' : 'start')
          .text(`+${d.data.children.length}`)
          .attr('fill', '#3b82f6')
          .attr('font-size', '8px');
      }
    });

  }, [traceRoot]);

  // Rootfs Impact
  const impactSummary = useMemo(() => {
    if (!traceRoot) return null;
    const unique = new Set<string>();
    const byLayer = new Map<string, number>();
    
    const traverse = (node: TraceNode) => {
      unique.add(node.id);
      if (node.layer) {
        byLayer.set(node.layer.name, (byLayer.get(node.layer.name) || 0) + 1);
      }
      if (node.expanded) {
        node.children.forEach(traverse);
      }
    };
    traverse(traceRoot);
    
    const summary = {
      total: unique.size,
      byLayer: Array.from(byLayer.entries()).sort((a,b) => b[1] - a[1]),
      list: Array.from(unique).sort()
    };
    
    if (onTraceCountChange) {
      onTraceCountChange(summary.total);
    }
    
    return summary;
  }, [traceRoot]);

  // Reset count when search query is cleared
  useEffect(() => {
    if (!searchQuery && onTraceCountChange) {
      onTraceCountChange(0);
    }
  }, [searchQuery, onTraceCountChange]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-panel)] shrink-0 z-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search for a recipe or package name (e.g. openssh)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTrace()}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-md py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {suggestions.length > 0 && searchQuery && suggestions[0] !== searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-[var(--bg-panel)] border border-[var(--border)] rounded-md  z-50">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSearchQuery(s); setSuggestions([]); }}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-blue-600/20 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-primary)]">
                <input type="checkbox" checked={showDepends} onChange={e => setShowDepends(e.target.checked)} className="rounded border-[var(--border)] bg-gray-900" />
                DEPENDS (compile-time)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-primary)]">
                <input type="checkbox" checked={showRdepends} onChange={e => setShowRdepends(e.target.checked)} className="rounded border-[var(--border)] bg-gray-900" />
                RDEPENDS (runtime)
              </label>
              <select
                value={maxDepth}
                onChange={e => setMaxDepth(Number(e.target.value))}
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)]"
              >
                <option value={2}>Max depth: 2</option>
                <option value={3}>Max depth: 3</option>
                <option value={4}>Max depth: 4</option>
                <option value={999}>Max depth: unlimited</option>
              </select>
            </div>
            <button
              onClick={handleTrace}
              disabled={!searchQuery || isTracing}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition flex items-center gap-2"
            >
              {isTracing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Trace Package
            </button>
          </div>
        </div>
      </div>

      {!traceRoot && !isTracing && (
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <FileCode className="w-12 h-12 mb-4 opacity-50" />
          <p>Search for a package to trace its dependency chain.</p>
        </div>
      )}

      {isTracing && (
        <div className="flex-1 flex flex-col items-center justify-center text-blue-400">
          <Loader2 className="w-8 h-8 mb-4 animate-spin" />
          <p>{traceStatus || 'Tracing dependencies...'}</p>
        </div>
      )}

      {traceRoot && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: Info */}
          <div className="w-[40%] min-w-[300px] border-r border-[var(--border)] bg-[var(--bg-primary)] overflow-y-auto p-4">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                      {selectedNode.id}
                      {selectedNode.version && <span className="text-sm font-normal text-[var(--text-muted)]">@{selectedNode.version}</span>}
                    </h2>
                    {selectedNode.layer && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded text-xs font-mono mt-2">
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[var(--text-primary)]">{selectedNode.layer.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedNode.isExternal && (
                  <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-red-400">Package not found</h4>
                      <p className="text-xs text-red-300/70 mt-1">
                        This package could not be found in any of the active layers. It might be provided by a layer you haven't included.
                      </p>
                    </div>
                  </div>
                )}

                {selectedNode.conflicts && selectedNode.conflicts.length > 0 && (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-400">Multiple Layers Provide This</h4>
                      <p className="text-xs text-amber-300/70 mt-1 mb-2">
                        This package is also provided by the following layers, but <strong className="text-amber-200">{selectedNode.layer?.name}</strong> wins due to higher layer priority.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.conflicts.map((c, i) => (
                           <span key={i} className="text-[10px] font-mono bg-amber-900/40 text-amber-200 px-1.5 py-0.5 rounded border border-amber-700/50">
                             {c.layer.name} (pri {c.priority})
                           </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedNode.description && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Description</h3>
                    <p className="text-sm text-[var(--text-primary)]">{selectedNode.description}</p>
                  </div>
                )}

                {selectedNode.license && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">License</h3>
                    <p className="text-sm font-mono text-[var(--text-primary)] bg-gray-800/50 inline-block px-2 py-0.5 rounded">{selectedNode.license}</p>
                  </div>
                )}
                
                {selectedNode.recipe && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Path</h3>
                    <p className="text-xs font-mono text-[var(--text-muted)] break-all">{selectedNode.recipe.relativePath}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
                    DEPENDS ({selectedNode.depends.length})
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.depends.map(d => (
                      <span key={d} className="px-2 py-1 bg-blue-900/20 border border-blue-500/30 rounded text-xs font-mono text-blue-300">
                        {d}
                      </span>
                    ))}
                    {selectedNode.depends.length === 0 && <span className="text-xs text-gray-600 italic">None</span>}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block border-t border-dashed"></span>
                    RDEPENDS ({selectedNode.rdepends.length})
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.rdepends.map(d => (
                      <span key={d} className="px-2 py-1 bg-emerald-900/20 border border-emerald-500/30 rounded text-xs font-mono text-emerald-300">
                        {d}
                      </span>
                    ))}
                    {selectedNode.rdepends.length === 0 && <span className="text-xs text-gray-600 italic">None</span>}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-[var(--text-muted)] text-sm">Click a node in the graph to view details.</div>
            )}
            
            {/* Impact Summary */}
            {impactSummary && (
              <div className="mt-8 pt-6 border-t border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Rootfs Impact Summary</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">Adding <strong className="text-blue-400">{traceRoot.id}</strong> to your image introduces roughly <strong className="text-white">{impactSummary.total}</strong> packages (based on current expansion depth).</p>
                
                <div className="space-y-2 mb-6">
                  {impactSummary.byLayer.map(([layer, count]) => (
                    <div key={layer} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-primary)]">{layer}</span>
                      <span className="text-[var(--text-muted)] font-mono">{count}</span>
                    </div>
                  ))}
                </div>
                
                <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Flat Package List</h4>
                <div className="h-48 overflow-y-auto bg-[var(--bg-panel)] border border-[var(--border)] rounded p-2">
                  <div className="flex flex-col gap-1">
                    {impactSummary.list.map(pkg => (
                      <span key={pkg} className="text-xs font-mono text-[var(--text-muted)] hover:text-white cursor-default">
                        {pkg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Tree */}
          <div className="flex-1 relative bg-[#010409]" ref={containerRef}>
            <svg ref={svgRef} className="w-full h-full cursor-move" />
          </div>
        </div>
      )}
    </div>
  );
}
