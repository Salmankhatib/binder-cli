// src/analysis/propTracer.ts
export const BINDER_V2 = true;
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

/**
 * tracePropDrilling semantically follows a mock variable as it is passed 
 * through React components via JSX props.
 */
export async function tracePropDrilling(
  mockName: string,
  sourceFile: SourceFile,
  project: Project,
  depth: number = 0,
  maxDepth: number = 5,
  visited: Set<string> = new Set()
): Promise<PropDrillResult[]> {
  const results: PropDrillResult[] = [];
  if (depth >= maxDepth) return results;

  // 1. Find usages of the mock in the current file
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .filter(id => id.getText() === mockName);

  for (const id of identifiers) {
    const jsxAttr = id.getFirstAncestorByKind(SyntaxKind.JsxAttribute);
    if (!jsxAttr || !Node.isJsxAttribute(jsxAttr)) continue;
    
    // We found a place where the mock is passed as a prop
    const propName = jsxAttr.getNameNode().getText();
    const openingEl = jsxAttr.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement) || 
                      jsxAttr.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);
    
    if (!openingEl) continue;
    
    const componentName = (openingEl as any).getTagNameNode().getText();
    
    // 2. Resolve the target component's definition
    let targetFile = 'unknown';
    let targetSourceFile: SourceFile | undefined;
    let componentDeclaration: Node | undefined;

    try {
        const definitions = (openingEl as any).getTagNameNode().getDefinitions();
        if (definitions && definitions.length > 0) {
            const def = definitions[0];
            targetFile = def.getSourceFile().getFilePath();
            targetSourceFile = project.getSourceFile(targetFile);
            componentDeclaration = def.getDeclarationNode();
        }
    } catch (e) {
        // Fallback for missing definitions
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

    // 3. Semantic Hand-off: Find the local name of this prop in the child component
    if (targetSourceFile && componentDeclaration) {
        const localMockNameInChild = findLocalPropName(componentDeclaration, propName);
        
        if (localMockNameInChild) {
            const nextDrills = await tracePropDrilling(
                localMockNameInChild, 
                targetSourceFile, 
                project, 
                depth + 1, 
                maxDepth, 
                visited
            );
            results.push(...nextDrills);
        }
    }
  }
  
  return results;
}

/**
 * Identifies how a prop is named inside a component's body.
 * Handles destructuring: ({ user }) => ... and (props) => ... (partially)
 */
function findLocalPropName(componentNode: Node, targetProp: string): string | null {
    let params: any[] = [];
    
    if (Node.isFunctionDeclaration(componentNode) || Node.isArrowFunction(componentNode) || Node.isFunctionExpression(componentNode)) {
        params = componentNode.getParameters();
    }

    if (params.length === 0) return null;

    const firstParam = params[0];
    const nameNode = firstParam.getNameNode();

    // Case 1: Destructured props - const MyComp = ({ user: u }) => ...
    if (Node.isObjectBindingPattern(nameNode)) {
        const element = nameNode.getElements().find(el => {
            const propName = el.getPropertyNameNode()?.getText() || el.getNameNode().getText();
            return propName === targetProp;
        });
        if (element) {
            return element.getNameNode().getText();
        }
    }

    // Case 2: Named props object - const MyComp = (props) => ...
    // We return the prop name itself but the tracer would need to look for `props.${targetProp}`
    // For now, we return the targetProp as a heuristic if the param is 'props' or similar.
    if (Node.isIdentifier(nameNode)) {
        const paramName = nameNode.getText();
        if (paramName.toLowerCase().includes('props')) {
            // This is a limitation: the next level of tracePropDrilling will look for 
            // a global variable matching the name, which might fail if it's accessed via props.user.
            // TODO: Enhance tracer to support property-access-based mock tracking.
            return null; 
        }
    }

    return null;
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
