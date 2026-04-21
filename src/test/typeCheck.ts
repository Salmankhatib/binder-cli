import { Project } from 'ts-morph';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { logger } from '../utils/logger.js';
import type { TestResult } from './repairLoop.js';

export function runTypeCheck(filePath: string, code: string): TestResult {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
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
  
  // Stubs
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

  const sourceFile = project.createSourceFile(filePath + '.tmp.tsx', code, { overwrite: true });
  
  // Recursively add generated files to ensure models are found
  const generatedDir = resolve(process.cwd(), 'src/generated');
  if (existsSync(generatedDir)) {
      addFilesRecursively(project, generatedDir);
  }

  const diagnostics = project.getPreEmitDiagnostics();
  const ignoreMessages = ["Cannot find module 'react'", "IntrinsicElements", "jsx-runtime", "tanstack"];

  const errors = diagnostics
    .filter(d => d.getSourceFile()?.getFilePath()?.includes('.tmp.tsx'))
    .map(d => {
      const msg = d.getMessageText();
      return typeof msg === 'string' ? msg : msg.getMessageText();
    })
    .filter(text => !ignoreMessages.some(ignore => text.includes(ignore)));
  
  errors.forEach(text => logger.system(`  [Type Error] ${text}`));
  
  return { layer: 'type-check', passed: errors.length === 0, errors };
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
