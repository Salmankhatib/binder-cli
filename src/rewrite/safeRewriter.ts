// src/rewrite/safeRewriter.ts
import { findAllUsages, UsageContext } from '../analysis/usageFinder.js';
import { isSafePattern, getUnsafeReason } from '../safety/patterns.js';
import { logger } from '../utils/logger.js';
import type { MockFinding } from '../scan/mockScanner.js';

export interface RewriteResult {
  type: 'auto' | 'todo' | 'skip';
  confidence: number;
  strategy?: string;
  reason?: string;
  todoComment?: string;
}

export function safeRewrite(
  mock: MockFinding, 
  hookName: string,
  sourceFile: any
): RewriteResult {
  
  // Find ALL usages of this mock
  const usages = findAllUsages(mock.name, sourceFile);
  
  if (usages.length === 0) {
    return {
      type: 'skip',
      confidence: 0,
      reason: 'No usages found'
    };
  }
  
  // Check if ALL usages are safe
  let lowestConfidence = 1;
  let unsafeUsages: UsageContext[] = [];
  let strategies = new Set<string>();
  
  for (const usage of usages) {
    const safePattern = isSafePattern(mock, usage);
    
    if (!safePattern) {
      unsafeUsages.push(usage);
      lowestConfidence = 0;
    } else {
      lowestConfidence = Math.min(lowestConfidence, safePattern.confidence);
      strategies.add(safePattern.rewriteStrategy);
    }
  }
  
  // If ANY usage is unsafe, add TODO
  if (unsafeUsages.length > 0) {
    const reason = getUnsafeReason(mock, unsafeUsages[0]);
    return {
      type: 'todo',
      confidence: lowestConfidence,
      reason,
      todoComment: generateTodoComment(mock, hookName, usages, unsafeUsages)
    };
  }
  
  // ALL usages are safe - auto-convert
  return {
    type: 'auto',
    confidence: lowestConfidence,
    strategy: strategies.size === 1 ? Array.from(strategies)[0] : 'default'
  };
}

function generateTodoComment(
  mock: MockFinding, 
  hookName: string,
  allUsages: UsageContext[],
  unsafeUsages: UsageContext[]
): string {
  const unsafeLines = unsafeUsages.map(u => u.node.getStartLineNumber()).join(', ');
  
  return `
/* 
======================================================================
TODO(BINDER): Manual Review Required
======================================================================
Mock: ${mock.name}
Suggested Hook: ${hookName}
Confidence: LOW

Unsafe usages found at lines: ${unsafeLines}

Manual conversion needed because this pattern involves complex logic 
(conditionals, multiple transforms, or side effects) that cannot be 
safely automated.

How to fix:
1. Search for usages of ${mock.name}
2. Replace with: const { data } = ${hookName}()
3. Handle async states (loading/error)
======================================================================
*/`.trim();
}


