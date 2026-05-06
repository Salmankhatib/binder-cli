// tests/trpc-validation.test.ts
import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/engine/decisionEngine.js';
import { scanMocks } from '../src/scan/mockScanner.js';
import { findAllUsages } from '../src/analysis/usageFinder.js';
import { tracePropDrilling } from '../src/analysis/propTracer.js';
import { TrpcRouterAnalyzer } from '../src/analysis/trpcAnalyzer.js';
import { resolve, dirname } from 'path';
import pc from 'picocolors';

describe('Binder tRPC Validation', () => {
  const engine = new DecisionEngine();
  const fixtureDir = resolve(__dirname, 'fixtures/trpc-app/src');
  const routerFile = resolve(fixtureDir, 'router.ts');

  it('should auto-bind tRPC procedures with input inference', async () => {
    const analyzer = new TrpcRouterAnalyzer();
    const procedures = await analyzer.analyze(routerFile);
    const hookNames = Array.from(procedures.keys());
    
    // Generate mock apiContent for semantic matcher
    const apiContent = Array.from(procedures.entries()).map(([path, info]) => {
        return `export const ${path.replace(/\./g, '_')} = () => ({} as ${info.outputType});`;
    }).join("\n");

    const filePath = resolve(fixtureDir, 'UserDashboard.tsx');
    const mocks = scanMocks(filePath);
    
    const { Project } = await import('ts-morph');
    const project = new Project({ compilerOptions: { jsx: 4 } });
    const sourceFile = project.addSourceFileAtPath(filePath);

    const results = { auto: 0, human: 0, todo: 0 };

    for (const mock of mocks) {
      console.log(`[DEBUG] Scanning mock: ${mock.name}, type: ${mock.type}, hasShape: ${!!mock.inferredShape}`);
      const usages = findAllUsages(mock.name, sourceFile);
      const drills = await tracePropDrilling(mock.name, sourceFile, project);
      
      const decision = await engine.decide(
        mock, 
        usages as any, 
        {
          filePath,
          folderContext: fixtureDir,
          imports: [],
          dependencies: ['@trpc/client', '@trpc/react-query'],
          detectedStyle: 'Skeleton',
          tsConfigPath: null,
          protocol: 'trpc'
        }, 
        hookNames, 
        apiContent, 
        drills,
        procedures
      );

      results[decision.type]++;
      if (mock.name === 'MOCK_USERS') {
          console.log(`[DEBUG] MOCK_USERS Reasoning:`, JSON.stringify(decision.reasoning, null, 2));
      }
      console.log(`[tRPC Match] ${mock.name} -> ${decision.type} (${(decision.confidence * 100).toFixed(1)}%) via ${decision.binding?.hookName}`);
      
      if (mock.name === 'MOCK_USER') {
          expect(decision.binding?.inferredInput).toBe('userId');
      }
    }

    expect(results.auto).toBeGreaterThanOrEqual(1);
  });
});