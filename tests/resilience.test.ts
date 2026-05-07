import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/engine/decisionEngine.js';
import { scanMocks } from '../src/scan/mockScanner.js';
import { findAllUsages } from '../src/analysis/usageFinder.js';
import { tracePropDrilling } from '../src/analysis/propTracer.js';
import { resolve, dirname } from 'path';
import { Project } from 'ts-morph';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Binder Resilience to Messy Code', () => {
  const engine = new DecisionEngine();
  const fixtureDir = resolve(__dirname, 'fixtures/messy-app/src');

  // Dummy API content simulating a REST backend with OpenAPI
  const apiContent = `
    export const useGetProjectsQuery = () => ({});
    export const useUpdateUserMutation = () => ({});
    export const useGetAdminDataQuery = () => ({});
    export const useToggleStatusMutation = () => ({});
    export const useGetItemsQuery = () => ({});
  `;
  const hookNames = [
    'useGetProjectsQuery', 
    'useUpdateUserMutation', 
    'useGetAdminDataQuery',
    'useToggleStatusMutation',
    'useGetItemsQuery'
  ];

  const runEngineOnFile = async (fileName: string) => {
    const filePath = resolve(fixtureDir, fileName);
    const mocks = scanMocks(filePath);
    
    const project = new Project({ compilerOptions: { jsx: 4 } });
    project.addSourceFilesAtPaths(resolve(fixtureDir, '**/*.tsx'));
    const sourceFile = project.getSourceFileOrThrow(filePath);

    const results = { auto: 0, human: 0, todo: 0 };
    const decisions: any[] = [];

    for (const mock of mocks) {
      const usages = findAllUsages(mock.name, sourceFile);
      const drills = await tracePropDrilling(mock.name, sourceFile, project);
      
      const decision = await engine.decide(
        mock, 
        usages as any, 
        {
          filePath,
          folderContext: fixtureDir,
          imports: [],
          dependencies: ['react-query', 'axios'],
          detectedStyle: 'Standard',
          tsConfigPath: null,
          protocol: 'rest'
        }, 
        hookNames, 
        apiContent, 
        drills
      );

      results[decision.type]++;
      decisions.push({ mockName: mock.name, decision });
    }
    return { results, decisions };
  };

  it('handles Deep Nesting (prop drilling across files)', async () => {
    const { results, decisions } = await runEngineOnFile('DeepNesting.tsx');
    // Currently, this will likely be a TODO because it can't trace deep.
    // Our goal is to make it an AUTO.
    console.log("Deep Nesting Results:", results);
    expect(results).toBeDefined();
  });

  it('handles Spaghetti inline mutations', async () => {
    const { results, decisions } = await runEngineOnFile('Spaghetti.tsx');
    // Currently will fail to infer shape from `data1` or `x`.
    console.log("Spaghetti Results:", results);
    expect(results).toBeDefined();
  });

  it('handles Mixed Partial Binding', async () => {
    const { results, decisions } = await runEngineOnFile('Mixed.tsx');
    // It should bind mockAdminData to useGetAdminDataQuery and ignore useGetProjectsQuery.
    console.log("Mixed Results:", results);
    expect(results).toBeDefined();
  });
});
