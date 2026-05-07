// src/analysis/propTracer.ts
import { Project, SyntaxKind, Node, Identifier, SourceFile } from 'ts-morph';
import { GlobalStateTracer, DataFlowNode } from './globalStateTracer.js';

export interface PropDrillResult {
  sourceFile: string;
  targetFile: string;
  propName: string;
  componentName: string;
}

export interface GlobalStateResult {
  kind: 'write' | 'read';
  provider: string;
  sliceKey: string;
  file: string;
  line: number;
}

/**
 * Unified result from tracing a mock across BOTH prop drilling and global state.
 */
export interface DataFlowResult {
  propDrilling: PropDrillResult[];
  globalState: {
    writes: GlobalStateResult[];
    reads: GlobalStateResult[];
    edges: { from: string; to: string; via: string }[];
  };
  /** All discovered consumers, regardless of transport mechanism */
  allConsumers: { file: string; line: number; mechanism: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Prop Drilling Tracer (existing, unchanged in logic)
// ─────────────────────────────────────────────────────────────────────────────

export async function tracePropDrilling(
  mockName: string,
  sourceFile: any,
  project: Project,
  depth: number = 0,
  maxDepth: number = 5,
  visited: Set<string> = new Set()
): Promise<PropDrillResult[]> {
  const results: PropDrillResult[] = [];
  if (depth >= maxDepth) return results;

  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id: Identifier) => id.getText() === mockName);

  for (const id of identifiers) {
    const jsxAttr = id.getFirstAncestorByKind(SyntaxKind.JsxAttribute);
    if (!jsxAttr) continue;
    
    const propName = (jsxAttr as any).getNameNode?.().getText() || (jsxAttr as any).getName?.() || 'unknown';
    const openingEl = (jsxAttr as any).getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) || 
                      (jsxAttr as any).getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);
    
    if (!openingEl) continue;
    
    const componentName = (openingEl as any).getTagNameNode().getText();
    
    let targetFile = 'unknown';
    let targetSourceFile = null;
    try {
        const definitions = (openingEl as any).getTagNameNode().getDefinitions();
        if (definitions && definitions.length > 0) {
            targetFile = definitions[0].getSourceFile().getFilePath();
            targetSourceFile = project.getSourceFile(targetFile);
        }
    } catch (e) {
        // Fallback for isolated files
    }

    const drillId = `${sourceFile.getFilePath()}->${targetFile}:${propName}`;
    if (visited.has(drillId)) continue;
    visited.add(drillId);

    results.push({
        sourceFile: sourceFile.getFilePath(),
        targetFile: targetFile,
        propName,
        componentName
    });

    if (targetSourceFile && targetFile !== 'unknown') {
        const nextDrills = await tracePropDrilling(propName, targetSourceFile, project, depth + 1, maxDepth, visited);
        results.push(...nextDrills);
    }
  }
  
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Data-Flow Tracer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * traceDataFlow is the top-level unified function.
 *
 * Given a mock variable name it:
 *  1. Traces JSX prop drilling (existing engine)
 *  2. Builds the global state graph (Redux / Zustand / Context)
 *  3. Finds all downstream consumers via dispatch, useSelector, setState, etc.
 *  4. Returns a single unified DataFlowResult
 */
export async function traceDataFlow(
  mockName: string,
  project: Project,
  rootSourceFile: SourceFile,
): Promise<DataFlowResult> {
  // 1. Prop drilling
  const propDrilling = await tracePropDrilling(mockName, rootSourceFile, project);

  // 2. Global state graph — scan all loaded files
  const tracer = new GlobalStateTracer(project);
  const sourceFiles = project.getSourceFiles();
  const graph = await tracer.buildGraph(sourceFiles);

  // 3. Find consumers of this mock via global state
  const consumers = tracer.getConsumers(mockName);

  const writes = Array.from(graph.nodes.values())
    .filter(n => n.kind === 'write')
    .map(nodeToResult);

  const reads = Array.from(graph.nodes.values())
    .filter(n => n.kind === 'read')
    .map(nodeToResult);

  // 4. Unify: all places data ends up
  const allConsumers: DataFlowResult['allConsumers'] = [
    ...propDrilling.map(p => ({
      file: p.targetFile,
      line: 0,
      mechanism: `JSX prop drilling via <${p.componentName} ${p.propName}={...}>`
    })),
    ...consumers.map(c => ({
      file: c.file,
      line: c.line,
      mechanism: `Global state [${c.provider}] read via "${c.sliceKey}"`
    }))
  ];

  return {
    propDrilling,
    globalState: { writes, reads, edges: graph.edges },
    allConsumers,
  };
}

function nodeToResult(n: DataFlowNode): GlobalStateResult {
  return { kind: n.kind, provider: n.provider, sliceKey: n.sliceKey, file: n.file, line: n.line };
}
