import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { resolve, join } from 'path';
import { GlobalStateTracer } from '../src/analysis/globalStateTracer.js';

const FIXTURES = resolve(process.cwd(), 'tests/fixtures');

function makeProject(...files: string[]) {
  const project = new Project({
    compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true, strict: false }
  });
  files.forEach(f => project.addSourceFileAtPath(join(FIXTURES, f)));
  return project;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redux
// ─────────────────────────────────────────────────────────────────────────────

describe('GlobalStateTracer — Redux', () => {
  it('should detect dispatch(actionCreator()) as a WRITE node', async () => {
    const project = makeProject('reduxComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    const writes = Array.from(graph.nodes.values()).filter(n => n.kind === 'write');
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes.some(w => w.sliceKey.toLowerCase().includes('user'))).toBe(true);
  });

  it('should detect useSelector() as a READ node', async () => {
    const project = makeProject('reduxComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    const reads = Array.from(graph.nodes.values()).filter(n => n.kind === 'read');
    expect(reads.length).toBeGreaterThanOrEqual(1);
    expect(reads.some(r => r.sliceKey === 'user')).toBe(true);
    expect(reads.some(r => r.sliceKey === 'settings')).toBe(true);
  });

  it('should connect WRITE → READ for the same slice key', async () => {
    const project = makeProject('reduxComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    // Should have at least one edge for user
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
    const userEdge = graph.edges.find(e => e.via.toLowerCase().includes('user'));
    expect(userEdge).toBeDefined();
  });

  it('getConsumers() should return READ nodes downstream of a mock field', async () => {
    const project = makeProject('reduxComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    await tracer.buildGraph(project.getSourceFiles());

    const consumers = tracer.getConsumers('user');
    expect(consumers.length).toBeGreaterThanOrEqual(1);
    expect(consumers[0].kind).toBe('read');
    expect(consumers[0].provider).toBe('redux');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Zustand
// ─────────────────────────────────────────────────────────────────────────────

describe('GlobalStateTracer — Zustand', () => {
  it('should detect set({ user }) as a WRITE node', async () => {
    const project = makeProject('zustandComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    const writes = Array.from(graph.nodes.values()).filter(n => n.kind === 'write' && n.provider === 'zustand');
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes.some(w => w.sliceKey === 'user')).toBe(true);
  });

  it('should detect destructured useStore() as READ nodes', async () => {
    const project = makeProject('zustandComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    const reads = Array.from(graph.nodes.values()).filter(n => n.kind === 'read' && n.provider === 'zustand');
    expect(reads.some(r => r.sliceKey === 'user')).toBe(true);
  });

  it('should connect Zustand WRITE → READ edges', async () => {
    const project = makeProject('zustandComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    const graph = await tracer.buildGraph(project.getSourceFiles());

    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mermaid Output
// ─────────────────────────────────────────────────────────────────────────────

describe('GlobalStateTracer — Mermaid', () => {
  it('should produce a valid Mermaid diagram string', async () => {
    const project = makeProject('reduxComponent.tsx');
    const tracer = new GlobalStateTracer(project);
    await tracer.buildGraph(project.getSourceFiles());

    const mermaid = tracer.toMermaid();
    expect(mermaid).toContain('graph LR');
    expect(mermaid).toContain('-->');
  });
});
