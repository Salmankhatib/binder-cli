// src/patterns/auto/propToHook.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class PropToHookPattern extends AutoPattern {
  readonly name = 'prop-to-hook';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    // Detect if mock is used as a default prop value in a component destructuring
    const isDefaultProp = usage.parent?.getKind() === SyntaxKind.BindingElement &&
                         usage.parent.asKind(SyntaxKind.BindingElement)?.getInitializer()?.getText() === mock.name;

    if (!isDefaultProp) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'prop-to-hook'
    };
  }
}
