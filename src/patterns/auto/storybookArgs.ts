// src/patterns/auto/storybookArgs.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class StorybookArgsPattern extends AutoPattern {
  readonly name = 'storybook-args';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isStorybook = usage.node.getSourceFile().getFilePath().includes('.stories.') ||
                       usage.node.getSourceFile().getFilePath().includes('.story.');
    
    if (!isStorybook) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.95,
      strategy: 'default'
    };
  }
}
