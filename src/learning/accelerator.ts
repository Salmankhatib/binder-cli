// src/learning/accelerator.ts
import { HumanOption, MockFinding, Usage } from '../engine/types.js';
import { getLearnedStrategy, recordPatternSuccess, getCachedBinding, saveBinding } from '../utils/cache.js';
import { createHash } from 'crypto';

interface DecisionContext {
  mockName: string;
  patternName: string;
  structuralSignature: string;
  projectContext: string;
}

interface PatternFeatures {
  mockType: string;
  hasPagination: boolean;
  hasSort: boolean;
  hasFilter: boolean;
  isJsx: boolean;
  isCallback: boolean;
  transformCount: number;
}

export class LearningAccelerator {
  recordChoice(context: DecisionContext, choice: HumanOption): void {
    // 1. Immediate local learning via exact structural signature
    recordPatternSuccess(context.structuralSignature, choice.id);
    
    // 2. Feature extraction for abstract pattern learning
    const features = this.extractFeatures(context);
    
    // 3. Save as binding for future reuse
    saveBinding(context.projectContext, context.mockName, {
        hookName: choice.id, // This is a bit loose, choice.id might not be hookName
        strategy: choice.id
    });
  }

  predict(context: DecisionContext): { choice: string; confidence: number } | null {
    // 1. Check exact signature match from cache
    const exact = getLearnedStrategy(context.structuralSignature);
    if (exact) {
      return { choice: exact, confidence: 0.95 };
    }
    
    // 2. Check for previously saved bindings for this mock in this file
    const cached = getCachedBinding(context.projectContext, context.mockName);
    if (cached) {
        return { choice: cached.hookName, confidence: 0.9 };
    }
    
    return null;
  }

  calculateConfidence(
    ensembleScore: number,
    learnedConfidence: number,
    preFlightIssueCount: number = 0
  ): number {
    let score = ensembleScore;
    
    // Boost if learned rule agrees
    if (learnedConfidence > 0.8) {
      score += 0.1 * learnedConfidence;
    }
    
    // Penalize if pre-flight found issues (e.g. type errors)
    const issuePenalty = preFlightIssueCount * 0.05;
    score -= issuePenalty;
    
    return Math.min(Math.max(score, 0), 1);
  }

  private extractFeatures(context: DecisionContext): PatternFeatures {
    // Simple feature extraction from structural signature and context
    return {
      mockType: context.mockName.replace(/^(MOCK_|FAKE_)/i, '').split('_')[0],
      hasPagination: context.structuralSignature.includes('slice'),
      hasSort: context.structuralSignature.includes('sort'),
      hasFilter: context.structuralSignature.includes('filter'),
      isJsx: context.structuralSignature.includes('Jsx'),
      isCallback: context.structuralSignature.includes('ArrowFunction') || context.structuralSignature.includes('FunctionExpression'),
      transformCount: (context.structuralSignature.match(/>/g) || []).length
    };
  }

  private hashFeatures(features: PatternFeatures): string {
    return createHash('md5').update(JSON.stringify(features)).digest('hex').slice(0, 8);
  }
}
