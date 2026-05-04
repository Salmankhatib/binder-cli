// src/patterns/todo/base.ts
import { MockFinding, Usage } from '../../engine/types.js';

export interface TodoPatternResult {
  matches: boolean;
  confidence: number;
  reason: string;
}

export abstract class TodoPattern {
  abstract readonly name: string;
  abstract test(mock: MockFinding, usage: Usage): TodoPatternResult;
}
