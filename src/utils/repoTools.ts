import { Project, SyntaxKind, Node, SourceFile } from "ts-morph";
import { readFileSync, existsSync } from "fs";
import { resolve, join, relative, dirname } from "path";
import glob from "fast-glob";

/**
 * Tools that allow Binder to "explore" the user's repository.
 */
export class RepoTools {
  private project: Project;

  constructor(rootPath: string = process.cwd()) {
    this.project = new Project({
      compilerOptions: { jsx: 4, allowJs: true, esModuleInterop: true }
    });
  }

  /**
   * Analyze mock data to identify value patterns (Email, UUID, ISO Date, etc.)
   */
  fingerprintValue(value: string): string[] {
    const tags: string[] = [];
    if (value.includes('@') && value.includes('.')) tags.push('TYPE:EMAIL');
    if (value.match(/\d{4}-\d{2}-\d{2}/)) tags.push('TYPE:DATE');
    if (value.match(/[0-9a-f]{8}-[0-9a-f]{4}/i)) tags.push('TYPE:UUID');
    if (value.startsWith('http')) tags.push('TYPE:URL');
    if (value.match(/^\d+$/)) tags.push('TYPE:ID_NUMBER');
    return tags;
  }

  /**
   * Fast Scan: List all files in the project
   */
  async listFiles(): Promise<string[]> {
    return await glob("**/*.{ts,tsx,js,jsx,json}", {
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      absolute: false
    });
  }

  /**
   * Search for a specific string across the repo (Grep style).
   */
  async searchRepo(query: string): Promise<string> {
    const files = await glob("**/*.{ts,tsx,js,jsx}", {
        ignore: ["**/node_modules/**", "**/dist/**"],
        absolute: false
    });

    const results: string[] = [];
    for (const file of files) {
        const content = readFileSync(file, "utf-8");
        if (content.includes(query)) {
            results.push(file);
        }
    }
    return results.length > 0 ? `Found "${query}" in:\n${results.slice(0, 10).join("\n")}` : "No matches found.";
  }

  /**
   * Read the full content of any file.
   */
  readFile(path: string): string {
    const absPath = resolve(process.cwd(), path);
    if (!existsSync(absPath)) return `Error: File ${path} does not exist.`;
    return readFileSync(absPath, "utf-8");
  }

  /**
   * Get all generated hooks from api.ts
   */
  getGeneratedHooks(generatedDir: string): string {
    const apiPath = resolve(generatedDir, "api.ts");
    if (!existsSync(apiPath)) return "Error: api.ts not found.";
    
    const sourceFile = this.project.addSourceFileAtPath(apiPath);
    const hooks = sourceFile.getFunctions()
      .filter(f => f.getName()?.startsWith("use"))
      .map(f => {
        const params = f.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`);
        return `- ${f.getName()}(${params.join(", ")})`;
      });
      
    return hooks.join("\n");
  }

  /**
   * Simple AST Query: Find components that use a specific JSX tag (e.g. "PhoneIcon")
   */
  async astQuery(tagName: string): Promise<string> {
    const files = await glob("src/**/*.{tsx,jsx}", { ignore: ["node_modules/**"] });
    const matchingFiles: string[] = [];

    for (const file of files) {
        const content = readFileSync(file, "utf-8");
        if (content.includes(`<${tagName}`) || content.includes(`${tagName} `)) {
            matchingFiles.push(file);
        }
    }

    return matchingFiles.length > 0 
        ? `Components using ${tagName}:\n${matchingFiles.join("\n")}`
        : `No components found using ${tagName}.`;
  }

  /**
   * Detect project coding style (Contextual Intelligence)
   * Scans for patterns like error handling (toast vs console) and UI libraries.
   */
  async detectStyle(): Promise<string> {
    const files = await glob("src/**/*.{tsx,jsx}", { ignore: ["node_modules/**"], maxFiles: 20 });
    let style = "Coding Style Context:\n";
    
    let hasToast = false;
    let hasSkeleton = false;
    let hasShadcn = false;

    for (const file of files) {
        const content = readFileSync(file, "utf-8");
        if (content.includes("toast")) hasToast = true;
        if (content.includes("Skeleton")) hasSkeleton = true;
        if (content.includes("@/components/ui")) hasShadcn = true;
    }

    if (hasToast) style += "- Project uses Toast for notifications. Prefer toast.error() over console.error().\n";
    if (hasSkeleton) style += "- Project uses Skeleton screens for loading states.\n";
    if (hasShadcn) style += "- Project uses Shadcn UI components.\n";
    
    return style;
  }

  /**
   * Peak into an imported file to find the definition of a mock variable.
   */
  resolveMockData(sourceFilePath: string, mockName: string): string | null {
    const sourceFile = this.project.addSourceFileAtPathIfExists(sourceFilePath);
    if (!sourceFile) return null;

    // 1. Look in the file itself first
    const local = sourceFile.getVariableDeclaration(mockName);
    if (local && local.getInitializer()) return local.getInitializer()!.getText();

    // 2. Follow imports
    const importDec = sourceFile.getImportDeclarations().find(i => {
      return i.getNamedImports().some(n => n.getName() === mockName);
    });

    if (importDec) {
      const moduleSpecifier = importDec.getModuleSpecifierValue();
      const resolvedPath = this.resolveModulePath(sourceFilePath, moduleSpecifier);
      if (resolvedPath) {
        const importedFile = this.project.addSourceFileAtPathIfExists(resolvedPath);
        if (importedFile) {
          const variable = importedFile.getVariableDeclaration(mockName);
          if (variable && variable.getInitializer()) return variable.getInitializer()!.getText();
        }
      }
    }

    return null;
  }

  private resolveModulePath(currentFile: string, moduleSpecifier: string): string | null {
    const baseDir = dirname(currentFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    for (const ext of extensions) {
      const fullPath = resolve(baseDir, moduleSpecifier + ext);
      if (existsSync(fullPath)) return fullPath;
      
      const indexPath = resolve(baseDir, moduleSpecifier, 'index' + ext);
      if (existsSync(indexPath)) return indexPath;
    }
    return null;
  }

  /**
   * Find where a symbol (Type, Interface, Function) is defined.
   */
  findSymbolDefinition(name: string): string {
    const symbols = [
        ...this.project.getInterfaces(),
        ...this.project.getTypeAliases(),
        ...this.project.getFunctions(),
        ...this.project.getClasses()
    ].filter(s => s.getName() === name);

    if (symbols.length === 0) return `Symbol "${name}" not found in project.`;

    return symbols.map(s => {
        const file = relative(process.cwd(), s.getSourceFile().getFilePath());
        return `FILE: ${file}\nDEFINITION:\n${s.getText()}`;
    }).join("\n---\n");
  }
}
