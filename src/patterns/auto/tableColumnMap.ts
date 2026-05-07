// src/patterns/auto/tableColumnMap.ts
import { SyntaxKind } from 'ts-morph';
import { MockFinding, Usage } from '../../engine/types.js';
import { AutoPattern, AutoPatternResult } from './base.js';

export class TableColumnMapPattern extends AutoPattern {
  readonly name = 'table-column-map';

  test(mock: MockFinding, usage: Usage): AutoPatternResult {
    const parent = usage.node.getParent();
    const isColumnMap = parent?.getKind() === SyntaxKind.PropertyAssignment &&
                       parent.getParent()?.getKind() === SyntaxKind.ObjectLiteralExpression &&
                       (parent.getText().toLowerCase().includes('column') || parent.getText().toLowerCase().includes('field'));

    if (!isColumnMap) {
      return { matches: false, confidence: 0, strategy: 'default' };
    }

    return {
      matches: true,
      confidence: 0.8,
      strategy: 'column-data-hook'
    };
  }
}
