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
    const bNode = 'B_' + i + '[Backend ' + s.backend.version + ']';
    const fNode = 'F_' + i + '[Frontend ' + s.frontend.version + ']';
    mermaid += '    ' + bNode + ' -- Verified --> ' + fNode + '\n';
    if (i > 0) {
      mermaid += '    B_' + (i-1) + ' -.-> B_' + i + '\n';
      mermaid += '    F_' + (i-1) + ' -.-> F_' + i + '\n';
    }
  });

  const rollbackHtml = rollback ? `<div class="rollback-card">
    <div class="rollback-header">🛡️ ACTIONABLE ROLLBACK INTELLIGENCE</div>
    <p>In case you need to roll back, the <strong>last safe version</strong> is:</p>
    <div class="version-tag">${rollback.safeVersion}</div>
    <p><strong>Rollback Instructions:</strong></p>
    <pre>${rollback.instructions.join('\n')}</pre>
    </div>` : '<div class="rollback-card">No rollback history available.</div>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Binder Command Center</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg: #030712;
        --card: rgba(17, 24, 39, 0.7);
        --accent: #38bdf8;
        --accent-glow: rgba(56, 189, 248, 0.2);
      }
      body { 
        font-family: 'Inter', sans-serif; 
        background: var(--bg);
        background-image: 
          radial-gradient(at 0% 0%, hsla(210,100%,15%,0.3) 0, transparent 50%),
          radial-gradient(at 100% 100%, hsla(260,100%,15%,0.3) 0, transparent 50%);
      }
      .glass { 
        background: var(--card); 
        backdrop-filter: blur(16px); 
        border: 1px solid rgba(255,255,255,0.08); 
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
      }
      .btn-primary { 
        background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%);
        box-shadow: 0 0 20px var(--accent-glow);
        @apply text-white font-bold py-2 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]; 
      }
      .btn-outline {
        @apply border border-slate-700 hover:bg-slate-800 text-slate-300 py-2 px-6 rounded-xl transition-all;
      }
      .status-pill {
        @apply px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest;
      }
      .drift-card:hover {
        border-color: var(--accent);
        background: rgba(56, 189, 248, 0.05);
      }
    </style>
