// src/engine/scoring/matchScorer.ts
import { MockFinding, ProjectContext } from '../types.js';
import { heuristicMatch } from '../../match/heuristicMatcher.js';
import { semanticMatch } from '../../match/semanticMatcher.js';
import { contextualMatch } from '../../match/contextualMatcher.js';
import { SourceFile, Project } from 'ts-morph';

export interface MatchScoreResult {
  score: number;
  bestHook: string;
  confidence: number;
  explanation: string;
}

export class MatchScorer {
  async score(
    mock: MockFinding,
    hookNames: string[],
    apiContent: string,
    projectContext: ProjectContext
  ): Promise<MatchScoreResult> {
    const hMatches = heuristicMatch([mock], hookNames, projectContext.filePath);
    
    // Semantic match needs hook signatures
    const sMatches = semanticMatch(
      [mock], 
      hookNames.map(n => ({ name: n, method: 'GET', path: '/', responseType: 'any' })), 
      apiContent
    );

    // Contextual match needs a SourceFile instance
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('temp.tsx', ''); // Dummy, contextualMatch only uses it for dirname if needed
    const cMatches = contextualMatch(mock, projectContext.filePath, sourceFile, hookNames);

    // Ensemble scoring
    const scores: Record<string, number> = {};
    for (const name of hookNames) {
      const h = hMatches.find(m => m?.hookName === name)?.confidence || 0;
      const s = sMatches.find(m => m?.hookName === name)?.confidence || 0;
      const c = cMatches.find(m => m.hookName === name)?.confidence || 0;
      // BOOST: Ensemble favors the best signal. Increased weights.
      scores[name] = Math.max(h, s * 0.95, c * 0.85); 
    }

    const sorted = Object.entries(scores)
      .filter(([_, s]) => s > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      return {
        score: 0,
        bestHook: '',
        confidence: 0,
        explanation: 'No hook match found. Check schema alignment.'
      };
    }

    const [bestHook, bestScore] = sorted[0];
    const secondBest = sorted[1]?.[1] || 0;
    const ambiguityPenalty = (bestScore - secondBest) < 0.15 ? 5 : 0;

    return {
      score: Math.min(bestScore * 30, 30) - ambiguityPenalty,
      bestHook,
      confidence: bestScore,
      explanation: ambiguityPenalty > 0 
        ? `Best match "${bestHook}" (${(bestScore * 100).toFixed(0)}%) but ambiguous (second: ${(secondBest * 100).toFixed(0)}%)`
        : `Strong match "${bestHook}" with ${(bestScore * 100).toFixed(0)}% confidence`
    };
  }
}
