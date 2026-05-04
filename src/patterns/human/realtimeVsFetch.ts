// src/patterns/human/realtimeVsFetch.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { HumanPattern, HumanPatternResult } from './base.js';

export class RealtimeVsFetchPattern extends HumanPattern {
  readonly name = 'realtime-vs-fetch';

  test(mock: MockFinding, usage: Usage): HumanPatternResult {
    let current: Node | undefined = usage.node.getParent();
    let isRealtime = false;
    
    while (current) {
      const text = current.getText();
      if (text.includes('setInterval') || text.includes('setTimeout') || text.includes('socket') || text.includes('subscribe')) {
        isRealtime = true;
        break;
      }
      current = current.getParent();
    }

    if (!isRealtime) {
      return { matches: false, confidence: 0, ambiguityType: '' };
    }

    return {
      matches: true,
      confidence: 0.7,
      ambiguityType: 'realtime-strategy'
    };
  }
}
