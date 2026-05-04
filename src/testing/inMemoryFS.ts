// src/testing/inMemoryFS.ts
import { Project } from 'ts-morph';

/**
 * A utility to run Binder logic without touching the real disk.
 * Perfect for high-speed unit tests and validation suites.
 */
export class InMemoryFileSystem {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { jsx: 4, allowJs: true }
    });
  }

  addFile(path: string, content: string) {
    return this.project.createSourceFile(path, content, { overwrite: true });
  }

  getFile(path: string) {
    return this.project.getSourceFile(path);
  }

  getProject() {
    return this.project;
  }
}
