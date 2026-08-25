const fs = require('fs');

const file = 'src/components/LayerGraph.tsx';
let code = fs.readFileSync(file, 'utf8');

const linkPathFnStr = `const computeLinkPath = (link: GraphLink, mode: 'tree' | 'force'): string => {
    const s = link.source as GraphNode;
    const t = link.target as GraphNode;
    if (!s || !t || s.x == null || s.y == null || t.x == null || t.y == null) return '';

    if (mode === 'tree') {
      let startX = s.x;
      let startY = s.y;
      let endX = t.x;
      let endY = t.y;

      if (s.y < t.y) {
        // s is above t
        startY += s.radius;
        endY -= t.radius;
      } else {
        // s is below t
        startY -= s.radius;
        endY += t.radius;
      }

      const linkGen = d3.linkVertical()({
        source: [startX, startY],
        target: [endX, endY]
      });
      return linkGen || \`M\${startX},\${startY} L\${endX},\${endY}\`;
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
code = code.replace(/const computeLinkPath = \([\s\S]*?return \`M\$\{sX\},\$\{sY\} L\$\{tX\},\$\{tY\}\`;\n    }\n  };/m, linkPathFnStr);

fs.writeFileSync(file, code, 'utf8');
