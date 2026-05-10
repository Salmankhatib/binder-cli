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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Binder Command Center</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Inter', sans-serif; }
      .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
      .btn-primary { @apply bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg transition-all active:scale-95; }
      .btn-ghost { @apply bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 px-4 rounded-lg transition-all; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
    <div class="max-w-7xl mx-auto px-6 py-8">
      <header class="flex justify-between items-center mb-10">
        <div>
          <h1 class="text-4xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">Binder Command Center</h1>
          <p class="text-slate-400 mt-2">Active Contract Governance & Autonomous Repair</p>
        </div>
        <div class="flex gap-3">
          <button onclick="runCommand('sync')" class="btn-ghost flex items-center gap-2">
            <span class="text-lg">🔄</span> Sync
          </button>
          <button onclick="runCommand('snapshot')" class="btn-primary flex items-center gap-2">
            <span class="text-lg">📸</span> Snapshot
          </button>
        </div>
      </header>

      <div class="grid grid-cols-12 gap-8">
        <!-- Sidebar Navigation -->
        <div class="col-span-3 space-y-4">
          <nav class="glass rounded-2xl p-4 space-y-2">
            <button onclick="showTab('drift')" class="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-3">
              <span class="text-xl">🛡️</span> Drift Analysis
            </button>
            <button onclick="showTab('scaffold')" class="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-3">
              <span class="text-xl">🏗️</span> Scaffold Map
            </button>
            <button onclick="showTab('history')" class="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-3">
              <span class="text-xl">⏳</span> Time Machine
            </button>
          </nav>
          
          <div class="glass rounded-2xl p-6">
            <h3 class="font-bold text-amber-400 flex items-center gap-2 mb-4">
              <span>🛡️</span> ROLLBACK TARGET
            </h3>
            <p class="text-sm text-slate-300 mb-4">Last Safe Version identified:</p>
            <div class="bg-sky-900/50 text-sky-200 px-3 py-1 rounded-md font-mono text-sm inline-block mb-4">
              ${rollback?.safeVersion || 'None'}
            </div>
            <button onclick="rollbackTo('${rollback?.safeVersion}')" class="w-full btn-ghost text-sm py-2">
              Restore Stable State
            </button>
          </div>
        </div>

        <!-- Main Content Area -->
        <main class="col-span-9 space-y-8">
          <!-- Drift Analysis Section -->
          <section id="tab-drift" class="tab-content glass rounded-2xl p-8">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold">Contract Drift Detector</h2>
              <button onclick="refreshDrift()" class="text-sky-400 hover:underline text-sm">Refresh Scan</button>
            </div>
            
            <div id="drift-list" class="space-y-4">
              <!-- Placeholder for Drift Items -->
              <div class="p-6 border border-slate-700 rounded-xl bg-slate-900/50 flex justify-between items-center">
                <div>
                  <h4 class="font-semibold text-slate-100">useUsers.total_price</h4>
                  <p class="text-sm text-slate-400">Drift: Field renamed to <span class="text-green-400 font-mono">amount</span> in OpenAPI</p>
                </div>
                <button onclick="resolveDrift('useUsers', 'total_price', 'amount')" class="btn-primary py-1 px-4 text-sm">
                  Apply Fix
                </button>
              </div>
            </div>
          </section>

          <!-- Scaffold Map Section -->
          <section id="tab-scaffold" class="tab-content hidden glass rounded-2xl p-8">
            <h2 class="text-2xl font-bold mb-6">API Scaffold Map</h2>
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 border border-slate-700 rounded-xl hover:border-sky-500/50 transition-colors group">
                <div class="flex justify-between items-start">
                  <div>
                    <span class="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">POST</span>
                    <h4 class="font-bold mt-2">/api/v1/billing/invoices</h4>
                  </div>
                  <button onclick="scaffold('/api/v1/billing/invoices')" class="text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    [+] Scaffold
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- Time Machine Section -->
          <section id="tab-history" class="tab-content hidden glass rounded-2xl p-8">
            <h2 class="text-2xl font-bold mb-6">Snapshot Time Machine</h2>
            <div class="space-y-4">
              ${snapshots.map(s => `
                <div class="flex items-center justify-between p-4 border-l-4 border-sky-500 bg-slate-900/40">
                  <div>
                    <div class="font-bold font-mono text-sm">${s.id}</div>
                    <div class="text-xs text-slate-500">${new Date(s.timestamp).toLocaleString()}</div>
                  </div>
                  <div class="flex gap-4 items-center">
                    <span class="text-xs px-2 py-1 rounded bg-slate-800">${s.backend.version}</span>
                    <button onclick="restoreSnapshot('${s.id}')" class="text-sky-400 text-sm hover:underline">Restore</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </main>
      </div>
    </div>

    <script>
      async function runCommand(cmd) {
        console.log('Running:', cmd);
        // Add real fetch calls to /api/_binder/...
      }

      function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.getElementById('tab-' + tabId).classList.remove('hidden');
      }

      async function resolveDrift(hook, oldField, newField) {
        const res = await fetch('/api/_binder/migrate/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookName: hook, oldFieldName: oldField, newFieldName: newField })
        });
        const data = await res.json();
        alert(data.message);
        location.reload();
      }

      async function scaffold(endpoint) {
        await fetch('/api/_binder/scaffold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        });
        alert('Scaffolded: ' + endpoint);
      }
    </script>
</body>
</html>`;

  const outDir = resolve(process.cwd(), 'binder');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  
  const outFile = join(outDir, 'dashboard.html');
  writeFileSync(outFile, html);
  
  logger.success(`✔ Spec Dashboard generated at ${pc.bold('binder/dashboard.html')}`);
}
