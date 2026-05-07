// tests/torture-test.test.ts
import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/engine/decisionEngine.js';
import { scanMocks } from '../src/scan/mockScanner.js';
import { findAllUsages } from '../src/analysis/usageFinder.js';
import { tracePropDrilling } from '../src/analysis/propTracer.js';
import { resolve, join, dirname } from 'path';
import { readFileSync } from 'fs';
import pc from 'picocolors';

describe('Binder v1.0.0 Torture Test (hardTest.tsx)', () => {
  const engine = new DecisionEngine();
  const fixtureFile = resolve(__dirname, 'fixtures/real-world-app/src/hardTest.tsx');
  const apiFile = resolve(__dirname, 'fixtures/real-world-app/src/hardApi.ts');
  const apiContent = readFileSync(apiFile, 'utf-8');
  const hookNames = [...apiContent.matchAll(/export const (use\w+)/g)].map(m => m[1]);

  it('should hit the target ratios on the torture test', async () => {
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
        patterns: decision.reasoning.find(r => r.layer === 'project-context' && r.details?.patterns)?.details?.patterns || []
      });
    }

    const total = results.auto + results.human + results.todo;
    const split = {
      auto: (results.auto / total) * 100,
      human: (results.human / total) * 100,
      todo: (results.todo / total) * 100
    };

    console.log(pc.bold('\n🔥 TORTURE TEST RESULTS'));
    console.log(pc.cyan('========================'));
    console.log(`Total Mocks: ${total}`);
    console.log(`Auto:  ${results.auto} (${split.auto.toFixed(1)}%)  - Target: ~35-40%`);
    console.log(`Human: ${results.human} (${split.human.toFixed(1)}%)  - Target: ~25-30%`);
    console.log(`TODO:  ${results.todo} (${split.todo.toFixed(1)}%)  - Target: ~35-40%`);
    console.log(pc.cyan('========================\n'));

    console.table(findings);

    // Target checks (with some tolerance)
    expect(split.auto).toBeLessThan(50); 
    expect(split.todo).toBeGreaterThan(25);
  });
});
