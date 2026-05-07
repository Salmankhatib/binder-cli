import { MockFinding, Usage } from '../types.js';
import { SyntaxKind } from 'ts-morph';

export interface PatternScoreResult {
  score: number;
  patternName: string | null;
  category: 'auto' | 'human' | 'todo';
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
      // FALLBACK: Safety Heuristic for un-patterned simple usages
      const heuristic = this.getSafetyHeuristic(mock, usages);
      if (heuristic.score > 0) {
          return {
              ...heuristic,
              category: heuristic.score >= 25 ? 'auto' : 'human',
              isAuto: heuristic.score >= 25,
              isHuman: heuristic.score < 25 && heuristic.score >= 15,
              strategy: 'default',
              explanation: `Heuristic match: ${heuristic.explanation}`
          };
      }

      return {
        score: 0,
        patternName: null,
        category: 'todo',
        isAuto: false,
        isHuman: false,
        strategy: 'default',
        explanation: 'No matching pattern found. Usage is too complex or novel.'
      };
    }

    // Find best match
    const sortedMatches = matches.sort((a: any, b: any) => {
        // Preference 1: Confidence
        if (Math.abs(b.confidence - a.confidence) > 0.05) return b.confidence - a.confidence;
        // Preference 2: Category (Todo > Human > Auto for safety)
        const catMap = { todo: 3, human: 2, auto: 1 };
        return catMap[b.category] - catMap[a.category];
    });
    
    // Check if any usage matches a TODO pattern (Safety First)
    const todoMatch = matches.find((m: any) => m.category === 'todo');
    if (todoMatch) {
        return {
            score: 0,
            patternName: todoMatch.patternName,
            category: 'todo',
            isAuto: false,
            isHuman: false,
            strategy: 'todo',
            explanation: `Critical safety pattern "${todoMatch.patternName}" detected.`
        };
    }

    const bestMatch = sortedMatches[0];
    const bestAutoMatch = sortedMatches.find((m: any) => m.category === 'auto');

    // If we have a strong auto match (>= 0.8), use it
    const targetMatch = (bestAutoMatch && bestAutoMatch.confidence >= 0.8) ? bestAutoMatch : bestMatch;
    
    if (targetMatch.category === 'auto') {
      // Check if majority of usages match auto patterns
      const autoMatchesCount = usages.filter(u => 
        matches.some((m: any) => m.usage === u && m.category === 'auto')
      ).length;
      
      const ratio = autoMatchesCount / usages.length;
      
      // PRODUCTION DISCIPLINE: was 0.5, now 0.8
      // For Auto, we want near-perfect pattern matching across all usage sites.
      if (ratio >= 0.8 || (usages.length === 1 && autoMatchesCount === 1)) {
        return {
          score: 30 + (targetMatch.confidence * 10), 
          patternName: targetMatch.patternName,
          category: 'auto',
          isAuto: true,
          isHuman: false,
          strategy: targetMatch.strategy,
          transformer: targetMatch.transformer,
          explanation: `${(ratio * 100).toFixed(0)}% of usages match safe auto-pattern "${targetMatch.patternName}"`
        };
      }
    }

    if (targetMatch.category === 'human') {
      return {
        score: 20 + (targetMatch.confidence * 10), // 20-30 range
        patternName: targetMatch.patternName,
        category: 'human',
        isAuto: false,
        isHuman: true,
        strategy: targetMatch.strategy || 'human-decision',
        humanPattern: targetMatch.patternName,
        explanation: `Pattern "${targetMatch.patternName}" suggested for human review.`
      };
    }

    // TODO pattern
    return {
      score: targetMatch.confidence * 15, // 0-15 range
      patternName: targetMatch.patternName,
      category: 'todo',
      isAuto: false,
      isHuman: false,
      strategy: 'todo',
      explanation: `Pattern "${targetMatch.patternName}" is not safely automatable.`
    };
  }

  private getSafetyHeuristic(mock: MockFinding, usages: Usage[]): { score: number, patternName: string, explanation: string } {
      if (usages.length === 0) return { score: 0, patternName: '', explanation: '' };

      const allSimple = usages.every(u => u.transformations.length === 0 && !u.hasConditional);
      if (allSimple) {
          return { score: 30, patternName: 'generic-simple', explanation: 'All usages are simple direct references.' };
      }

      const hasJsx = usages.some(u => u.isInJsx);
      const transformations = usages.reduce((acc, u) => acc + u.transformations.length, 0);

      if (hasJsx && transformations <= 1) {
          return { score: 25, patternName: 'generic-jsx', explanation: 'Mainly JSX usage with minimal transformations.' };
      }

      if (transformations > 3) {
          return { score: 5, patternName: 'generic-complex', explanation: 'High number of transformations detected.' };
      }

      return { score: 15, patternName: 'generic-medium', explanation: 'Moderate complexity, non-standard pattern.' };
  }
}
