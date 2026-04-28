import { Project } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { logger } from '../utils/logger.js';
import type { Diagnostic } from '../mcp/oracle.js';

export interface TestResult {
  layer: string;
  passed: boolean;
  errors: string[];
  diagnostics: Diagnostic[];
}

export function runTypeCheck(filePath: string, code: string, generatedDir?: string): TestResult {
  const tsConfigPath = findNearestTsConfig(dirname(filePath));
  
  const project = new Project({
    tsConfigFilePath: tsConfigPath || undefined,
    skipAddingFilesFromTsConfig: !tsConfigPath,
    compilerOptions: {
      noEmit: true,
      jsx: 4,
      moduleResolution: 2,
      esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
      strict: false,
    },
  });

  if (!tsConfigPath) {
    // Fallback stubs only if no tsconfig found
    project.createSourceFile('node_modules/@types/react/index.d.ts', `
      declare namespace React {
        function useState<T>(initial: T): [T, (val: T) => void];
        function useEffect(cb: () => void, deps?: any[]): void;
        function useMemo<T>(cb: () => T, deps?: any[]): T;
        function useCallback<T extends (...args: any[]) => any>(cb: T, deps?: any[]): T;
        function createElement(type: any, props?: any, ...children: any[]): any;
      }
      declare namespace JSX {
        interface IntrinsicElements { [elemName: string]: any; }
        interface Element { [propName: string]: any; }
      }
      export = React; export as namespace React;
      export const useState: typeof React.useState;
      export const useEffect: typeof React.useEffect;
      export const useMemo: typeof React.useMemo;
      export const useCallback: typeof React.useCallback;
    `, { overwrite: true });
  }

  const sourceFile = project.createSourceFile(filePath + '.tmp.tsx', code, { overwrite: true });
  
  // Recursively add generated files to ensure models are found
  const targetGeneratedDir = generatedDir ? resolve(generatedDir) : resolve(process.cwd(), 'src/generated');
  if (existsSync(targetGeneratedDir)) {
      addFilesRecursively(project, targetGeneratedDir);
  }

  const diagObjects = project.getPreEmitDiagnostics();
  const ignoreMessages = ["Cannot find module 'react'", "IntrinsicElements", "jsx-runtime", "tanstack"];

  const filteredDiags = diagObjects.filter(d => {
    const text = typeof d.getMessageText() === 'string' ? d.getMessageText() : (d.getMessageText() as any).getMessageText();
    return d.getSourceFile()?.getFilePath()?.includes('.tmp.tsx') && !ignoreMessages.some(ignore => (text as string).includes(ignore));
  });

  const diagnostics: Diagnostic[] = filteredDiags.map(d => ({
    message: typeof d.getMessageText() === 'string' ? (d.getMessageText() as string) : (d.getMessageText() as any).getMessageText(),
    code: d.getCode(),
    line: d.getLineNumber() || 0,
    character: d.getStart() || 0,
    file: d.getSourceFile()?.getFilePath() || ''
  }));

  const errors = diagnostics.map(d => d.message);
  
  errors.forEach(text => logger.system(`  [Type Error] ${text}`));
  
  return { layer: 'type-check', passed: errors.length === 0, errors, diagnostics };
}

function addFilesRecursively(project: Project, dir: string) {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) {
            addFilesRecursively(project, fullPath);
        } else if (item.isFile() && item.name.endsWith('.ts')) {
            project.createSourceFile(fullPath, readFileSync(fullPath, 'utf-8'), { overwrite: true });
        }
    }
}

function findNearestTsConfig(startDir: string): string | null {
  let current = resolve(startDir);
  while (current !== dirname(current)) {
    const p = join(current, 'tsconfig.json');
    if (existsSync(p)) return p;
    current = dirname(current);
  }
  return null;
}
