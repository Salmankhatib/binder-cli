import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';

interface Snapshot {
  id: string;
  timestamp: string;
  backend: {
    version: string;
  };
  frontend: {
    version: string;
  };
}

/**
 * binder map generates a visual representation of version compatibility.
 */
export async function runMap() {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  
  if (!existsSync(snapshotsDir)) {
    logger.error('No snapshots found.');
    return;
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  const snapshots = files.map(f => JSON.parse(readFileSync(join(snapshotsDir, f), 'utf-8')) as Snapshot);

  let mermaid = 'graph TD\n';
  mermaid += '  subgraph Compatibility Map\n';
  
  snapshots.forEach((s, i) => {
    const bNode = `B_${i}[Backend ${s.backend.version}]`;
    const fNode = `F_${i}[Frontend ${s.frontend.version}]`;
    mermaid += `    ${bNode} -- Verified --> ${fNode}\n`;
    
    if (i > 0) {
      mermaid += `    B_${i-1} -.-> B_${i}\n`;
      mermaid += `    F_${i-1} -.-> F_${i}\n`;
    }
  });
  
  mermaid += '  end\n';

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Binder Compatibility Map</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:true});</script>
</head>
<body>
    <h1>Binder Version Compatibility Map</h1>
    <div class="mermaid">
${mermaid}
    </div>
</body>
</html>
  `;

  const outDir = resolve(process.cwd(), 'binder');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  
  const outFile = join(outDir, 'map.html');
  writeFileSync(outFile, html);
  
  logger.success(`Compatibility map generated at ${pc.bold('binder/map.html')}`);
}