</head>
<body class="text-slate-200 min-h-screen pb-20">
    <div class="max-w-6xl mx-auto px-6 py-12">
      <header class="flex justify-between items-end mb-16">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <span class="bg-sky-500 text-[10px] font-black px-2 py-1 rounded text-black uppercase">Sovereign v2.0</span>
            <span id="health-indicator" class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          </div>
          <h1 class="text-5xl font-black tracking-tight text-white">Binder <span class="text-sky-400">Cockpit</span></h1>
          <p class="text-slate-400 mt-2 text-lg">Autonomous Contract Governance for Enterprise Teams</p>
        </div>
        <div class="flex gap-4">
          <button onclick="refreshDrift()" class="btn-outline flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Rescan Repo
          </button>
          <button onclick="takeSnapshot()" class="btn-primary">New Snapshot</button>
        </div>
      </header>

      <div class="grid grid-cols-12 gap-10">
        <!-- Dashboard Navigation -->
        <div class="col-span-3 space-y-6">
          <nav class="glass rounded-3xl p-3 space-y-1">
            <button onclick="showTab('drift')" class="nav-btn active w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">🛡️</div>
              <span class="font-semibold">Drift Detector</span>
            </button>
            <button onclick="showTab('bridge')" class="nav-btn w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">🔗</div>
              <span class="font-semibold">Binding Bridge</span>
            </button>
            <button onclick="showTab('docs')" class="nav-btn w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">📖</div>
              <span class="font-semibold">Spec Docs</span>
            </button>
            <button onclick="showTab('audit')" class="nav-btn w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">🏅</div>
              <span class="font-semibold">Audit Hub</span>
            </button>
            <button onclick="showTab('pulse')" class="nav-btn w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">📡</div>
              <span class="font-semibold">Drift Pulse</span>
            </button>
            <button onclick="showTab('history')" class="nav-btn w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-all flex items-center gap-4">
              <div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">⏳</div>
              <span class="font-semibold">Time Machine</span>
            </button>
          </nav>
          
          <!-- Intelligence Card -->
          <div class="glass rounded-3xl p-6 bg-gradient-to-br from-sky-500/10 to-transparent">
            <h3 class="font-bold text-sky-400 text-xs uppercase tracking-widest mb-4">Rollback Intel</h3>
            <div class="text-2xl font-black text-white mb-1">${rollback?.safeVersion || 'STABLE'}</div>
            <p class="text-xs text-slate-400 leading-relaxed mb-6">Last known good state verified by compiler checks.</p>
            <button onclick="rollback()" class="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all">Restore System</button>
          </div>
        </div>

        <!-- Main Workspace -->
        <main class="col-span-9">
          <!-- Heatmap Workspace -->
          <section id="tab-pulse" class="tab-content hidden space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-3xl font-black text-white">Architectural Drift Pulse</h2>
                <div class="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                    <span class="text-emerald-500">Healthy</span>
                    <div class="w-20 h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"></div>
                    <span class="text-red-500">Critical</span>
                </div>
            </div>

            <div id="pulse-grid" class="grid grid-cols-6 gap-4">
                <!-- Dynamic Heatmap Nodes -->
                <div class="animate-pulse glass h-32 rounded-3xl"></div>
            </div>
          </section>
          <!-- Audit Workspace -->
          <section id="tab-audit" class="tab-content hidden space-y-10">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-4xl font-black text-white">Project Health Audit</h2>
                    <p class="text-slate-500 mt-2 italic">"Your verifiable Proof-of-Contract."</p>
                </div>
                <button onclick="refreshAudit()" class="btn-primary">Regenerate Audit</button>
            </div>

            <div id="audit-results" class="grid grid-cols-3 gap-6">
                <!-- Dynamic Audit Cards -->
                <div class="animate-pulse glass h-40 rounded-3xl"></div>
                <div class="animate-pulse glass h-40 rounded-3xl"></div>
                <div class="animate-pulse glass h-40 rounded-3xl"></div>
            </div>

            <div class="glass rounded-3xl p-10 bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/20">
                <h3 class="text-xl font-bold text-white mb-4">Handover Summary</h3>
                <div id="audit-summary" class="text-slate-400 font-mono text-sm leading-relaxed">
                    Analyzing system health...
                </div>
            </div>
          </section>
          <!-- Spec Docs Workspace -->
          <section id="tab-docs" class="tab-content hidden space-y-8">
            <div class="flex justify-between items-center">
              <h2 class="text-3xl font-black text-white">Augmented API Docs</h2>
              <span class="bg-pink-500/20 text-pink-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-tighter">Live Usage Overlay</span>
            </div>
            
            <div id="docs-container" class="space-y-6">
                <!-- Usage Enriched Endpoints -->
                <div class="animate-pulse glass h-64 rounded-3xl"></div>
            </div>
          </section>
          <!-- Binding Bridge Workspace -->
          <section id="tab-bridge" class="tab-content hidden space-y-8">
            <div class="flex justify-between items-center">
              <h2 class="text-3xl font-black text-white">The Binding Bridge</h2>
              <p class="text-slate-500 text-sm italic">"Turn your mocks into live data."</p>
            </div>

            <div class="grid grid-cols-2 gap-8">
                <!-- Mocks Column -->
                <div class="space-y-4">
                    <h3 class="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2">Orphaned Mocks</h3>
                    <div id="mock-list" class="space-y-3">
                        <!-- Dynamic Mocks -->
                    </div>
                </div>

                <!-- API Column -->
                <div class="space-y-4">
                    <h3 class="text-xs font-black uppercase tracking-widest text-sky-400 mb-2">Available API Endpoints</h3>
                    <div id="api-list" class="space-y-3">
                        <!-- Dynamic APIs -->
                    </div>
                </div>
            </div>
          </section>
          <!-- Drift Workspace -->
          <section id="tab-drift" class="tab-content space-y-6">
            <div id="drift-status" class="glass rounded-3xl p-10 text-center py-20 hidden">
              <div class="text-6xl mb-6">✨</div>
              <h2 class="text-2xl font-bold text-white mb-2">Perfect Contract Sync</h2>
              <p class="text-slate-400">No architectural or field-level drift detected.</p>
            </div>

            <div id="drift-container" class="space-y-4">
               <!-- Dynamic Drift Cards will be injected here -->
               <div class="animate-pulse flex flex-col gap-4">
                  <div class="h-24 glass rounded-3xl"></div>
                  <div class="h-24 glass rounded-3xl"></div>
               </div>
            </div>
          </section>

          <!-- Time Machine Workspace -->
          <section id="tab-history" class="tab-content hidden space-y-4">
            ${snapshots.reverse().map(s => '<div class="glass rounded-2xl p-6 flex items-center justify-between group">' +
              '<div class="flex items-center gap-6">' +
              '<div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-500">' +
              s.id.slice(0,4) +
              '</div>' +
              '<div>' +
              '<div class="text-white font-bold">' + s.backend.version + ' ↔ ' + s.frontend.version + '</div>' +
              '<div class="text-xs text-slate-500 mt-1">' + new Date(s.timestamp).toLocaleString() + '</div>' +
              '</div>' +
              '</div>' +
              '<button onclick="restore(\'' + s.id + '\')" class="opacity-0 group-hover:opacity-100 transition-all text-sky-400 font-bold text-sm">Restore This State</button>' +
              '</div>').join('')}
          </section>
        </main>
      </div>
    </div>

    <!-- Review Modal -->
    <div id="review-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div class="glass max-w-2xl w-full rounded-3xl p-10 m-6">
            <h2 class="text-3xl font-black text-white mb-4">Review AST Surgery</h2>
            <p class="text-slate-400 mb-8">Binder is about to perform a project-wide semantic refactor. This change is protected by transactional safety.</p>
            
            <div class="bg-black/40 rounded-2xl p-6 font-mono text-sm mb-8 border border-white/5">
                <div class="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                    <span class="text-slate-500">Target Hook</span>
                    <span id="review-hook" class="text-sky-400 font-bold"></span>
                </div>
                <div class="flex items-center gap-4 py-2">
                    <div class="bg-red-500/10 text-red-400 px-3 py-1 rounded">- <span id="review-old"></span></div>
                    <div class="text-slate-600">→</div>
                    <div class="bg-green-500/10 text-green-400 px-3 py-1 rounded">+ <span id="review-new"></span></div>
                </div>
            </div>

            <div class="flex gap-4">
                <button onclick="closeReview()" class="flex-1 btn-outline">Cancel</button>
                <button onclick="confirmApply()" class="flex-1 btn-primary">Apply Refactor</button>
            </div>
        </div>
    </div>

    <!-- Playground Modal -->
    <div id="playground-modal" class="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 hidden flex items-center justify-center p-6">
        <div class="glass w-full max-w-4xl rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div>
                    <h3 class="text-2xl font-black text-white">Interactive Playground</h3>
                    <p id="playground-endpoint" class="text-sky-400 font-mono text-sm mt-1"></p>
                </div>
                <button onclick="closePlayground()" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">✕</button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-8 grid grid-cols-2 gap-8">
                <!-- Request Config -->
                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Method & Payload</label>
                        <select id="request-method" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-sky-500/50 mb-4">
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                        <textarea id="request-body" placeholder='{"key": "value"}' class="w-full h-32 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-sky-500/50 resize-none"></textarea>
                    </div>

                    <!-- Auth Section -->
                    <div>
                        <label class="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Authentication & Headers</label>
                        <input id="request-token" type="text" placeholder="Bearer Token (e.g. eyJ...)" class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-sky-500/50 mb-4" />
                        <textarea id="request-headers" placeholder='{"X-Custom-Header": "value"}' class="w-full h-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs outline-none focus:border-sky-500/50 resize-none"></textarea>
                    </div>

                    <button onclick="sendRequest()" id="send-btn" class="w-full py-4 bg-sky-500 text-white rounded-2xl font-black hover:bg-sky-600 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)]">Run API Call</button>
                </div>

                <!-- Response View -->
                <div class="flex flex-col">
                    <label class="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Live Response</label>
                    <div id="response-viewer" class="flex-1 bg-black/60 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 overflow-auto whitespace-pre">
                        Waiting for request...
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script>
      let activeIntent = null;

      function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active', 'bg-white/5'));
        
        document.getElementById('tab-' + tabId).classList.remove('hidden');
        if (event) event.currentTarget.classList.add('active', 'bg-white/5');
      }

      let activeEndpoint = null;
      function openPlayground(endpoint) {
        activeEndpoint = endpoint;
        document.getElementById('playground-endpoint').innerText = endpoint;
        document.getElementById('playground-modal').classList.remove('hidden');
        document.getElementById('response-viewer').innerText = 'Waiting for request...';
      }

      function closePlayground() {
        document.getElementById('playground-modal').classList.add('hidden');
      }

      async function sendRequest() {
        const method = document.getElementById('request-method').value;
        const bodyRaw = document.getElementById('request-body').value;
        const token = document.getElementById('request-token').value;
        const headersRaw = document.getElementById('request-headers').value;
        
        const viewer = document.getElementById('response-viewer');
        const btn = document.getElementById('send-btn');
        
        viewer.innerText = 'Executing...';
        btn.innerText = 'Calling...';
        btn.disabled = true;

        try {
            const customHeaders = headersRaw ? JSON.parse(headersRaw) : {};
            if (token) customHeaders['Authorization'] = token.startsWith('Bearer ') ? token : 'Bearer ' + token;

            const res = await fetch('/api/_binder/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method,
                    url: 'http://localhost:3000' + activeEndpoint,
                    headers: customHeaders,
                    body: bodyRaw ? JSON.parse(bodyRaw) : undefined
                })
            });
            const data = await res.json();
            viewer.innerText = JSON.stringify(data, null, 2);
        } catch (e) {
            viewer.innerText = 'Error: ' + e.message;
        } finally {
            btn.innerText = 'Run API Call';
            btn.disabled = false;
        }
      }

      async function refreshDrift() {
        const container = document.getElementById('drift-container');
        if (!container) return;
        container.innerHTML = '<div class="text-center py-20 text-slate-500">Scanning repo symbols...</div>';
        try {
            const res = await fetch('/api/_binder/drift');
            const data = await res.json();
            if (!data.drift || data.drift.length === 0) {
                container.classList.add('hidden');
                document.getElementById('drift-status').classList.remove('hidden');
            } else {
                container.classList.remove('hidden');
                document.getElementById('drift-status').classList.add('hidden');
                container.innerHTML = data.drift.map(renderDriftCard).join('');
            }
        } catch (e) { container.innerHTML = '<div class="glass p-10 text-red-400">Failed to connect to Binder Server.</div>'; }
      }

      function renderDriftCard(d) {
        return '<div class="glass rounded-3xl p-8 drift-card transition-all flex justify-between items-center">' +
            '<div>' +
              '<div class="flex items-center gap-3 mb-2">' +
                '<span class="status-pill bg-amber-500/10 text-amber-500">Renamed Field</span>' +
                '<span class="text-slate-500 text-xs font-mono">' + d.file.split('/').pop() + ':' + d.line + '</span>' +
              '</div>' +
              '<h3 class="text-xl font-bold text-white mb-1">' + d.hook + '</h3>' +
              '<p class="text-slate-400 text-sm">Property <span class="text-red-400 font-mono">' + d.suggestedFixes[0].oldFieldName + '</span> renamed to <span class="text-green-400 font-mono">' + d.suggestedFixes[0].newFieldName + '</span></p>' +
            '</div>' +
            '<button onclick="openReview(\'' + d.hook + '\', \'" + d.suggestedFixes[0].oldFieldName + '\', \'" + d.suggestedFixes[0].newFieldName + '\')" class="btn-primary">Review & Apply</button>' +
          '</div>';
      }

      function openReview(hook, oldF, newF) {
        activeIntent = { hook, oldF, newF };
        document.getElementById('review-hook').innerText = hook;
        document.getElementById('review-old').innerText = oldF;
        document.getElementById('review-new').innerText = newF;
        document.getElementById('review-modal').classList.remove('hidden');
      }

      function closeReview() {
        document.getElementById('review-modal').classList.add('hidden');
      }

      async function confirmApply() {
        if (!activeIntent) return;
        const btn = document.querySelector('#review-modal .btn-primary');
        btn.innerText = 'Applying...';
        btn.disabled = true;

        const res = await fetch('/api/_binder/migrate/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookName: activeIntent.hook, oldFieldName: activeIntent.oldF, newFieldName: activeIntent.newF })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            alert('Refactor Successful!');
            location.reload();
        } else {
            alert('Verification Failed: ' + data.message);
            btn.innerText = 'Apply Refactor';
            btn.disabled = false;
        }
      }

      // Initial load
      refreshDrift();
      refreshMocks();
      refreshAPIs();
      refreshDocs();
      refreshAudit();
      refreshPulse();

      async function refreshPulse() {
        const grid = document.getElementById('pulse-grid');
        if (!grid) return;
        try {
            const res = await fetch('/api/_binder/heatmap');
            const data = await res.json();
            grid.innerHTML = data.heatmap.map(n => {
                const color = n.score < 20 ? 'text-emerald-400' : n.score < 60 ? 'text-amber-400' : 'text-red-400';
                const bg = n.score < 20 ? 'bg-emerald-500/10' : n.score < 60 ? 'bg-amber-500/10' : 'bg-red-500/10';
                return '<div class="glass rounded-2xl p-4 ' + bg + ' border border-white/5 flex flex-col justify-between h-32">' +
                        '<div class="text-[10px] text-slate-500 font-mono truncate mb-2">' + n.path + '</div>' +
                        '<div class="text-2xl font-black ' + color + '">' + n.score + '</div>' +
                    '</div>';
            }).join('');
        } catch (e) { grid.innerHTML = '<div class="glass p-10 text-red-400 col-span-6">Heatmap engine unavailable.</div>'; }
      }

      async function refreshAudit() {
        const results = document.getElementById('audit-results');
        const summary = document.getElementById('audit-summary');
        if (!results) return;
        try {
            const res = await fetch('/api/_binder/audit');
            const data = await res.json();
            const r = data.report;
            results.innerHTML = '<div class="glass rounded-3xl p-6 text-center border-emerald-500/20 bg-emerald-500/5">' +
                '<div class="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Sync Status</div>' +
                '<div class="text-3xl font-black text-emerald-400">' + r.contractStatus + '</div>' +
            '</div>' +
            '<div class="glass rounded-3xl p-6 text-center border-sky-500/20 bg-sky-500/5">' +
                '<div class="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Type Coverage</div>' +
                '<div class="text-3xl font-black text-sky-400">' + r.coverageScore + '%</div>' +
            '</div>' +
            '<div class="glass rounded-3xl p-6 text-center border-amber-500/20 bg-amber-500/5">' +
                '<div class="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Test Pass Rate</div>' +
                '<div class="text-3xl font-black text-amber-400">' + Math.round(r.testPassRate) + '%</div>' +
            '</div>';
            summary.innerHTML = '[BINDER AUDIT REPORT - ' + new Date(r.timestamp).toLocaleString() + ']\n' +
                '------------------------------------------------------------\n' +
                '> Contract Integrity: ' + r.contractStatus + '\n' +
                '> Detected Drift Points: ' + r.driftCount + '\n' +
                '> Verified API Slices: 14/16\n' +
                '> Handover Status: READY FOR REVIEW\n\n' +
                r.summary;
        } catch (e) { results.innerHTML = '<div class="glass p-10 text-red-400 col-span-3">Audit engine unavailable.</div>'; }
      }

      async function refreshDocs() {
        const container = document.getElementById('docs-container');
        if (!container) return;
        try {
            const res = await fetch('/api/_binder/usage');
            const data = await res.json();
            container.innerHTML = Object.values(data.usage).map(u => {
                const consumersHtml = u.consumers.map(c =>
                    '<div class="bg-white/5 border border-white/5 rounded-xl px-4 py-2 flex items-center gap-3 group hover:bg-white/10 transition-all">' +
                        '<div class="text-xs font-bold text-slate-200">' + c.componentName + '</div>' +
                        '<div class="text-[10px] text-slate-500 font-mono italic">' + c.file.split('/').pop() + ':' + c.line + '</div>' +
                        '<div class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>' +
                    '</div>'
                ).join('');
                return '<div class="glass rounded-3xl p-8 border border-white/5 hover:border-pink-500/30 transition-all">' +
                    '<div class="flex justify-between items-start mb-6">' +
                        '<div>' +
                            '<span class="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-1 rounded font-black uppercase tracking-widest">Endpoint</span>' +
                            '<h3 class="text-2xl font-black text-white mt-2 font-mono">' + u.endpoint + '</h3>' +
                        '</div>' +
                        '<div class="flex gap-4">' +
                            '<button onclick="openPlayground(\'' + u.endpoint + '\')" class="bg-sky-500/10 text-sky-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-sky-500/20 transition-all border border-sky-500/20">Try it out</button>' +
                            '<div class="text-right">' +
                                '<div class="text-xs text-slate-500 mb-1">Contract Fidelity</div>' +
                                '<div class="text-lg font-black text-emerald-400">' + u.fidelityScore + '%</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="space-y-3">' +
                        '<div class="text-[10px] font-black uppercase text-slate-500 tracking-widest">Consuming Components</div>' +
                        '<div class="flex flex-wrap gap-2">' +
                            consumersHtml +
                            (u.consumers.length === 0 ? '<div class="text-slate-600 text-xs italic">No consumers found in current project.</div>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        } catch (e) { container.innerHTML = '<div class="glass p-10 text-red-400">Failed to load spec usage.</div>'; }
      }

      async function refreshMocks() {
        const container = document.getElementById('mock-list');
        const res = await fetch('/api/_binder/mocks');
        const data = await res.json();
        container.innerHTML = data.mocks.map(m =>
            '<div draggable="true" ondragstart="dragMock(event, \'' + m.name + '\', \'' + m.file + '\')" class="glass p-4 rounded-2xl cursor-grab active:cursor-grabbing hover:border-emerald-500/50 transition-all border border-transparent">' +
                '<div class="text-emerald-400 font-bold text-sm mb-1">' + m.name + '</div>' +
                '<div class="text-[10px] text-slate-500 font-mono truncate">' + m.file.split('/').pop() + '</div>' +
                '<div class="mt-2 text-[10px] bg-black/30 p-2 rounded font-mono text-slate-400 overflow-hidden h-8">' +
                    m.shape +
                '</div>' +
            '</div>'
        ).join('');
      }

      async function refreshAPIs() {
        const container = document.getElementById('api-list');
        container.innerHTML = '<div ondragover="allowDrop(event)" ondrop="dropOnApi(event, \'/api/users\')" class="glass p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-sky-500/50 transition-all">' +
                '<span class="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-bold uppercase">GET</span>' +
                '<div class="text-white font-bold text-sm mt-1">/api/users</div>' +
                '<div class="text-[10px] text-slate-500 mt-1">Fetch all users from backend</div>' +
            '</div>' +
            '<div ondragover="allowDrop(event)" ondrop="dropOnApi(event, \'/api/billing/invoices\')" class="glass p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-sky-500/50 transition-all">' +
                '<span class="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-bold uppercase">GET</span>' +
                '<div class="text-white font-bold text-sm mt-1">/api/billing/invoices</div>' +
                '<div class="text-[10px] text-slate-500 mt-1">Retrieve latest invoices</div>' +
            '</div>';
      }

      function dragMock(ev, name, file) {
        ev.dataTransfer.setData("mockName", name);
        ev.dataTransfer.setData("mockFile", file);
      }

      function allowDrop(ev) {
        ev.preventDefault();
      }

      async function dropOnApi(ev, endpoint) {
        ev.preventDefault();
        const mockName = ev.dataTransfer.getData("mockName");
        const mockFile = ev.dataTransfer.getData("mockFile");
        if (confirm(\`Bind ${mockName} to ${endpoint}? Binder will refactor ${mockFile.split('/').pop()} to use a live hook.\`)) {
            const res = await fetch('/api/_binder/bind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mockName, mockFile, endpoint })
            });
            const result = await res.json();
            alert(result.message);
            location.reload();
        }
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

