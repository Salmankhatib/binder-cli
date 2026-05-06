// src/analysis/globalStateTracer.ts
import { Project, SyntaxKind, SourceFile, CallExpression, Identifier } from 'ts-morph';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StateProvider = 'redux' | 'zustand' | 'context';

/** A single node in the data-flow graph */
export interface DataFlowNode {
  id: string;
  kind: 'write' | 'read';
  provider: StateProvider;
  /** The slice action name (Redux) or store selector (Zustand/Context) */
  sliceKey: string;
  /** The data field being written/read, e.g. "userData" */
  dataField: string;
  file: string;
  line: number;
}

/** A directed edge: data flows FROM source node TO sink node */
export interface DataFlowEdge {
  from: string; // DataFlowNode.id
  to: string;   // DataFlowNode.id
  via: string;  // human-readable description, e.g. "dispatch(setUser) → useSelector(state.user)"
}

export interface DataFlowGraph {
  nodes: Map<string, DataFlowNode>;
  edges: DataFlowEdge[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns that indicate a WRITE into global state */
const WRITE_PATTERNS = {
  redux: /^dispatch$/,
  zustand: /^(set|setState|useStore)$/,
  context: /^(dispatch|setValue|setContext)$/,
};

/** Patterns that indicate a READ from global state */
const READ_PATTERNS = {
  redux: /^useSelector$/,
  zustand: /^useStore$/,
  context: /^useContext$/,
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Tracer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GlobalStateTracer builds a complete data-flow graph for a project,
 * covering Redux, Zustand, and React Context patterns.
 *
 * Graph construction:
 *  1. Scan all source files for WRITE nodes (dispatch, setState, etc.)
 *  2. Scan all source files for READ nodes (useSelector, useStore, etc.)
 *  3. Connect WRITEs to READs that reference the same slice key / selector
 */
export class GlobalStateTracer {
  private project: Project;
  private graph: DataFlowGraph = { nodes: new Map(), edges: [] };

  constructor(project: Project) {
    this.project = project;
  }

  async buildGraph(sourceFiles: SourceFile[]): Promise<DataFlowGraph> {
    for (const sf of sourceFiles) {
      this.extractWrites(sf);
      this.extractReads(sf);
    }
    this.connectEdges();
    return this.graph;
  }

  // ── WRITES ──────────────────────────────────────────────────────────────────

  private extractWrites(sf: SourceFile) {
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const callee = call.getExpression().getText();

      // Redux: dispatch(setUser(data)) or dispatch({ type: 'user/setUser', payload: data })
      if (WRITE_PATTERNS.redux.test(callee)) {
        this.handleReduxDispatch(call, sf);
        return;
      }

      // Zustand: setState({ user: data }) or store.setState(...)
      if (WRITE_PATTERNS.zustand.test(callee) && !READ_PATTERNS.zustand.test(callee)) {
        this.handleZustandSet(call, sf);
        return;
      }
    });
  }

  private handleReduxDispatch(dispatch: CallExpression, sf: SourceFile) {
    // dispatch(actionCreator(payload))
    const args = dispatch.getArguments();
    if (args.length === 0) return;

    const innerArg = args[0];
    // Case 1: dispatch(someActionCreator(payload))
    if (innerArg.getKind() === SyntaxKind.CallExpression) {
      const innerCall = innerArg.asKindOrThrow(SyntaxKind.CallExpression);
      const actionName = innerCall.getExpression().getText();
      const node = this.makeNode('write', 'redux', this.sliceKeyFromAction(actionName), actionName, sf, dispatch.getStartLineNumber());
      this.graph.nodes.set(node.id, node);
      return;
    }

    // Case 2: dispatch({ type: 'slice/action' })
    if (innerArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const obj = innerArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
      const typeProp = obj.getProperty('type');
      if (typeProp) {
        const typeStr = typeProp.getLastChild()?.getText().replace(/['"]/g, '') ?? 'unknown';
        const node = this.makeNode('write', 'redux', this.sliceKeyFromAction(typeStr), typeStr, sf, dispatch.getStartLineNumber());
        this.graph.nodes.set(node.id, node);
      }
    }
  }

  private handleZustandSet(call: CallExpression, sf: SourceFile) {
    // set({ user: data }) or setState((s) => ({ ...s, user: data }))
    const args = call.getArguments();
    if (args.length === 0) return;

    const arg = args[0];
    if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
      arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
        .getProperties()
        .forEach(prop => {
          const key = prop.getFirstChild()?.getText() ?? 'unknown';
          const node = this.makeNode('write', 'zustand', key, key, sf, call.getStartLineNumber());
          this.graph.nodes.set(node.id, node);
        });
    }
  }

  // ── READS ───────────────────────────────────────────────────────────────────

  private extractReads(sf: SourceFile) {
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const callee = call.getExpression().getText();

      // Redux: useSelector(state => state.user.data)
      if (READ_PATTERNS.redux.test(callee)) {
        this.handleUseSelector(call, sf);
        return;
      }

      // Zustand: const { user } = useStore()
      if (READ_PATTERNS.zustand.test(callee)) {
        this.handleZustandRead(call, sf);
        return;
      }

      // Context: const ctx = useContext(UserContext)
      if (READ_PATTERNS.context.test(callee)) {
        this.handleUseContext(call, sf);
        return;
      }
    });
  }

