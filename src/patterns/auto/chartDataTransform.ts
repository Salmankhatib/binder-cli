// src/patterns/auto/chartDataTransform.ts
import { SyntaxKind, Node } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class ChartDataTransformPattern extends AutoPattern {
  readonly name = 'chart-data-transform';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const isMap = usage.transformations.length === 1 && usage.transformations[0] === 'map';
    
    if (!isMap) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    // Heuristic: check if inside a variable named 'chart' or 'data'
    const parent = usage.node.getParent();
    const snippet = parent?.getParent()?.getText().toLowerCase() || '';
    const isChartRelated = snippet.includes('chart') || snippet.includes('graph') || snippet.includes('plot');

    if (!isChartRelated) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.85,
      strategy: 'wrap-in-usememo'
    };
  }
}
