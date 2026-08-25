import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GraphLink, GraphNode, LayerCategory, YoctoBuildConfig, YoctoLayer } from '../types';
import { AlertTriangle, X } from 'lucide-react';

export interface LayerGraphRef {
  zoomToFit: () => void;
  exportPng: () => Promise<string | null>;
  selectNodeById: (id: string) => void;
}

interface LayerGraphProps {
  config: YoctoBuildConfig;
  selectedLayer: YoctoLayer | null;
  onSelectLayer: (layer: YoctoLayer) => void;
  searchFilter: string;
  layoutMode?: 'tree' | 'force';
  onLayoutModeChange?: (mode: 'tree' | 'force') => void;
}

const CATEGORY_COLORS: Record<LayerCategory, { fill: string; stroke: string; glow: string; text: string; label: string }> = {
  core: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-core)',
    glow: 'rgba(59, 130, 246, 0.35)',
    text: 'var(--text-primary)',
    label: 'CORE / POKY'
  },
  openembedded: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-oe)',
    glow: 'rgba(20, 184, 166, 0.35)',
    text: 'var(--text-primary)',
    label: 'OPENEMBEDDED'
  },
  'oe-sublayer': {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-oe)',
    glow: 'rgba(6, 182, 212, 0.35)',
    text: 'var(--text-primary)',
    label: 'OE SUBLAYER'
  },
  'st-bsp': {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-bsp)',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: 'var(--text-primary)',
    label: 'BSP / SILICON'
  },
  bsp: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-bsp)',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: 'var(--text-primary)',
    label: 'BSP LAYER'
  },
  custom: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-custom)',
    glow: 'rgba(168, 85, 247, 0.35)',
    text: 'var(--text-primary)',
    label: 'CUSTOM'
  },
  missing: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--danger)',
    glow: 'rgba(239, 68, 68, 0.4)',
    text: 'var(--text-primary)',
    label: 'MISSING'
  },
  ghost: {
    fill: 'var(--bg-panel)',
    stroke: 'var(--node-ghost)',
    glow: 'rgba(239, 68, 68, 0.35)',
    text: 'var(--text-primary)',
    label: 'UNMET'
  }
};

