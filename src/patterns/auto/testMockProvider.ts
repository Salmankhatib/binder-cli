// src/patterns/auto/testMockProvider.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class TestMockProviderPattern extends AutoPattern {
  readonly name = 'test-mock-provider';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isTestFile = usage.node.getSourceFile().getFilePath().match(/\.(test|spec)\./i);
    
    if (!isTestFile) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.95,
      strategy: 'test-wrapper'
    };
  }
}
