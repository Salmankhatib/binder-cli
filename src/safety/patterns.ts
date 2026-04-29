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
  hasSideEffects,
  findComponentBody,
  hasComputedProperties,
  hasSetterUsage
} from '../analysis/usageFinder.js';

export interface SafetyRule {
  name: string;
  test: (mock: MockFinding, usage: UsageContext) => boolean;
  confidence: number;
  rewriteStrategy: string;
}

// SAFE PATTERN 1: Direct variable assignment (Easiest)
const DIRECT_ASSIGNMENT: SafetyRule = {
  name: 'direct-assignment',
  test: (mock, usage) => {
    return usage.parent?.getKind() === SyntaxKind.VariableDeclaration &&
           !hasTransformations(usage);
  },
  confidence: 0.95,
  rewriteStrategy: 'default'
};

// SAFE PATTERN 2: useQuery with inline mock (Common)
const INLINE_USE_QUERY: SafetyRule = {
  name: 'inline-usequery',
  test: (mock, usage) => {
    return isInsideUseQuery(usage) &&
           !hasConditionalLogic(usage) &&
           !hasTransformations(usage);
  },
  confidence: 0.9,
  rewriteStrategy: 'default'
};

// SAFE PATTERN 3: Simple array map (No complex transforms)
const SIMPLE_MAP: SafetyRule = {
  name: 'simple-map',
  test: (mock, usage) => {
    const transforms = usage.transformations;
    return transforms.length === 1 && 
           transforms[0] === 'map' &&
           !hasConditionalLogic(usage);
  },
  confidence: 0.85,
  rewriteStrategy: 'default'
};

// SAFE PATTERN 4: Direct prop passing (No component modification needed)
const PROP_PASSING: SafetyRule = {
  name: 'prop-passing',
  test: (mock, usage) => {
    return (usage.parent?.getKind() === SyntaxKind.JsxExpression || 
            usage.parent?.getKind() === SyntaxKind.JsxAttribute) &&
           !hasTransformations(usage);
  },
  confidence: 0.8,
  rewriteStrategy: 'default'
};

// Pattern 5: Deterministic transforms (.filter, .sort, .slice, .reverse)
const DETERMINISTIC_TRANSFORMS: SafetyRule = {
  name: 'deterministic-transforms',
  test: (mock, usage) => {
    const allowed = ['filter', 'sort', 'slice', 'reverse', 'concat', 'find'];
    const transforms = usage.transformations || [];
    return transforms.length > 0 && 
           transforms.every(t => allowed.includes(t)) && 
           !hasConditionalLogic(usage);
  },
  confidence: 0.85,
  rewriteStrategy: 'wrap-in-usememo'
};

// Pattern 6: useState initialization with mock
const USE_STATE_MOCK: SafetyRule = {
  name: 'usestate-mock-init',
  test: (mock, usage) => {
    const parent = usage.node.getParent();
    return parent?.getKind() === SyntaxKind.CallExpression &&
           (parent as any).getExpression().getText() === 'useState';
  },
  confidence: 0.8,
  rewriteStrategy: 'migrate-to-usequery'
};

// Pattern 7: Already has loading/error guards
const ALREADY_GUARDED: SafetyRule = {
  name: 'already-guarded',
  test: (mock, usage) => {
    const body = findComponentBody(usage.node);
    if (!body) return false;
    const text = body.getText();
    return text.includes('isLoading') || 
           text.includes('isPending') ||
           text.includes('isError');
  },
  confidence: 0.9,
  rewriteStrategy: 'swap-data-source-only'
};

// Pattern 8: Spread with extra fields
const SAFE_SPREAD: SafetyRule = {
  name: 'safe-spread',
  test: (mock, usage) => {
    const parent = usage.node.getParent();
    return parent?.getKind() === SyntaxKind.SpreadAssignment &&
           !hasComputedProperties(parent);
  },
  confidence: 0.75,
  rewriteStrategy: 'ensure-superset'
};

export function isSafePattern(mock: MockFinding, usage: UsageContext): SafetyRule | null {
  const rules = [
    DIRECT_ASSIGNMENT, 
    INLINE_USE_QUERY, 
    SIMPLE_MAP, 
    PROP_PASSING,
    DETERMINISTIC_TRANSFORMS,
    USE_STATE_MOCK,
    ALREADY_GUARDED,
    SAFE_SPREAD
  ];
  
  for (const rule of rules) {
    if (rule.test(mock, usage)) {
      // PHASE 1 REVISION: Check for setter usage in useState
      if (rule.name === 'usestate-mock-init') {
        const sourceFile = usage.node.getSourceFile();
        const hasSetter = hasSetterUsage(mock.name, sourceFile);
        return {
          ...rule,
          confidence: hasSetter ? 0.4 : 0.8
        };
      }
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
