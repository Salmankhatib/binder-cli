import { Project, SyntaxKind, SourceFile, CallExpression, Identifier, Node, TypeChecker, ParameterDeclaration } from 'ts-morph';
import { logger } from '../utils/logger.js';
import { getAnalysisCache, setAnalysisCache } from '../utils/cache.js';
import { StateProvider, DataFlowNode, DataFlowGraph } from '../common/types.js';

/**
 * GlobalStateTracer builds a semantic data-flow graph for a project.
 */
export class GlobalStateTracer {
  private project: Project;
  private typeChecker: TypeChecker;
  private graph: DataFlowGraph = { nodes: new Map(), edges: [] };

  constructor(project: Project) {
    this.project = project;
    this.typeChecker = project.getTypeChecker();
  }

  async buildGraph(sourceFiles: SourceFile[]): Promise<DataFlowGraph> {
    for (const sf of sourceFiles) {
      const filePath = sf.getFilePath();
      
      // INCREMENTAL CACHE CHECK
      const cached = getAnalysisCache(filePath);
      if (cached && cached.stateNodes) {
          cached.stateNodes.forEach((node: DataFlowNode) => {
              this.graph.nodes.set(node.id, node);
          });
          continue;
      }

      // We need to capture nodes added for this specific file
      const beforeNodes = Array.from(this.graph.nodes.values());
      this.extractWrites(sf);
      this.extractReads(sf);
      const afterNodes = Array.from(this.graph.nodes.values());
      
      const fileNodes = afterNodes.filter(n => !beforeNodes.includes(n));
      setAnalysisCache(filePath, { stateNodes: fileNodes });
    }
    this.connectEdges();
    return this.graph;
  }

  // ── SEMANTIC WRITES ──────────────────────────────────────────────────────────

