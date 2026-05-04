// tests/split-validation.test.ts
import { describe, it, expect } from 'vitest';
import { DecisionEngine } from '../src/engine/decisionEngine.js';
import { scanMocks } from '../src/scan/mockScanner.js';
import { findAllUsages } from '../src/analysis/usageFinder.js';
import { tracePropDrilling } from '../src/analysis/propTracer.js';
import { resolve, join, dirname } from 'path';
import { readFileSync } from 'fs';
import pc from 'picocolors';

describe('Binder v1.0.0 Target Split Validation', () => {
  const engine = new DecisionEngine();
  const fixtureDir = resolve(__dirname, 'fixtures/real-world-app/src');
  const apiContent = readFileSync(join(fixtureDir, 'api.ts'), 'utf-8');
  const hookNames = [...apiContent.matchAll(/export const (use\w+)/g)].map(m => m[1]);

  it('should hit the 78/17/5 ratio across representative test cases', async () => {
    const files = [
      'Easy.tsx', 
      'RealWorld.tsx', 
      'Messy.tsx', 
      'Batch1.tsx',
      '../../advanced-scenarios/src/GoodProduction.tsx',
      '../../advanced-scenarios/src/AmateurMessy.tsx',
      '../../advanced-scenarios/src/ExtremelyHard.tsx',
      '../../advanced-scenarios/src/CleanProduction2.tsx'
    ];
    const results = { auto: 0, human: 0, todo: 0 };
    const findings: any[] = [];

    for (const fileName of files) {
      const filePath = fileName.startsWith('..') ? resolve(fixtureDir, fileName) : join(fixtureDir, fileName);
      const currentDir = dirname(filePath);
      const currentApiContent = readFileSync(join(currentDir, 'api.ts'), 'utf-8');
      const currentHookNames = [...currentApiContent.matchAll(/export const (use\w+)/g)].map(m => m[1]);

      const mocks = scanMocks(filePath);
      
      // Setup ProjectContext
      const projectContext = {
        filePath,
        folderContext: currentDir,
        imports: [],
        dependencies: ['@tanstack/react-query'],
        detectedStyle: 'Skeleton',
        tsConfigPath: null
      };

      // Create a temporary project for usage finding
      const { Project } = await import('ts-morph');
      const project = new Project({ compilerOptions: { jsx: 4 } });
      const sourceFile = project.addSourceFileAtPath(filePath);

      for (const mock of mocks) {
        const usages = findAllUsages(mock.name, sourceFile);
        const drills = await tracePropDrilling(mock.name, sourceFile, project);
        
        const decision = await engine.decide(
          mock, 
          usages as any, 
          projectContext, 
          currentHookNames, 
          currentApiContent, 
          drills
        );

        // console.log(`[Score] ${fileName} : ${mock.name} -> ${decision.type} (${(decision.confidence * 100).toFixed(1)}%) Reasoning: ${decision.reasoning.map(r => `${r.layer}:${r.score}`).join(', ')}`);

        results[decision.type]++;
        findings.push({ file: fileName, mock: mock.name, type: decision.type, confidence: decision.confidence });
      }
    }

    const total = results.auto + results.human + results.todo;
    const split = {
      auto: (results.auto / total) * 100,
      human: (results.human / total) * 100,
      todo: (results.todo / total) * 100
    };

    console.log(pc.bold('\n📊 BINDER v1.0.0 QA REPORT'));
    console.log(pc.cyan('========================'));
    console.log(`Total Mocks Analyzed: ${total}`);
    console.log(`Auto:  ${results.auto} (${split.auto.toFixed(1)}%)  - Target: ~78%`);
    console.log(`Human: ${results.human} (${split.human.toFixed(1)}%)  - Target: ~17%`);
    console.log(`TODO:  ${results.todo} (${split.todo.toFixed(1)}%)  - Target: ~5%`);
    console.log(pc.cyan('========================\n'));

    // Findings breakdown
    console.table(findings);

    // Assertions with small tolerance
    expect(split.auto).toBeGreaterThan(70);
    expect(split.human).toBeLessThanOrEqual(25);
    expect(split.todo).toBeLessThan(15);
  });
});
