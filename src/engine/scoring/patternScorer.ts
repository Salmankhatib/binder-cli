// src/engine/scoring/patternScorer.ts
import { MockFinding, Usage } from '../types.js';

export interface PatternScoreResult {
  score: number;
  patternName: string | null;
  isAuto: boolean;
  isHuman: boolean;
  strategy: string;
  transformer?: string;
  humanPattern?: string;
  explanation: string;
}

export class PatternScorer {
  score(mock: MockFinding, usages: Usage[], registry: any): PatternScoreResult {
    // Check all patterns against all usages
    const matches = registry.findMatches(mock, usages);
    
    if (matches.length === 0) {
      return {
        score: 0,
        patternName: null,
        isAuto: false,
        isHuman: false,
        strategy: 'default',
        explanation: 'No matching pattern found. Usage is too complex or novel.'
      };
    }

    // Find best match
    const bestMatch = matches.sort((a: any, b: any) => b.confidence - a.confidence)[0];
    
    if (bestMatch.category === 'auto') {
      // Check if ALL usages match auto patterns
      const allUsagesSafe = usages.every(u => 
        matches.some((m: any) => m.usage === u && m.category === 'auto')
      );
      
      if (allUsagesSafe) {
        return {
          score: 35 + (bestMatch.confidence * 5), // 35-40 range
          patternName: bestMatch.patternName,
          isAuto: true,
          isHuman: false,
          strategy: bestMatch.strategy,
          transformer: bestMatch.transformer,
          explanation: `All ${usages.length} usages match safe auto-pattern "${bestMatch.patternName}" with confidence ${(bestMatch.confidence * 100).toFixed(0)}%`
        };
      }
    }

    if (bestMatch.category === 'human') {
      return {
        score: 20 + (bestMatch.confidence * 15), // 20-35 range
        patternName: bestMatch.patternName,
        isAuto: false,
        isHuman: true,
        strategy: 'human-decision',
        humanPattern: bestMatch.patternName,
        explanation: `Pattern "${bestMatch.patternName}" requires human decision. Confidence ${(bestMatch.confidence * 100).toFixed(0)}%`
      };
    }

    // TODO pattern
    return {
      score: bestMatch.confidence * 20, // 0-20 range
      patternName: bestMatch.patternName,
      isAuto: false,
      isHuman: false,
      strategy: 'todo',
      explanation: `Pattern "${bestMatch.patternName}" is not safely automatable.`
    };
  }
}
