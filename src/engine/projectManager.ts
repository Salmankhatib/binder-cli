// src/engine/projectManager.ts
import { Project, SourceFile } from 'ts-morph';
import { resolve } from 'path';

/**
 * Singleton manager for the ts-morph Project.
 * Prevents redundant parsing of the entire codebase for every file operation.
 */
export class ProjectManager {
    private static instance: ProjectManager;
    private project: Project;
    private tsConfigPath: string | undefined;

    private constructor(tsConfigPath?: string) {
        this.tsConfigPath = tsConfigPath;
        this.project = new Project({
            tsConfigFilePath: tsConfigPath,
            skipAddingFilesFromTsConfig: !tsConfigPath,
            compilerOptions: { 
                jsx: 4, // React.JSX
                allowJs: true, 
                esModuleInterop: true,
                skipLibCheck: true // Performance boost
            }
        });
    }

    /**
     * Get the singleton instance. If it doesn't exist, it's created with the provided tsConfigPath.
     */
    public static getInstance(tsConfigPath?: string): ProjectManager {
        if (!ProjectManager.instance) {
            ProjectManager.instance = new ProjectManager(tsConfigPath);
        }
        return ProjectManager.instance;
    }

    /**
     * Returns the underlying ts-morph Project.
     */
    public getProject(): Project {
        return this.project;
    }

    /**
     * Retrieves or adds a source file from the project.
     * Automatically refreshes from disk to ensure AST accuracy.
     */
    public getSourceFile(filePath: string): SourceFile {
        const absPath = resolve(filePath);
        let sourceFile = this.project.getSourceFile(absPath);
        
        if (!sourceFile) {
            sourceFile = this.project.addSourceFileAtPath(absPath);
        } else {
            sourceFile.refreshFromFileSystemSync();
        }
        
        return sourceFile;
    }

    /**
     * Synchronize a file's content in memory without writing to disk immediately.
     */
    public updateFileInMemory(filePath: string, content: string): SourceFile {
        const absPath = resolve(filePath);
        const existing = this.project.getSourceFile(absPath);
        if (existing) {
            this.project.removeSourceFile(existing);
        }
        return this.project.createSourceFile(absPath, content, { overwrite: true });
    }
}
