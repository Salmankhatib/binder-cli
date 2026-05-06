import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { calculateLastKnownGood } from '../analysis/rollbackIntelligence.js';

interface Snapshot {
  id: string;
  timestamp: string;
  backend: { version: string; status?: string };
  frontend: { version: string; status?: string };
}

/**
 * binder dashboard generates a high-level visual and actionable report.
 */
export async function runDashboard() {
  const snapshotsDir = resolve(process.cwd(), '.binder', 'snapshots');
  
  if (!existsSync(snapshotsDir)) {
    logger.error('No snapshots found.');
    return;
  }

  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  const snapshots = files.map(f => JSON.parse(readFileSync(join(snapshotsDir, f), 'utf-8')) as Snapshot);

  const rollback = await calculateLastKnownGood();

  let mermaid = 'graph TD\n';
  snapshots.forEach((s, i) => {
    const bNode = `B_${i}[Backend ${s.backend.version}]`;
    const fNode = `F_${i}[Frontend ${s.frontend.version}]`;
    mermaid += `    ${bNode} -- Verified --> ${fNode}\n`;
    if (i > 0) {
      mermaid += `    B_${i-1} -.-> B_${i}\n`;
      mermaid += `    F_${i-1} -.-> F_${i}\n`;
    }
  });

  const rollbackHtml = rollback ? `
    <div class="rollback-card">
      <div class="rollback-header">🛡️ ACTIONABLE ROLLBACK INTELLIGENCE</div>
      <p>In case you need to roll back, the <strong>last safe version</strong> is:</p>
      <div class="version-tag">${rollback.safeVersion}</div>
      <p><strong>Rollback Instructions:</strong></p>
      <pre>${rollback.instructions.join('\n')}</pre>
    </div>
  ` : '<div class="rollback-card">No rollback history available.</div>';

  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Binder Spec Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
      .container { max-width: 1000px; margin: 0 auto; }
      h1 { font-size: 2.5rem; margin-bottom: 30px; color: #38bdf8; }
      .rollback-card { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; margin-bottom: 40px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
      .rollback-header { font-weight: bold; color: #fbbf24; margin-bottom: 15px; font-size: 1.1rem; }
      .version-tag { display: inline-block; background: #0369a1; color: white; padding: 4px 12px; border-radius: 6px; font-weight: bold; margin: 10px 0; }
      pre { background: #000; padding: 15px; border-radius: 8px; font-size: 0.9rem; color: #10b981; overflow-x: auto; }
      .mermaid { background: white; padding: 20px; border-radius: 12px; }
    </style>
    <script>mermaid.initialize({startOnLoad:true, theme: 'neutral'});</script>
</head>
<body>
    <div class="container">
      <h1>Binder Spec Dashboard</h1>
      
      ${rollbackHtml}

      <div class="rollback-header">📦 VERSION COMPATIBILITY GRAPH</div>
      <div class="mermaid">
        ${mermaid}
      </div>
    </div>
</body>
</html>
  `;

  const outDir = resolve(process.cwd(), 'binder');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  
  const outFile = join(outDir, 'dashboard.html');
  writeFileSync(outFile, html);
  
  logger.success(`✔ Spec Dashboard generated at ${pc.bold('binder/dashboard.html')}`);
}
