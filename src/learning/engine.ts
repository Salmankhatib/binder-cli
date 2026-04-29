// src/learning/engine.ts
import { glob } from 'fast-glob';
import { getCachedBinding, recordPatternSuccess, getLearnedStrategy } from '../utils/cache.js';

export interface BindingContext {
  mockName: string;
  mockPrefix: string;
  mockEntity: string;
  mockShape: string[];
  mockIsArray: boolean;
  filePath: string;
  imports: string[];
  componentName: string;
  usagePattern: string;
  structuralSignature: string;
}

export interface UserDecision {
  hookName: string;
  strategy: string;
}

export interface Prediction {
    hookName: string;
    confidence: number;
    source: 'cache' | 'learned-rule';
    strategy: string;
}

export class LearningEngine {
  
  recordDecision(context: BindingContext, decision: UserDecision) {
    // 1. Store pattern success in cache
    recordPatternSuccess(context.structuralSignature, decision.strategy);
  }
  
  predict(context: BindingContext): Prediction | null {
    // 1. Check learned rules via structural signature
    const strategy = getLearnedStrategy(context.structuralSignature);
    
    if (strategy) {
      return { 
        hookName: '', // Strategy logic doesn't necessarily dictate the hook name yet
        confidence: 0.9,
        source: 'learned-rule',
        strategy: strategy
      };
    }
    
    return null;
  }
}

export function calculateConfidence(
  ensembleScore: number,
  learnedConfidence: number,
  preFlightIssueCount: number
): number {
  let score = ensembleScore;
  
  // Boost if learned rule agrees
  if (learnedConfidence > 0.8) {
    score += 0.1 * learnedConfidence;
  }
  
  // Penalize if pre-flight found issues
  const issuePenalty = preFlightIssueCount * 0.05;
  score -= issuePenalty;
  
  return Math.min(Math.max(score, 0), 1);
}
