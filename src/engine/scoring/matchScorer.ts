// src/engine/scoring/matchScorer.ts
import { MockFinding, ProjectContext } from '../types.js';
import { heuristicMatch } from '../../match/heuristicMatcher.js';
import { semanticMatch } from '../../match/semanticMatcher.js';
import { contextualMatch } from '../../match/contextualMatcher.js';
import { SourceFile, Project } from 'ts-morph';
import { UsageProfile } from '../../analyze/usageAnalyzer.js';

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
    projectContext: ProjectContext,
    usageProfile?: UsageProfile
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
    const sourceFile = project.createSourceFile('temp.tsx', ''); 
    const cMatches = contextualMatch(mock, projectContext.filePath, sourceFile, hookNames);

    // Ensemble scoring
    const scores: Record<string, number> = {};
    for (const name of hookNames) {
      const h = hMatches.find(m => m?.hookName === name)?.confidence || 0;
      const s = sMatches.find(m => m?.hookName === name)?.confidence || 0;
      const c = cMatches.find(m => m.hookName === name)?.confidence || 0;
      
      // PRIORITY 2: Weighted Ensemble: 0.5*h + 0.3*s + 0.2*c
      let weightedScore = (0.5 * h) + (0.3 * s) + (0.2 * c);

      // PRIORITY 2: Negative Scoring / Penalties
      if (usageProfile) {
        if (usageProfile.patterns.includes('useState-init')) weightedScore *= 0.1; // 90% penalty
        if (usageProfile.patterns.includes('useEffect-dep')) weightedScore *= 0.15; // 85% penalty
        if (usageProfile.patterns.includes('prop-pass')) weightedScore *= 0.2; // 80% penalty
        if (usageProfile.patterns.includes('method-call')) weightedScore *= 0.05; // 95% penalty
        if (usageProfile.patterns.includes('imperative-dom')) weightedScore *= 0.02; // 98% penalty
        
        if (usageProfile.patterns.includes('render-only')) {
            weightedScore *= 1.2; // 20% boost for clean cases
        }
        
        if (usageProfile.patterns.includes('derived-data')) {
            weightedScore *= 0.5; // 50% penalty to push to HUMAN
        }
      }

      // PRIORITY A: Global Frequency Boost
      const frequency = projectContext.impactMap?.hookUsageFrequency[name] || 0;
      if (frequency > 5) {
          // If the hook is used in many files, it's a safer bet
          weightedScore += 0.1;
      }

      scores[name] = Math.min(weightedScore, 1.0);
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
