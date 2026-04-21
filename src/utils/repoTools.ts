import { Project, SyntaxKind, Node } from "ts-morph";
import { readFileSync, existsSync } from "fs";
import { resolve, join, relative } from "path";

/**
 * Tools that allow Binder to "explore" the user's repository.
 */
export class RepoTools {
  private project: Project;

  constructor(rootPath: string = process.cwd()) {
    this.project = new Project();
    // Add only basic project structure initially to save memory
    if (existsSync(join(rootPath, "src"))) {
        this.project.addSourceFilesAtPaths(join(rootPath, "src/**/*.ts"));
        this.project.addSourceFilesAtPaths(join(rootPath, "src/**/*.tsx"));
    }
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

  /**
   * Read the full content of any file in the repo.
   */
  readFile(path: string): string {
    const absPath = resolve(process.cwd(), path);
    if (!existsSync(absPath)) return `Error: File ${path} does not exist.`;
    return readFileSync(absPath, "utf-8");
  }

  /**
   * Search for a specific string across the repo (Grep style).
   */
  grep(pattern: string): string {
    const matches: string[] = [];
    this.project.getSourceFiles().forEach(file => {
        const text = file.getFullText();
        if (text.includes(pattern)) {
            matches.push(relative(process.cwd(), file.getFilePath()));
        }
    });
    return matches.length > 0 ? `Pattern found in: ${matches.join(", ")}` : "No matches found.";
  }
}
