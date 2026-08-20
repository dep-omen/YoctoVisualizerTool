import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { GraphLink, GraphNode, LayerCategory, YoctoBuildConfig, YoctoLayer } from '../types';

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
}

const CATEGORY_COLORS: Record<LayerCategory, { fill: string; stroke: string; glow: string; text: string; label: string }> = {
  core: {
    fill: '#161b22',
    stroke: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.35)',
    text: '#93c5fd',
    label: 'CORE / POKY'
  },
  openembedded: {
    fill: '#161b22',
    stroke: '#14b8a6',
    glow: 'rgba(20, 184, 166, 0.35)',
    text: '#5eead4',
    label: 'OPENEMBEDDED'
  },
  'oe-sublayer': {
    fill: '#161b22',
    stroke: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.35)',
    text: '#67e8f9',
    label: 'OE SUBLAYER'
  },
  'st-bsp': {
    fill: '#161b22',
    stroke: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: '#fcd34d',
    label: 'BSP / SILICON'
  },
  bsp: {
    fill: '#161b22',
    stroke: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: '#fcd34d',
    label: 'BSP LAYER'
  },
  custom: {
    fill: '#161b22',
    stroke: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.35)',
    text: '#d8b4fe',
    label: 'CUSTOM'
  },
  missing: {
    fill: '#1c1917',
    stroke: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.4)',
    text: '#fca5a5',
    label: 'MISSING'
  },
  ghost: {
    fill: '#161b22',
    stroke: '#4b5563',
    glow: 'rgba(107, 114, 128, 0.2)',
    text: '#9ca3af',
    label: 'UNMET'
  }
};