export const LayerGraph = forwardRef<LayerGraphRef, LayerGraphProps>(({
  config,
  selectedLayer,
  onSelectLayer,
  searchFilter,
  layoutMode = 'tree'
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const currentLayoutRef = useRef<'tree' | 'force'>(layoutMode);

  // Expose imperative methods: zoomToFit, exportPng, selectNodeById
  useImperativeHandle(ref, () => ({
    zoomToFit: () => {
      fitGraphView();
    },
    exportPng: async () => {
      return await exportSvgToPng();
    },
    selectNodeById: (id: string) => {
      const target = config.layers.find(l => l.id === id || l.collectionName === id || l.name === id);
      if (target) {
        onSelectLayer(target);
      }
    }
  }));

  const fitGraphView = () => {
    if (!svgRef.current || !gRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    const bounds = gRef.current.getBBox();
    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    if (bounds.width === 0 || bounds.height === 0) return;

    const fullWidth = width;
    const fullHeight = height;
    const padding = 80;

    const dx = bounds.width;
    const dy = bounds.height;
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;

    const scale = Math.max(0.2, Math.min(1.4, 0.85 / Math.max(dx / fullWidth, dy / fullHeight)));
    const translate = [fullWidth / 2 - scale * x, fullHeight / 2 - scale * y];

    svg.transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  };

  const exportSvgToPng = async (): Promise<string | null> => {
    if (!svgRef.current || !gRef.current) return null;
    const svgEl = svgRef.current;
    const width = svgEl.clientWidth || 1200;
    const height = svgEl.clientHeight || 800;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', `${width * 2}`);
    clone.setAttribute('height', `${height * 2}`);
    clone.style.backgroundColor = 'var(--bg-primary)';

    const xml = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-primary').trim() || 'var(--bg-primary)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobURL);

        const pngUrl = canvas.toDataURL('image/png');
        resolve(pngUrl);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = blobURL;
    });
  };

  // Helper for computing link paths depending on layout mode
  const computeLinkPath = (link: GraphLink, mode: 'tree' | 'force'): string => {
    const s = link.source as GraphNode;
    const t = link.target as GraphNode;
    if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return '';

    if (mode === 'tree') {
      // In Tree mode: smooth curved path (d3.linkVertical) from parent bottom to child top
      // s is dependent layer (child), t is dependency (parent)
      let parent = t;
      let child = s;
      
      // Determine which one sits higher vertically (parent vs child)
      if (s.y < t.y) {
        parent = s;
        child = t;
      }

      const pX = parent.x!;
      const pY = parent.y! + parent.radius;
      const cX = child.x!;
      const cY = child.y! - child.radius;

      // Link vertical smooth cubic bezier
      const linkGen = d3.linkVertical()({
        source: [pX, pY],
        target: [cX, cY]
      });
      return linkGen || `M${pX},${pY} L${cX},${cY}`;
    } else {
      // Straight line for force layout
      return `M${s.x},${s.y} L${t.x},${t.y}`;
    }
  };

  // Initial Graph Setup & Data Binding
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // clear previous render

    // Definitions (Arrowheads, filters, glow)
    const defs = svg.append('defs');

    const createMarker = (id: string, color: string) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 24)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    };

    createMarker('arrow-default', 'var(--text-muted)');
    createMarker('arrow-highlight', 'var(--accent)');
    createMarker('arrow-ghost', 'var(--danger)');
    createMarker('arrow-dynamic', 'var(--text-muted)');
    createMarker('arrow-dynamic-highlight', 'var(--accent-hover)');

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Root zoom container
    const g = svg.append('g').attr('class', 'graph-container');
    gRef.current = g.node();

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Compute node radius based on recipe count (base 28 to 44)
    const maxRecipes = Math.max(1, ...config.layers.map(l => l.recipes.length));
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxRecipes])
      .range([30, 46]);

    const nodes: GraphNode[] = config.layers.map(layer => ({
      id: layer.id,
      name: layer.name,
      collectionName: layer.collectionName,
      layer,
      radius: layer.isGhost ? 28 : radiusScale(layer.recipes.length),
      categoryType: layer.categoryType,
      recipeCount: layer.recipes.length,
      bbappendCount: layer.bbappends.length,
      isGhost: layer.isGhost,
      isMissing: layer.isMissing
    }));

    nodesRef.current = nodes;

    const nodeLookup = new Map<string, GraphNode>();
    nodes.forEach(n => {
      nodeLookup.set(n.id, n);
      nodeLookup.set(n.collectionName, n);
      nodeLookup.set(n.name, n);
      if (n.layer.collections) {
        n.layer.collections.forEach(col => nodeLookup.set(col, n));
      }
    });

    // Build links from LAYERDEPENDS (solid) and BBFILES_DYNAMIC (dashed cyan)
    const links: GraphLink[] = [];
    config.layers.forEach(layer => {
      // Hard dependencies
      layer.dependsOn.forEach(depName => {
        const targetNode = nodeLookup.get(depName);
        if (targetNode && targetNode.id !== layer.id) {
          links.push({
            source: layer.id,
            target: targetNode.id,
            isGhostLink: targetNode.isGhost || targetNode.isMissing,
            isDynamicLink: false
          });
        }
      });

      // Dynamic extensions
      (layer.dynamicDepends || []).forEach(dynName => {
        const targetNode = nodeLookup.get(dynName);
        if (targetNode && targetNode.id !== layer.id) {
          const alreadyLinked = links.some(
            l => (l.source === layer.id || (l.source as GraphNode).id === layer.id) &&
                 (l.target === targetNode.id || (l.target as GraphNode).id === targetNode.id)
          );
          if (!alreadyLinked) {
            links.push({
              source: layer.id,
              target: targetNode.id,
              isGhostLink: false,
              isDynamicLink: true
            });
          }
        }
      });
    });

    linksRef.current = links;

    // --- FIX 2: Compute Hierarchical Tree Depths (DAG longest path with cycle breaking) ---
    const depthMap = new Map<string, number>();
    const visiting = new Set<string>();

    function computeDepth(nodeId: string): number {
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
      if (visiting.has(nodeId)) {
        // Cycle detected: break cycle by ignoring back-edge
        return 0;
      }
      visiting.add(nodeId);
      const node = nodeLookup.get(nodeId);
      if (!node) {
        visiting.delete(nodeId);
        return 0;
      }

      let maxParentDepth = -1;
      for (const dep of node.layer.dependsOn) {
        const parentNode = nodeLookup.get(dep);
        if (parentNode && parentNode.id !== node.id) {
          const pDepth = computeDepth(parentNode.id);
          if (pDepth > maxParentDepth) {
            maxParentDepth = pDepth;
          }
        }
      }

      visiting.delete(nodeId);
      const res = maxParentDepth + 1;
      depthMap.set(nodeId, res);
      return res;
    }

    nodes.forEach(n => computeDepth(n.id));

    // Handle ghost / unmet nodes: place them on rank above or at root level
    nodes.forEach(n => {
      n.depth = depthMap.get(n.id) || 0;
    });

    // Group nodes by depth level
    const levelBuckets = new Map<number, GraphNode[]>();
    nodes.forEach(n => {
      const lvl = n.depth || 0;
      if (!levelBuckets.has(lvl)) levelBuckets.set(lvl, []);
      levelBuckets.get(lvl)!.push(n);
    });

    // Calculate hierarchical Tree (x, y) coordinates
    const horizontalGap = 180; // at least 160px gap
    const verticalGap = 145;   // at least 120px gap

    const sortedLevels = Array.from(levelBuckets.keys()).sort((a, b) => a - b);
    sortedLevels.forEach(lvl => {
      const bucketNodes = levelBuckets.get(lvl) || [];
      const count = bucketNodes.length;
      bucketNodes.forEach((node, idx) => {
        node.treeX = (idx - (count - 1) / 2) * horizontalGap + width / 2;
        node.treeY = lvl * verticalGap + 80;
      });
    });

    // D3 Force Simulation
    const simulation = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(150).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-650).distanceMax(650))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.radius + 35).iterations(3))
      .alphaDecay(0.028);

    simulationRef.current = simulation;

    // Draw Links Container
    const linkGroup = g.append('g').attr('class', 'links');
    const linkLines = linkGroup.selectAll<SVGPathElement, GraphLink>('path')
      .data(links)
      .join('path')
      .attr('class', 'link-line')
      .attr('fill', 'none')
      .attr('stroke', d => d.isGhostLink ? 'var(--danger)' : d.isDynamicLink ? 'var(--text-muted)' : 'var(--border-strong)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => (d.isGhostLink || d.isDynamicLink) ? '4,4' : 'none')
      .attr('marker-end', d => d.isGhostLink ? 'url(#arrow-ghost)' : d.isDynamicLink ? 'url(#arrow-dynamic)' : 'url(#arrow-default)');

    // Draw Nodes Container
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-item')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (currentLayoutRef.current === 'force') {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            }
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
            d.x = event.x;
            d.y = event.y;
            if (currentLayoutRef.current === 'tree') {
              d3.select(event.sourceEvent.target.closest('.node-item'))
                .attr('transform', `translate(${d.x},${d.y})`);
              linkLines.attr('d', l => computeLinkPath(l, 'tree'));
            }
          })
          .on('end', (event, d) => {
            if (currentLayoutRef.current === 'force') {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Node outer circle (border & background)
    nodeElements.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => d.radius)
      .attr('fill', d => CATEGORY_COLORS[d.categoryType].fill)
      .attr('stroke', d => CATEGORY_COLORS[d.categoryType].stroke)
      .attr('stroke-width', d => d.isGhost ? 2 : 3)
      .attr('stroke-dasharray', d => d.isGhost ? '5,5' : 'none')
      .style('transition', 'filter 0.2s, stroke-width 0.2s');

    // Missing layer warning outer indicator ring
    nodeElements.filter(d => d.isMissing).append('circle')
      .attr('r', d => d.radius + 5)
      .attr('fill', 'none')
      .attr('stroke', 'var(--danger)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3');

    // Inside Circle: Recipe & Appends count badges
    const badgeGroup = nodeElements.filter(d => !d.isGhost && !d.isMissing)
      .append('g')
      .attr('class', 'badge-group')
      .attr('transform', 'translate(0, 0)');

    badgeGroup.append('rect')
      .attr('x', -24)
      .attr('y', -8)
      .attr('width', 48)
      .attr('height', 16)
      .attr('rx', 4)
      .attr('fill', 'var(--bg-tertiary)')
      .attr('stroke', 'var(--border-strong)')
      .attr('stroke-width', 0.8);

    badgeGroup.append('text')
      .attr('x', -9)
      .attr('y', 3.5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-primary)')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(d => `${d.recipeCount}r`);

    badgeGroup.append('text')
      .attr('x', 0)
      .attr('y', 3)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '8px')
      .text('·');

    badgeGroup.append('text')
      .attr('x', 10)
      .attr('y', 3.5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--warning)')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(d => `${d.bbappendCount}a`);

    // Inside Circle for Ghost / Missing nodes
    nodeElements.filter(d => d.isGhost || d.isMissing)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', d => d.isGhost ? 'var(--danger)' : 'var(--danger)')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .text(d => d.isGhost ? 'UNMET' : 'MISSING');

    // --- FIX 2: Node labels ALWAYS BELOW the circle, never inside ---
    nodeElements.append('text')
      .attr('class', 'node-title')
      .attr('text-anchor', 'middle')
      .attr('y', d => d.radius + 15)
      .attr('fill', 'var(--text-primary)')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('letter-spacing', '-0.01em')
      .text(d => {
        const n = d.name;
        return n.length > 18 ? n.slice(0, 17) + '…' : n;
      });

    // Subtitle label below title
    nodeElements.append('text')
      .attr('class', 'node-subtitle')
      .attr('text-anchor', 'middle')
      .attr('y', d => d.radius + 27)
      .attr('fill', d => CATEGORY_COLORS[d.categoryType].text)
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.04em')
      .text(d => CATEGORY_COLORS[d.categoryType].label);

    // Node interactions
    nodeElements
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectLayer(d.layer);
      })
      .on('mouseenter', (event, d) => {
        setHoveredNodeId(d.id);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);
      });

    // Simulation tick handler for force mode
    simulation.on('tick', () => {
      if (currentLayoutRef.current === 'force') {
        linkLines.attr('d', d => computeLinkPath(d, 'force'));
        nodeElements.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      }
    });

    // Apply layout mode (Tree or Force)
    if (layoutMode === 'tree') {
      simulation.stop();
      nodes.forEach(d => {
        d.x = d.treeX;
        d.y = d.treeY;
        d.fx = d.treeX;
        d.fy = d.treeY;
      });
      nodeElements.attr('transform', d => `translate(${d.treeX || 0},${d.treeY || 0})`);
      linkLines.attr('d', d => computeLinkPath(d, 'tree'));
    } else {
      for (let i = 0; i < 30; ++i) simulation.tick();
      simulation.alpha(0.3).restart();
    }

    const timer = setTimeout(() => {
      fitGraphView();
    }, 350);

    return () => {
      clearTimeout(timer);
      simulation.stop();
    };
  }, [config]);

  // Handle Layout Mode Transitions (Tree <-> Force)
  useEffect(() => {
    currentLayoutRef.current = layoutMode;
    if (!svgRef.current || !simulationRef.current) return;
    const svg = d3.select(svgRef.current);
    const simulation = simulationRef.current;
    const nodes = nodesRef.current;

    const nodeElements = svg.selectAll<SVGGElement, GraphNode>('.node-item');
    const linkLines = svg.selectAll<SVGPathElement, GraphLink>('.link-line');

    if (layoutMode === 'tree') {
      simulation.stop();
      nodes.forEach(d => {
        d.fx = d.treeX;
        d.fy = d.treeY;
      });

      // Smoothly animate nodes to tree positions
      nodeElements
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('transform', d => `translate(${d.treeX || 0},${d.treeY || 0})`)
        .on('end', (d) => {
          d.x = d.treeX;
          d.y = d.treeY;
        });

      // Animate curved links
      linkLines
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attrTween('d', function (d) {
          const s = d.source as GraphNode;
          const t = d.target as GraphNode;
          const startSx = s.x || 0, startSy = s.y || 0;
          const startTx = t.x || 0, startTy = t.y || 0;
          const endSx = s.treeX || startSx, endSy = s.treeY || startSy;
          const endTx = t.treeX || startTx, endTy = t.treeY || startTy;

          return function (interp) {
            const curS: GraphNode = { ...s, x: startSx + (endSx - startSx) * interp, y: startSy + (endSy - startSy) * interp };
            const curT: GraphNode = { ...t, x: startTx + (endTx - startTx) * interp, y: startTy + (endTy - startTy) * interp };
            return computeLinkPath({ ...d, source: curS, target: curT }, 'tree');
          };
        });

      setTimeout(() => fitGraphView(), 700);
    } else {
      // Switch to Force mode
      nodes.forEach(d => {
        d.fx = null;
        d.fy = null;
      });
      simulation.alpha(0.4).restart();
      setTimeout(() => fitGraphView(), 700);
    }
  }, [layoutMode]);

  // Handle Highlighting, Selection & Search updates
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const activeId = selectedLayer?.id || hoveredNodeId;
    const relatedNodeIds = new Set<string>();

    if (activeId) {
      relatedNodeIds.add(activeId);
      const activeObj = config.layers.find(l => l.id === activeId || l.collectionName === activeId || l.name === activeId);

      if (activeObj) {
        activeObj.dependsOn.forEach(dep => relatedNodeIds.add(dep));
        config.layers.forEach(other => {
          if (other.dependsOn.some(d => d === activeObj.id || d === activeObj.collectionName || d === activeObj.name)) {
            relatedNodeIds.add(other.id);
          }
        });
      }
    }

    const filterQuery = searchFilter.toLowerCase().trim();

    svg.selectAll<SVGGElement, GraphNode>('.node-item')
      .each(function (d) {
        const nodeGroupEl = d3.select(this);
        const circle = nodeGroupEl.select('.node-circle');
        const isSelected = selectedLayer?.id === d.id || selectedLayer?.collectionName === d.id;
        const isHovered = hoveredNodeId === d.id;
        const isRelated = relatedNodeIds.has(d.id) || relatedNodeIds.has(d.collectionName) || relatedNodeIds.has(d.name);
        const matchesSearch = !filterQuery || 
          d.name.toLowerCase().includes(filterQuery) || 
          d.collectionName.toLowerCase().includes(filterQuery) ||
          d.layer.recipes.some(r => r.name.toLowerCase().includes(filterQuery));

        const baseColor = CATEGORY_COLORS[d.categoryType];

        let opacity = 1;
        if (activeId && !isRelated) {
          opacity = 0.25;
        }
        if (filterQuery && !matchesSearch) {
          opacity = Math.min(opacity, 0.2);
        }

        nodeGroupEl.style('opacity', opacity);

        if (isSelected) {
          circle
            .attr('stroke', 'var(--accent)')
            .attr('stroke-width', 4)
            .style('filter', 'url(#glow)');
        } else if (isHovered) {
          circle
            .attr('stroke', 'var(--bg-secondary)')
            .attr('stroke-width', 3.5)
            .style('filter', 'url(#glow)');
        } else if (matchesSearch && filterQuery) {
          circle
            .attr('stroke', 'var(--accent)')
            .attr('stroke-width', 3)
            .style('filter', 'drop-(0 0 8px rgba(56, 189, 248, 0.8))');
        } else {
          circle
            .attr('stroke', baseColor.stroke)
            .attr('stroke-width', d.isGhost ? 2 : 2.5)
            .style('filter', 'none');
        }
      });

    svg.selectAll<SVGPathElement, GraphLink>('.link-line')
      .each(function (d) {
        const linkEl = d3.select(this);
        const s = d.source as GraphNode;
        const t = d.target as GraphNode;

        const isHighlighted = activeId && (
          (s.id === activeId && relatedNodeIds.has(t.id)) ||
          (t.id === activeId && relatedNodeIds.has(s.id))
        );

        if (isHighlighted) {
          linkEl
            .attr('stroke', d.isDynamicLink ? 'var(--accent-hover)' : 'var(--accent)')
            .attr('stroke-width', d.isDynamicLink ? 2.5 : 3)
            .attr('stroke-dasharray', (d.isGhostLink || d.isDynamicLink) ? '4,4' : 'none')
            .attr('opacity', 1)
            .attr('marker-end', d.isDynamicLink ? 'url(#arrow-dynamic-highlight)' : 'url(#arrow-highlight)');
        } else if (activeId) {
          linkEl
            .attr('stroke', 'var(--border-strong)')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', (d.isGhostLink || d.isDynamicLink) ? '4,4' : 'none')
            .attr('opacity', 0.15)
            .attr('marker-end', 'url(#arrow-default)');
        } else {
          linkEl
            .attr('stroke', d.isGhostLink ? 'var(--danger)' : d.isDynamicLink ? 'var(--text-muted)' : 'var(--border-strong)')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', (d.isGhostLink || d.isDynamicLink) ? '4,4' : 'none')
            .attr('opacity', d.isDynamicLink ? 0.85 : 0.7)
            .attr('marker-end', d.isGhostLink ? 'url(#arrow-ghost)' : d.isDynamicLink ? 'url(#arrow-dynamic)' : 'url(#arrow-default)');
        }
      });

  }, [selectedLayer, hoveredNodeId, searchFilter, config]);

  return (
    <div ref={containerRef} id="graph-viewport" className="relative w-full h-full bg-[var(--bg-primary)] select-none overflow-hidden">
      {/* Background grid texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* FIX 1: Info Banner for Fallback Auto-Discovery Mode */}
      {config.discoveryMode === 'fallback' && !bannerDismissed && (
        <div 
          id="fallback-discovery-banner"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-amber-950/90 text-amber-200 border border-amber-500/50 px-4 py-2 rounded-lg  text-xs backdrop-blur pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <AlertTriangle className="w-4 h-4 text-[var(--text-code-amber)] shrink-0" />
          <span className="font-medium">
            No bblayers.conf found — layers auto-discovered from directory scan
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="ml-2 text-[var(--text-code-amber)] hover:text-[var(--text-primary)] p-0.5 rounded hover:bg-amber-900/60 transition"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        id="yocto-d3-svg"
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Bottom Legend Overlay */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)]/90 backdrop-blur px-3 py-2 rounded border border-[var(--border)] pointer-events-auto ">
        <span className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block" /> CORE / POKY
        </span>
        <span className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="w-2.5 h-2.5 bg-teal-500 rounded-full inline-block" /> OPENEMBEDDED
        </span>
        <span className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block" /> BSP / SILICON
        </span>
        <span className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="w-2.5 h-2.5 bg-purple-500 rounded-full inline-block" /> CUSTOM
        </span>
        <span className="flex items-center gap-1.5 font-medium tracking-wide text-[var(--text-code-red)]">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full inline-block border border-dashed border-red-300" /> UNMET / GHOST
        </span>
        <span className="flex items-center gap-1.5 font-medium tracking-wide text-[var(--text-primary)]yan-400 border-l border-[var(--border)] pl-3">
          <span className="w-4 h-0 border-t-2 border-dashed border-cyan-400 inline-block" /> DYNAMIC EXTENSION
        </span>
        <span className="hidden md:flex items-center gap-1.5 text-[var(--text-muted)] border-l border-[var(--border)] pl-3">
          <span>Badge: <strong className="text-[var(--text-primary)] font-mono">r</strong>=recipes, <strong className="text-[var(--text-code-amber)] font-mono">a</strong>=bbappends</span>
        </span>
      </div>
    </div>
  );
});

LayerGraph.displayName = 'LayerGraph';
