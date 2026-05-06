import { Project, SyntaxKind, Node, Type, FunctionDeclaration, VariableDeclaration } from 'ts-morph';
import { logger } from '../utils/logger.js';

export interface WrappedHookInfo {
  name: string;           // "useCustomUsers"
  filePath: string;
  wrappedHook: string;    // "useGetUsers" or "user.list"
  returnType: string;
}

/**
 * Phase 5.1: Custom Hook Wrapper Discovery
 * Indexes user-defined hooks that wrap base API or tRPC hooks.
 */
export class HookIndexer {
  private hookMap: Map<string, WrappedHookInfo> = new Map();

  async indexProject(project: Project): Promise<Map<string, WrappedHookInfo>> {
    logger.startSpinner("Indexing custom hook wrappers...");
    
    const sourceFiles = project.getSourceFiles();
    for (const file of sourceFiles) {
      if (file.getFilePath().includes('node_modules') || file.getFilePath().includes('generated')) continue;

      const functions = file.getFunctions().filter(f => f.getName()?.startsWith('use'));
      const variables = file.getVariableDeclarations().filter(v => v.getName().startsWith('use'));

      for (const fn of functions) this.analyzeHook(fn, file.getFilePath());
      for (const v of variables) this.analyzeHook(v, file.getFilePath());
    }

    logger.stopSpinner(true, `Indexed ${this.hookMap.size} custom hook wrappers.`);
    return this.hookMap;
  }

  private analyzeHook(node: FunctionDeclaration | VariableDeclaration, filePath: string) {
    const name = node.getName();
    if (!name) return;

    let bodyText = "";
    if (Node.isFunctionDeclaration(node)) {
        bodyText = node.getBody()?.getText() || "";
    } else {
        const init = node.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
            bodyText = init.getBody().getText();
        }
    }

    // Look for calls to base hooks (REST or tRPC)
    // tRPC: trpc.user.list.useQuery()
    // REST: useGetUsers()
    const trpcMatch = bodyText.match(/trpc\.([\w\.]+)\.use(Query|Mutation|Subscription)/);
    const restMatch = bodyText.match(/use(Get|Update|Delete|Post|Put)\w+/);

    if (trpcMatch) {
        this.hookMap.set(name, {
            name,
            filePath,
            wrappedHook: trpcMatch[1],
            returnType: node.getType().getText()
        });
    } else if (restMatch) {
        this.hookMap.set(name, {
            name,
            filePath,
            wrappedHook: restMatch[0],
            returnType: node.getType().getText()
        });
    }
  }

  getWrapperFor(hookName: string): WrappedHookInfo | undefined {
    return Array.from(this.hookMap.values()).find(w => w.wrappedHook === hookName);
  }
}
