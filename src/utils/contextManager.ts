import { Project, SyntaxKind, Node } from "ts-morph";
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join, relative } from "path";
import { logger } from "./logger.js";

export interface RepoMap {
  hooks: string[];
  models: string[];
  files: string[];
}

export function generateContext(generatedDir: string, currentFile: string): string {
  const project = new Project();
  const map: RepoMap = { hooks: [], models: [], files: [] };
  
  const absGenerated = resolve(process.cwd(), generatedDir || 'src/generated');
  const binderDir = resolve(process.cwd(), ".binder");
  if (!existsSync(binderDir)) mkdirSync(binderDir, { recursive: true });

  if (existsSync(absGenerated)) {
    const items = readdirSync(absGenerated, { recursive: true, withFileTypes: true });
    for (const item of items) {
      if (item.isFile() && item.name.endsWith(".ts")) {
        const fullPath = resolve(item.path || absGenerated, item.name);
        try {
          const sourceFile = project.addSourceFileAtPath(fullPath);
          
          if (item.name === "api.ts") {
            const hooks = [
              ...sourceFile.getFunctions().filter(f => f.isExported()).map(f => f.getName()!),
              ...sourceFile.getVariableDeclarations().filter(v => v.isExported() && v.getName().startsWith("use")).map(v => v.getName())
            ];
            map.hooks.push(...hooks);
          } else {
            const types = [...sourceFile.getInterfaces(), ...sourceFile.getTypeAliases()];
            map.models.push(...types.map(t => t.getName()!));
          }
          map.files.push(relative(process.cwd(), fullPath));
        } catch (e) {}
      }
    }
  }

  const context = `
### REPOSITORY MAP (Binder Context)
- Available Hooks: ${[...new Set(map.hooks)].join(", ")}
- Available Models: ${[...new Set(map.models)].join(", ")}
- Infrastructure Files: ${map.files.join(", ")}

### SYSTEM CONVENTIONS
1. Orval responses are wrapped: real data is in .data
2. React Query v5: Use .isPending for mutations, not .isLoading
3. Transformations must be arrow functions: (data) => data.data
4. Relative imports should target: ${relative(dirname(currentFile), absGenerated).replace(/\\/g, '/')}/api

### TARGET FILE
${currentFile}
`;

  writeFileSync(resolve(binderDir, "context.txt"), context);
  return context;
}

export function updateContext(note: string) {
    const path = resolve(process.cwd(), ".binder/context.txt");
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
    writeFileSync(path, existing + `\n\n### AGENT NOTES\n${note}`);
}

function dirname(path: string): string {
    return path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')));
}
