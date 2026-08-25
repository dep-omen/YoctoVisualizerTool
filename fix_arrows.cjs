const fs = require('fs');

const file = 'src/components/LayerGraph.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix markers refX
code = code.replace(
  /.attr\('viewBox', '0 -5 10 10'\)\s*\n\s*.attr\('refX', 24\)\s*\n\s*.attr\('refY', 0\)\s*\n\s*.attr\('markerWidth', 6\)\s*\n\s*.attr\('markerHeight', 6\)\s*\n\s*.attr\('orient', 'auto'\)\s*\n\s*.append\('path'\)\s*\n\s*.attr\('d', 'M0,-5L10,0L0,5'\)/g,
  `.attr('viewBox', '0 -4 8 8')
        .attr('refX', 7.5)
        .attr('refY', 0)
        .attr('markerWidth', 5.5)
        .attr('markerHeight', 5.5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4 L8,0 L0,4 Z')`
);

// 2. Fix link path calculation
const linkPathFnStr = `const computeLinkPath = (link: GraphLink, mode: 'tree' | 'force'): string => {
    const s = link.source as GraphNode;
    const t = link.target as GraphNode;
    if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return '';

    if (mode === 'tree') {
      let parent = t;
      let child = s;
      
      if (s.y < t.y) {
        parent = s;
        child = t;
      }

      const pX = parent.x!;
      const pY = parent.y! + parent.radius;
      const cX = child.x!;
      const cY = child.y! - child.radius;

      const linkGen = d3.linkVertical()({
        source: [pX, pY],
        target: [cX, cY]
      });
      return linkGen || \`M\${pX},\${pY} L\${cX},\${cY}\`;
    } else {
      // Force mode: calculate edge intersection
      const dx = t.x! - s.x!;
      const dy = t.y! - s.y!;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance === 0) return '';
      
      // Target edge
      const tX = t.x! - (dx * t.radius / distance);
      const tY = t.y! - (dy * t.radius / distance);
      
      // Source edge
      const sX = s.x! + (dx * s.radius / distance);
      const sY = s.y! + (dy * s.radius / distance);
      
      return \`M\${sX},\${sY} L\${tX},\${tY}\`;
    }
  };`;

// replace computeLinkPath
code = code.replace(/const computeLinkPath = \([\s\S]*?return \`M\$\{s\.x\},\$\{s\.y\} L\$\{t\.x\},\$\{t\.y\}\`;\n    }\n  };/m, linkPathFnStr);

fs.writeFileSync(file, code, 'utf8');
