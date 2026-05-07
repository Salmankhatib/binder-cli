// src/patterns/human/base.ts
import { MockFinding, Usage } from '../../engine/types.js';

export interface HumanPatternResult {
  matches: boolean;
  confidence: number;
  ambiguityType: string;
}

export abstract class HumanPattern {
  abstract readonly name: string;
  abstract test(mock: MockFinding, usage: Usage): HumanPatternResult;
}
