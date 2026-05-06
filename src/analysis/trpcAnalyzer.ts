import { Project, SyntaxKind, Type, Node, TypeAliasDeclaration, InterfaceDeclaration } from 'ts-morph';
import { logger } from '../utils/logger.js';

export interface ProcedureInfo {
  path: string;           // "user.list"
  type: "query" | "mutation" | "subscription";
  inputSchema: string | null;
  outputType: string;     // resolved TypeScript type string
  router: string;         // "user"
  procedure: string;      // "list"
}

/**
 * Foundation for tRPC compatibility.
 * Introspects the AppRouter type to build a catalog of available procedures.
 */
export class TrpcRouterAnalyzer {
  private project: Project;
  private procedures: Map<string, ProcedureInfo> = new Map();

  constructor(tsConfigPath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: !tsConfigPath,
      compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
    });
  }

  async analyze(routerPath: string): Promise<Map<string, ProcedureInfo>> {
    logger.startSpinner(`Introspecting tRPC Router: ${routerPath}`);
    
    const sourceFile = this.project.addSourceFileAtPath(routerPath);
    const appRouterType = sourceFile.getTypeAlias('AppRouter') || sourceFile.getInterface('AppRouter');

    if (!appRouterType) {
      logger.stopSpinner(false, "Could not find AppRouter type definition.");
      return this.procedures;
    }

    const type = appRouterType.getType();
    this.crawlRouter(type, "");

    logger.stopSpinner(true, `Discovered ${this.procedures.size} tRPC procedures.`);
    return this.procedures;
  }

  private crawlRouter(type: Type, path: string) {
    const props = type.getProperties();

    for (const prop of props) {
      const propName = prop.getName();
      const currentPath = path ? `${path}.${propName}` : propName;
      const propType = prop.getTypeAtLocation(prop.getDeclarations()[0]);

      // Determine if this is a procedure or a sub-router
      // tRPC procedures usually have _def property or specific structure
      // We look for 'useQuery', 'useMutation' which are common in the client type
      const subProps = propType.getProperties();
      const isProcedure = subProps.some(p => ['useQuery', 'useMutation', 'useSubscription'].includes(p.getName()));

      if (isProcedure) {
        const typeStr = subProps.some(p => p.getName() === 'useMutation') ? "mutation" : 
                        subProps.some(p => p.getName() === 'useSubscription') ? "subscription" : "query";
        
        this.procedures.set(currentPath, {
          path: currentPath,
          type: typeStr as any,
          inputSchema: this.extractInput(propType),
          outputType: this.extractOutput(propType),
          router: path || "root",
          procedure: propName
        });
      } else {
        // Recursive crawl for sub-routers
        this.crawlRouter(propType, currentPath);
      }
    }
  }

  private extractInput(type: Type): string | null {
    // Logic to extract input type string (e.g. from useQuery arguments)
    const useQuery = type.getProperty('useQuery');
    if (useQuery) {
        const queryType = useQuery.getTypeAtLocation(useQuery.getDeclarations()[0]);
        const sigs = queryType.getCallSignatures();
        if (sigs.length > 0 && sigs[0].getParameters().length > 0) {
            return sigs[0].getParameters()[0].getTypeAtLocation(useQuery.getDeclarations()[0]).getText();
        }
    }
    return null;
  }

  private extractOutput(type: Type): string {
    // Logic to extract output type string
    const useQuery = type.getProperty('useQuery');
    if (useQuery) {
        const queryType = useQuery.getTypeAtLocation(useQuery.getDeclarations()[0]);
        const sigs = queryType.getCallSignatures();
        if (sigs.length > 0) {
            const returnType = sigs[0].getReturnType();
            
            // 1. Try to unwrap UseQueryResult generic
            const typeArgs = returnType.getTypeArguments();
            if (typeArgs.length > 0) return typeArgs[0].getText();

            // 2. Try to get 'data' property directly (if mocked/defined simply)
            const dataProp = returnType.getApparentProperties().find(p => p.getName() === 'data');
            if (dataProp) {
                const decl = dataProp.getDeclarations()[0];
                if (decl) return decl.getType().getText();
            }

            return returnType.getText();
        }
    }
    return "any";
  }

  getProcedures() {
    return Array.from(this.procedures.values());
  }
}
