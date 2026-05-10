// src/engine/scoring/matchScorer.ts
import { MockFinding, ProjectContext } from '../types.js';
import { heuristicMatch } from '../../match/heuristicMatcher.js';
import { semanticMatch } from '../../match/semanticMatcher.js';
import { contextualMatch } from '../../match/contextualMatcher.js';
import { SourceFile, Project } from 'ts-morph';
import { UsageProfile } from '../../analysis/usageAnalyzer.js';

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
    usageProfile?: UsageProfile,
    trpcProcedures?: Map<string, any>
  ): Promise<MatchScoreResult> {
    const hMatches = heuristicMatch([mock], hookNames, projectContext.filePath);
    
    // Semantic match needs hook signatures
    const sMatches = semanticMatch(
      [mock], 
      hookNames.map(n => ({ name: n, method: 'GET', path: '/', responseType: 'any' })), 
      apiContent,
      trpcProcedures
    );

    // console.log(`[DEBUG] hMatches:`, JSON.stringify(hMatches));
    // console.log(`[DEBUG] sMatches:`, JSON.stringify(sMatches));

    // Contextual match needs a SourceFile instance
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('temp.tsx', ''); 
    const cMatches = contextualMatch(mock, projectContext.filePath, sourceFile, hookNames);

    // Ensemble scoring
    const scores: Record<string, number> = {};
    for (const name of hookNames) {
      const h = hMatches.find(m => m?.hookName === name)?.confidence || 0;
      const s = sMatches.find(m => m?.hookName === name || m?.hookName === name.replace(/\./g, '_'))?.confidence || 0;
      const c = cMatches.find(m => m.hookName === name)?.confidence || 0;
      
      // console.log(`[DEBUG] Hook: ${name}, h: ${h}, s: ${s}, c: ${c}`);

      // BOOST: Ensemble favors the best signal. tRPC is very strong signal.
      let weightedScore = Math.max(h * 1.2, s * 1.3, c * 1.0); 

      // PRIORITY 2: Negative Scoring / Penalties
      if (usageProfile) {
        if (usageProfile.patterns.includes('useState-init')) {
            // If it's a mutation setter, we actually want this (Phase 4.2)
            if (usageProfile.patterns.includes('mutation-setter')) {
                weightedScore *= 0.9;
            } else {
                weightedScore *= 0.1; 
            }
        }
        if (usageProfile.patterns.includes('useEffect-dep')) weightedScore *= 0.15; 
        if (usageProfile.patterns.includes('prop-pass')) weightedScore *= 0.2; 
        if (usageProfile.patterns.includes('method-call')) weightedScore *= 0.05; 
        if (usageProfile.patterns.includes('imperative-dom')) weightedScore *= 0.02; 
        
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
          weightedScore += 0.1;
      }

      // PRIORITY 4.2: Mutation Match Boost
      if (usageProfile?.patterns.includes('mutation-setter')) {
          const isMutationHook = name.toLowerCase().includes('create') || 
                                name.toLowerCase().includes('update') || 
                                name.toLowerCase().includes('delete') || 
                                name.toLowerCase().includes('post') || 
                                name.toLowerCase().includes('put');
          
          if (isMutationHook) {
              weightedScore += 0.4; // Stronger boost
          } else {
              weightedScore -= 0.2; // Penalize queries if we NEED a mutation
          }
      }

      // tRPC-specific name-to-path heuristic
      if (projectContext.protocol === 'trpc') {
          const mockNorm = mock.name.replace(/^(MOCK_|FAKE_)/i, '').replace(/_(DATA|LIST|ARRAY|ITEMS|SET)$/i, '').toLowerCase();
          const hookParts = name.toLowerCase().split('.');
          if (hookParts.includes(mockNorm) || (mockNorm.endsWith('s') && hookParts.includes(mockNorm.slice(0, -1)))) {
              weightedScore = Math.max(weightedScore, 0.8);
          }
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
    
    // Lower ambiguity penalty for tRPC because namespaced procedures naturally overlap
    let ambiguityPenalty = (bestScore - secondBest) < 0.15 ? 5 : 0;
    if (projectContext.protocol === 'trpc') {
        ambiguityPenalty = (bestScore - secondBest) < 0.05 ? 3 : 0;
    }

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