export const LayerGraph = forwardRef<LayerGraphRef, LayerGraphProps>(({
  config,
  selectedLayer,
  onSelectLayer,
  searchFilter
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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

    // Clone SVG to preserve clean styles
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', `${width * 2}`);
    clone.setAttribute('height', `${height * 2}`);
    clone.style.backgroundColor = '#0d1117';

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

        // Draw dark background
        ctx.fillStyle = '#0d1117';
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

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // clear previous render

    // Definitions (Arrowheads, filters, glow)
    const defs = svg.append('defs');

    // Arrow markers
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

    createMarker('arrow-default', '#30363d');
    createMarker('arrow-highlight', '#38bdf8');
    createMarker('arrow-ghost', '#21262d');

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

    // Map Layers to Graph Nodes
    const collectionMap = new Map<string, YoctoLayer>();
    config.layers.forEach(l => {
      collectionMap.set(l.id, l);
      collectionMap.set(l.collectionName, l);
      collectionMap.set(l.name, l);
    });

    // Compute node radius based on recipe count (base 32 to 58)
    const maxRecipes = Math.max(1, ...config.layers.map(l => l.recipes.length));
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxRecipes])
      .range([32, 56]);

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

    // Build links from LAYERDEPENDS
    const links: GraphLink[] = [];
    config.layers.forEach(layer => {
      layer.dependsOn.forEach(depName => {
        const targetNode = nodes.find(n => n.id === depName || n.collectionName === depName || n.name === depName);
        if (targetNode) {
          links.push({
            source: layer.id,
            target: targetNode.id,
            isGhostLink: targetNode.isGhost
          });
        }
      });
    });

    // D3 Force Simulation
    const simulation = d3.forceSimulation<GraphNode, GraphLink>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(140).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-600).distanceMax(600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => d.radius + 30).iterations(3))
      .alphaDecay(0.028);

    simulationRef.current = simulation;

    // Draw Links Container
    const linkGroup = g.append('g').attr('class', 'links');
    const linkLines = linkGroup.selectAll<SVGPathElement, GraphLink>('path')
      .data(links)
      .join('path')
      .attr('class', 'link-line')
      .attr('fill', 'none')
      .attr('stroke', d => d.isGhostLink ? '#21262d' : '#30363d')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => d.isGhostLink ? '4,4' : 'none')
      .attr('marker-end', d => d.isGhostLink ? 'url(#arrow-ghost)' : 'url(#arrow-default)');

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
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
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

    // Missing layer warning indicator
    nodeElements.filter(d => d.isMissing).append('circle')
      .attr('r', d => d.radius + 5)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3');

    // Node Name Label
    nodeElements.append('text')
      .attr('class', 'node-title')
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.isGhost ? '0.35em' : '-0.25em'))
      .attr('fill', '#ffffff')
      .attr('font-size', d => (d.radius > 45 ? '12px' : '10.5px'))
      .attr('font-weight', '700')
      .attr('letter-spacing', '-0.01em')
      .text(d => {
        const n = d.name;
        return n.length > 16 ? n.slice(0, 15) + '…' : n;
      });

    // Badge Container for Recipes & Appends (on non-ghost nodes)
    const badgeGroup = nodeElements.filter(d => !d.isGhost)
      .append('g')
      .attr('class', 'badge-group')
      .attr('transform', d => `translate(0, ${d.radius > 45 ? 14 : 10})`);

    // Badges pill background
    badgeGroup.append('rect')
      .attr('x', -26)
      .attr('y', -7)
      .attr('width', 52)
      .attr('height', 14)
      .attr('rx', 3)
      .attr('fill', '#21262d')
      .attr('stroke', '#30363d')
      .attr('stroke-width', 0.8);

    // Recipes Count Badge (e.g. 18r)
    badgeGroup.append('text')
      .attr('x', -10)
      .attr('y', 3.5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#d1d5db')
      .attr('font-size', '8.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(d => `${d.recipeCount}r`);

    // Separator dot
    badgeGroup.append('text')
      .attr('x', 0)
      .attr('y', 3)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4b5563')
      .attr('font-size', '8px')
      .text('·');

    // BBAppend Count Badge (e.g. 3a)
    badgeGroup.append('text')
      .attr('x', 12)
      .attr('y', 3.5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', '8.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'monospace')
      .text(d => `${d.bbappendCount}a`);

    // Ghost tag for ghost nodes
    nodeElements.filter(d => d.isGhost)
      .append('text')
      .attr('dy', '1.6em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#9ca3af')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .text('(unmet)');

    // Missing tag for missing nodes
    nodeElements.filter(d => d.isMissing)
      .append('text')
      .attr('dy', '1.6em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#f87171')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .text('[missing]');

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

    // Background click deselects
    svg.on('click', () => {
      // Keep selection or do nothing
    });

    // Simulation tick handler
    simulation.on('tick', () => {
      linkLines.attr('d', d => {
        const s = d.source as GraphNode;
        const t = d.target as GraphNode;
        if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return '';

        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dr = Math.sqrt(dx * dx + dy * dy);

        // Slight curvature for elegant layout
        const offset = 0; // straight with smooth angle
        return `M${s.x},${s.y} L${t.x},${t.y}`;
      });

      nodeElements.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Initial warm up and fit
    for (let i = 0; i < 40; ++i) simulation.tick();
    simulation.alpha(0.3).restart();

    // Auto-fit after short settling
    const timer = setTimeout(() => {
      fitGraphView();
    }, 350);

    return () => {
      clearTimeout(timer);
      simulation.stop();
    };
  }, [config]);

  // Handle Highlighting and Selection Updates
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const activeId = selectedLayer?.id || hoveredNodeId;

    // Find direct dependencies and direct dependents
    const relatedNodeIds = new Set<string>();
    const activeLinkSources = new Set<string>();
    const activeLinkTargets = new Set<string>();

    if (activeId) {
      relatedNodeIds.add(activeId);
      const activeObj = config.layers.find(l => l.id === activeId || l.collectionName === activeId || l.name === activeId);

      if (activeObj) {
        // Depends on (outgoing)
        activeObj.dependsOn.forEach(dep => {
          relatedNodeIds.add(dep);
          activeLinkTargets.add(dep);
        });

        // Required by (incoming)
        config.layers.forEach(other => {
          if (other.dependsOn.some(d => d === activeObj.id || d === activeObj.collectionName || d === activeObj.name)) {
            relatedNodeIds.add(other.id);
            activeLinkSources.add(other.id);
          }
        });
      }
    }

    // Filter match query
    const filterQuery = searchFilter.toLowerCase().trim();

    // Update Nodes appearance
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
            .attr('stroke', '#38bdf8')
            .attr('stroke-width', 4)
            .style('filter', 'url(#glow)');
        } else if (isHovered) {
          circle
            .attr('stroke', '#f3f4f6')
            .attr('stroke-width', 3.5)
            .style('filter', 'url(#glow)');
        } else if (matchesSearch && filterQuery) {
          circle
            .attr('stroke', '#38bdf8')
            .attr('stroke-width', 3)
            .style('filter', 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.8))');
        } else {
          circle
            .attr('stroke', baseColor.stroke)
            .attr('stroke-width', d.isGhost ? 2 : 2.5)
            .style('filter', 'none');
        }
      });

    // Update Links appearance
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
            .attr('stroke', '#38bdf8')
            .attr('stroke-width', 3)
            .attr('opacity', 1)
            .attr('marker-end', 'url(#arrow-highlight)');
        } else if (activeId) {
          linkEl
            .attr('stroke', '#374151')
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.15)
            .attr('marker-end', 'url(#arrow-default)');
        } else {
          linkEl
            .attr('stroke', d.isGhostLink ? '#374151' : '#4b5563')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7)
            .attr('marker-end', d.isGhostLink ? 'url(#arrow-ghost)' : 'url(#arrow-default)');
        }
      });

  }, [selectedLayer, hoveredNodeId, searchFilter, config]);

  return (
    <div ref={containerRef} id="graph-viewport" className="relative w-full h-full bg-[#0d1117] select-none overflow-hidden">
      {/* Background grid texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      <svg
        ref={svgRef}
        id="yocto-d3-svg"
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Bottom Legend Overlay matching design */}
      <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] text-gray-400 bg-[#0d1117]/90 backdrop-blur px-3 py-2 rounded border border-gray-800 pointer-events-auto shadow-xl">
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
        <span className="hidden md:flex items-center gap-1.5 text-gray-500 border-l border-gray-800 pl-3">
          <span>Badge: <strong className="text-gray-300 font-mono">r</strong>=recipes, <strong className="text-amber-400 font-mono">a</strong>=bbappends</span>
        </span>
      </div>
    </div>
  );
});

LayerGraph.displayName = 'LayerGraph';