  private handleUseSelector(call: CallExpression, sf: SourceFile) {
    const args = call.getArguments();
    if (args.length === 0) return;

    // Extract selector path from arrow function: (state) => state.user.data
    const selector = args[0].getText();
    const selectorKey = this.extractSelectorKey(selector);

    const node = this.makeNode('read', 'redux', selectorKey, selector, sf, call.getStartLineNumber());
    this.graph.nodes.set(node.id, node);
  }

  private handleZustandRead(call: CallExpression, sf: SourceFile) {
    // const { user, settings } = useStore()
    const parent = call.getParent();
    if (parent?.getKind() === SyntaxKind.VariableDeclaration) {
      const nameNode = parent.asKindOrThrow(SyntaxKind.VariableDeclaration).getNameNode();
      if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
        nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern)
          .getElements()
          .forEach(el => {
            const key = el.getNameNode().getText();
            const node = this.makeNode('read', 'zustand', key, key, sf, call.getStartLineNumber());
            this.graph.nodes.set(node.id, node);
          });
      }
    }
  }

  private handleUseContext(call: CallExpression, sf: SourceFile) {
    const args = call.getArguments();
    if (args.length === 0) return;
    const contextName = args[0].getText(); // e.g. "UserContext"
    const node = this.makeNode('read', 'context', contextName, contextName, sf, call.getStartLineNumber());
    this.graph.nodes.set(node.id, node);
  }

  // ── EDGE CONSTRUCTION ────────────────────────────────────────────────────────

  /**
   * Connect WRITE nodes to READ nodes that share the same sliceKey.
   * This is the core of the global data-flow graph.
   */
  private connectEdges() {
    const writes = Array.from(this.graph.nodes.values()).filter(n => n.kind === 'write');
    const reads  = Array.from(this.graph.nodes.values()).filter(n => n.kind === 'read');

    for (const write of writes) {
      for (const read of reads) {
        if (write.provider === read.provider && this.keysOverlap(write.sliceKey, read.sliceKey)) {
          this.graph.edges.push({
            from: write.id,
            to: read.id,
            via: `${write.dataField} → ${read.dataField}`,
          });
        }
      }
    }
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  private makeNode(
    kind: 'write' | 'read',
    provider: StateProvider,
    sliceKey: string,
    dataField: string,
    sf: SourceFile,
    line: number,
  ): DataFlowNode {
    const id = `${kind}:${provider}:${sliceKey}:${sf.getFilePath()}:${line}`;
    return { id, kind, provider, sliceKey, dataField, file: sf.getFilePath(), line };
  }

  /**
   * Extracts the Redux slice key from a selector.
   * "(state) => state.user.data"  →  "user"
   * "state => state.settings"      →  "settings"
   */
  private extractSelectorKey(selector: string): string {
    const match = selector.match(/state\.(\w+)/);
    return match ? match[1] : selector;
  }

  /**
   * Extracts the Redux slice key from an action creator name.
   * "setUserData"  →  "user"
   * "user/setUserData" → "user"
   */
  private sliceKeyFromAction(action: string): string {
    if (action.includes('/')) return action.split('/')[0]; // "user/setData" → "user"
    // Heuristic: remove verb prefixes (set, update, clear, reset, fetch)
    return action.replace(/^(set|update|clear|reset|fetch|load)/, '').charAt(0).toLowerCase() +
           action.replace(/^(set|update|clear|reset|fetch|load)/, '').slice(1);
  }

  /**
   * Two slice keys overlap if one contains the other (handles "user" vs "userData").
   */
  private keysOverlap(a: string, b: string): boolean {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    return al === bl || al.startsWith(bl) || bl.startsWith(al);
  }

  // ── PUBLIC QUERY API ─────────────────────────────────────────────────────────

  /**
   * Given a mock variable name or data field, returns all READ nodes
   * that ultimately consume it — the "downstream consumers".
   */
  getConsumers(mockField: string): DataFlowNode[] {
    const lowerField = mockField.toLowerCase();
    const writeNodes = Array.from(this.graph.nodes.values())
      .filter(n => n.kind === 'write' && this.keysOverlap(n.sliceKey, lowerField));

    const consumerIds = new Set<string>();
    for (const write of writeNodes) {
      this.graph.edges
        .filter(e => e.from === write.id)
        .forEach(e => consumerIds.add(e.to));
    }

    return Array.from(consumerIds)
      .map(id => this.graph.nodes.get(id)!)
      .filter(Boolean);
  }

  /**
   * Returns a Mermaid diagram representing the data-flow graph.
   */
  toMermaid(): string {
    const lines: string[] = ['graph LR'];
    for (const [id, node] of this.graph.nodes) {
      const label = `${node.kind.toUpperCase()} [${node.provider}] ${node.sliceKey}\\n${node.file.split(/[\\/]/).pop()}:${node.line}`;
      const shape = node.kind === 'write' ? `["${label}"]` : `(["${label}"])`;
      lines.push(`  ${id.replace(/[^a-zA-Z0-9]/g, '_')}${shape}`);
    }
    for (const edge of this.graph.edges) {
      lines.push(`  ${edge.from.replace(/[^a-zA-Z0-9]/g, '_')} -->|"${edge.via}"| ${edge.to.replace(/[^a-zA-Z0-9]/g, '_')}`);
    }
    return lines.join('\n');
  }

  getGraph(): DataFlowGraph {
    return this.graph;
  }
}
