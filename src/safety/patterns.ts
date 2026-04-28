// src/safety/patterns.ts
import { SyntaxKind } from 'ts-morph';
import type { MockFinding } from '../scan/mockScanner.js';
import { 
  UsageContext, 
  hasTransformations, 
  isInsideUseQuery, 
  hasConditionalLogic, 
  hasMultipleTransforms, 
  hasNestedAccess, 
  hasDynamicKey, 
  hasSideEffects 
} from '../analysis/usageFinder.js';

export interface SafetyRule {
  name: string;
  test: (mock: MockFinding, usage: UsageContext) => boolean;
  confidence: number;
}

// SAFE PATTERN 1: Direct variable assignment (Easiest)
const DIRECT_ASSIGNMENT: SafetyRule = {
  name: 'direct-assignment',
  test: (mock, usage) => {
    // Mock is assigned directly to a variable with no transformation
    // Example: const data = MOCK_USERS;
    return usage.parent?.getKind() === SyntaxKind.VariableDeclaration &&
           !hasTransformations(usage);
  },
  confidence: 0.95
};

// SAFE PATTERN 2: useQuery with inline mock (Common)
const INLINE_USE_QUERY: SafetyRule = {
  name: 'inline-usequery',
  test: (mock, usage) => {
    // Mock used directly in useQuery queryFn
    // Example: useQuery({ queryFn: () => MOCK_DATA })
    return isInsideUseQuery(usage) &&
           !hasConditionalLogic(usage) &&
           !hasTransformations(usage);
  },
  confidence: 0.9
};

// SAFE PATTERN 3: Simple array map (No complex transforms)
const SIMPLE_MAP: SafetyRule = {
  name: 'simple-map',
  test: (mock, usage) => {
    // Mock used with only .map, no filter/reduce
    // Example: MOCK_USERS.map(u => u.name)
    const transforms = usage.transformations;
    return transforms.length === 1 && 
           transforms[0] === 'map' &&
           !hasConditionalLogic(usage);
  },
  confidence: 0.85
};

// SAFE PATTERN 4: Direct prop passing (No component modification needed)
const PROP_PASSING: SafetyRule = {
  name: 'prop-passing',
  test: (mock, usage) => {
    // Mock passed directly as prop to another component
    // Example: <UserList users={MOCK_USERS} />
    return (usage.parent?.getKind() === SyntaxKind.JsxExpression || 
            usage.parent?.getKind() === SyntaxKind.JsxAttribute) &&
           !hasTransformations(usage);
  },
  confidence: 0.8
};

export function isSafePattern(mock: MockFinding, usage: UsageContext): SafetyRule | null {
  const rules = [DIRECT_ASSIGNMENT, INLINE_USE_QUERY, SIMPLE_MAP, PROP_PASSING];
  
  for (const rule of rules) {
    if (rule.test(mock, usage)) {
      return rule;
    }
  }
  
  return null;
}

export function getUnsafeReason(mock: MockFinding, usage: UsageContext): string {
  if (hasConditionalLogic(usage)) return 'conditional-logic';
  if (hasMultipleTransforms(usage)) return 'multiple-transformations';
  if (hasNestedAccess(usage)) return 'nested-property-access';
  if (hasDynamicKey(usage)) return 'dynamic-key-access';
  if (hasSideEffects(usage)) return 'side-effects-or-functions';
  return 'complex-pattern';
}
