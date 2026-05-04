// src/patterns/auto/base.ts
import { MockFinding, Usage } from '../../engine/types.js';

export interface AutoPatternResult {
  matches: boolean;
  confidence: number;
  strategy: string;
  transformer?: string;
}

export abstract class AutoPattern {
  abstract readonly name: string;
  abstract test(mock: MockFinding, usage: Usage): AutoPatternResult;
}
