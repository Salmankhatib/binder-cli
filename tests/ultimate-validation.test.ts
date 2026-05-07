// tests/ultimate-validation.test.ts
import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/engine/decisionEngine.js';
import { scanMocks } from '../src/scan/mockScanner.js';
import { findAllUsages } from '../src/analysis/usageFinder.js';
import { tracePropDrilling } from '../src/analysis/propTracer.js';
import { resolve, join, dirname } from 'path';
import { readFileSync } from 'fs';
import pc from 'picocolors';

describe('Binder Ultimate Test Validation', () => {
  const engine = new DecisionEngine();
  const fixtureFile = resolve(__dirname, 'fixtures/real-world-app/src/ultimateTest.tsx');
  const apiFile = resolve(__dirname, 'fixtures/real-world-app/src/ultimateApi.ts');
  const apiContent = readFileSync(apiFile, 'utf-8');
  const hookNames = [...apiContent.matchAll(/export const (use\w+)/g)].map(m => m[1]);

  it('should process ultimateTest.tsx and provide a detailed breakdown', async () => {
    const results = { auto: 0, human: 0, todo: 0 };
    const findings: any[] = [];

    const mocks = scanMocks(fixtureFile);
    const { Project } = await import('ts-morph');
    const project = new Project({ compilerOptions: { jsx: 4 } });
    const sourceFile = project.addSourceFileAtPath(fixtureFile);

    for (const mock of mocks) {
      const usages = findAllUsages(mock.name, sourceFile);
      const drills = await tracePropDrilling(mock.name, sourceFile, project);
      
      const decision = await engine.decide(
        mock, 
        usages as any, 
        {
          filePath: fixtureFile,
          folderContext: dirname(fixtureFile),
          imports: [],
          dependencies: ['@tanstack/react-query'],
          detectedStyle: 'Skeleton',
          tsConfigPath: null
        }, 
        hookNames, 
        apiContent, 
        drills
      );

      results[decision.type]++;
      findings.push({ 
        mock: mock.name, 
        type: decision.type, 
        confidence: (decision.confidence * 100).toFixed(1) + '%',
        pattern: decision.reasoning.find(r => r.layer === 'pattern')?.details?.matchedPattern || 'none'
      });
    }

    console.log(pc.bold('\n🏆 ULTIMATE TEST BREAKDOWN'));
    console.log(pc.cyan('========================'));
    console.table(findings);
    
    const total = results.auto + results.human + results.todo;
    console.log(`Summary: Auto: ${results.auto}, Human: ${results.human}, TODO: ${results.todo} (Total: ${total})`);
    console.log(pc.cyan('========================\n'));
  });
});
