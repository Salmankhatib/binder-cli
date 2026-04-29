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
  const reason = getUnsafeReason(mock, unsafeUsages[0]);
  
  return `
/*
${'='.repeat(70)}
TODO(BINDER): Manual Review Required - ${reason}
${'='.repeat(70)}

Mock: ${mock.name}
Suggested Hook: ${hookName}
Confidence: LOW

Unsafe usages found at lines: ${unsafeLines}

Why this needs manual review:
${getDetailedReason(reason, mock)}

How to fix:
1. Find where ${mock.name} is used (search for it)
2. Replace with: const { data: ${mock.name.toLowerCase()} } = ${hookName}()
3. Update the usage patterns to work with async data
4. Add loading/error states if needed

Original mock snippet:
${mock.snippet.substring(0, 200)}...
${'='.repeat(70)}
*/
  `.trim();
}

function getDetailedReason(reason: string, mock: MockFinding): string {
  switch(reason) {
    case 'conditional-logic':
      return \`\${mock.name} is used inside if/else or ternary statements. The mock returns instantly, but the real API is async. Need to restructure conditional logic.\`;
    case 'multiple-transformations':
      return \`\${mock.name} has .filter().map().reduce() chains. These need to be applied AFTER the API data loads.\`;
    case 'nested-property-access':
      return \`\${mock.name} has nested access like .user.profile.name. Need to check if API returns same nesting structure.\`;
    default:
      return \`Complex pattern detected. Manual conversion needed.\`;
  }
}