  private extractWrites(sf: SourceFile) {
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const callee = call.getExpression();
      const calleeText = callee.getText();

      // Redux: dispatch(setUser(data))
      if (calleeText === 'dispatch' || calleeText.endsWith('.dispatch')) {
        this.handleReduxDispatch(call, sf);
        return;
      }

      // Zustand: useStore.setState(...) or store.setState(...)
      if (calleeText.includes('setState') || calleeText === 'set') {
        this.handleZustandSet(call, sf);
        return;
      }
    });
  }

  private handleReduxDispatch(dispatch: CallExpression, sf: SourceFile) {
    const args = dispatch.getArguments();
    if (args.length === 0) return;

    const actionArg = args[0];

    // Case 1: dispatch(actionCreator(payload))
    if (Node.isCallExpression(actionArg)) {
      const actionName = actionArg.getExpression().getText();
      const sliceKey = this.sliceKeyFromAction(actionName);
      const node = this.makeNode('write', 'redux', sliceKey, actionName, sf, dispatch.getStartLineNumber());
      this.graph.nodes.set(node.id, node);
    }

    // Case 2: dispatch({ type: 'slice/action' })
    if (Node.isObjectLiteralExpression(actionArg)) {
      const typeProp = actionArg.getProperty('type');
      if (Node.isPropertyAssignment(typeProp)) {
        const typeStr = typeProp.getInitializer()?.getText().replace(/['"]/g, '') ?? 'unknown';
        const sliceKey = this.sliceKeyFromAction(typeStr);
        const node = this.makeNode('write', 'redux', sliceKey, typeStr, sf, dispatch.getStartLineNumber());
        this.graph.nodes.set(node.id, node);
      }
    }
  }

  private handleZustandSet(call: CallExpression, sf: SourceFile) {
    const args = call.getArguments();
    if (args.length === 0) return;

    const arg = args[0];
    
    // Case 1: setState({ user: data })
    if (Node.isObjectLiteralExpression(arg)) {
      arg.getProperties().forEach(prop => {
        if (Node.isPropertyAssignment(prop)) {
          const key = prop.getName();
          const node = this.makeNode('write', 'zustand', key, key, sf, call.getStartLineNumber());
          this.graph.nodes.set(node.id, node);
        } else if (Node.isShorthandPropertyAssignment(prop)) {
          const key = prop.getName();
          const node = this.makeNode('write', 'zustand', key, key, sf, call.getStartLineNumber());
          this.graph.nodes.set(node.id, node);
        }
      });
    }

    // Case 2: setState(state => ({ user: data }))
    if (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg)) {
        const body = arg.getBody();
        // Look for object literals in return
        const objects = body.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
        objects.forEach(obj => {
            obj.getProperties().forEach(prop => {
                if (Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)) {
                    const key = prop.getName();
                    const node = this.makeNode('write', 'zustand', key, key, sf, call.getStartLineNumber());
                    this.graph.nodes.set(node.id, node);
                }
            });
        });
    }
  }

  // ── SEMANTIC READS ───────────────────────────────────────────────────────────

  private extractReads(sf: SourceFile) {
    sf.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const calleeText = call.getExpression().getText();

      // Redux: useSelector(state => state.user.data)
      if (calleeText === 'useSelector') {
        this.handleUseSelector(call, sf);
        return;
      }

      // Zustand: useStore(state => state.user)
      if (calleeText === 'useStore' || calleeText.includes('useStore')) {
        this.handleUseSelector(call, sf, 'zustand');
        return;
      }

      // Context: useContext(UserContext)
      if (calleeText === 'useContext') {
        this.handleUseContext(call, sf);
        return;
      }
    });
  }

  private handleUseSelector(call: CallExpression, sf: SourceFile, provider: StateProvider = 'redux') {
    const args = call.getArguments();
    
    // Case 1: const { user } = useStore() (No args, destructuring result)
    if (args.length === 0) {
        const parent = call.getParent();
        if (Node.isVariableDeclaration(parent)) {
            const nameNode = parent.getNameNode();
            if (Node.isObjectBindingPattern(nameNode)) {
                nameNode.getElements().forEach(el => {
                    const key = el.getName();
                    const node = this.makeNode('read', provider, key, key, sf, call.getStartLineNumber());
                    this.graph.nodes.set(node.id, node);
                });
            }
        }
        return;
    }

    const selectorFn = args[0];
    if (Node.isArrowFunction(selectorFn) || Node.isFunctionExpression(selectorFn)) {
      const stateParam = selectorFn.getParameters()[0];
      if (stateParam) {
        const accessedKeys = this.traceStateAccess(stateParam, selectorFn.getBody());
        accessedKeys.forEach(key => {
          const node = this.makeNode('read', provider, key, key, sf, call.getStartLineNumber());
          this.graph.nodes.set(node.id, node);
        });
      }
    }
  }

  /**
   * Semantically traces which properties are accessed from the 'state' parameter
   * in a selector function.
   */
  private traceStateAccess(param: ParameterDeclaration, body: Node): string[] {
    const keys = new Set<string>();
    const paramId = param.getNameNode();
    
    if (Node.isIdentifier(paramId)) {
        // Find all usages of the state parameter inside the selector body
        paramId.findReferencesAsNodes().forEach(ref => {
            if (ref.getSourceFile() !== paramId.getSourceFile()) return;
            
            const parent = ref.getParent();
            // Trace state.user
            if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
                keys.add(parent.getName());
            }
            // Trace ({ user }) => user
            if (Node.isVariableDeclaration(parent)) {
                // Handle cases where state is assigned to a local variable
            }
        });
    }

    // Handle destructured parameter: ({ user }) => ...
    if (Node.isObjectBindingPattern(paramId)) {
        paramId.getElements().forEach(el => {
            keys.add(el.getName());
        });
    }

    return Array.from(keys);
  }

  private handleUseContext(call: CallExpression, sf: SourceFile) {
    const args = call.getArguments();
    if (args.length === 0) return;
    const contextName = args[0].getText();
    const node = this.makeNode('read', 'context', contextName, contextName, sf, call.getStartLineNumber());
    this.graph.nodes.set(node.id, node);
  }

  // ── EDGE CONSTRUCTION ────────────────────────────────────────────────────────

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

  private sliceKeyFromAction(action: string): string {
    if (action.includes('/')) return action.split('/')[0];
    return action.replace(/^(set|update|clear|reset|fetch|load)/, '').charAt(0).toLowerCase() +
           action.replace(/^(set|update|clear|reset|fetch|load)/, '').slice(1);
  }

  private keysOverlap(a: string, b: string): boolean {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    return al === bl || al.startsWith(bl) || bl.startsWith(al);
  }

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

  getGraph(): DataFlowGraph {
    return this.graph;
  }

  /**
   * toMermaid generates a Mermaid diagram string for the current graph.
   */
  toMermaid(): string {
    let mermaid = 'graph LR\n';
    
    // Nodes
    this.graph.nodes.forEach(node => {
      const shape = node.kind === 'write' ? '[(' : '{';
      const endShape = node.kind === 'write' ? ')]' : '}';
      const color = node.kind === 'write' ? 'fill:#38bdf8,stroke:#0ea5e9' : 'fill:#10b981,stroke:#059669';
      mermaid += `  ${this.sanitizeId(node.id)}${shape}"${node.provider}:${node.sliceKey}"${endShape}\n`;
      mermaid += `  style ${this.sanitizeId(node.id)} ${color},color:#fff\n`;
    });

    // Edges
    this.graph.edges.forEach(edge => {
      mermaid += `  ${this.sanitizeId(edge.from)} -->|"${edge.via}"| ${this.sanitizeId(edge.to)}\n`;
    });

    return mermaid;
  }

  private sanitizeId(id: string): string {
    return id.replace(/[:\\/. -]/g, '_');
  }
}
