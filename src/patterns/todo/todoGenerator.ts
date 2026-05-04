// src/patterns/todo/todoGenerator.ts
import { MockFinding, Usage, TodoContext } from '../../engine/types.js';
import { analyzeUsage } from '../../analyze/usageAnalyzer.js';

export class TodoGenerator {
  generate(mock: MockFinding, usages: Usage[], patternResult: any, matchResult: any): TodoContext {
    const steps: string[] = [];
    const profile = analyzeUsage(usages as any);
    
    let reason = 'complexity';
    let explanation = profile.explanation.join(' ') || 'The mock usage is too complex for automatic binding.';

    if (profile.patterns.includes('useState-init')) {
        reason = 'useState-init';
        explanation = 'Mock is used as a useState() initializer. Async hooks return undefined on first render, which breaks form state.';
        steps.push('Inject a loading guard before the useState call.');
        steps.push('Use useEffect to sync API data with form state once loaded.');
    } else if (profile.patterns.includes('prop-pass')) {
        reason = 'prop-pass';
        explanation = `Mock is passed as a prop to other components.`;
        steps.push('Identify all child components receiving this prop.');
        steps.push('Migrate child components to use the same API hook or lift the state.');
    } else if (profile.patterns.includes('useEffect-dep')) {
        reason = 'useEffect-dep';
        explanation = 'Mock is a dependency in a side-effect hook. Changing to async data will change execution timing.';
        steps.push('Audit the effect logic to ensure it handles undefined/loading states.');
    } else if (profile.patterns.includes('imperative-dom')) {
        reason = 'imperative-dom';
        explanation = 'Mock is used with imperative DOM APIs (Canvas/Ref). APIs return JSON, requiring a declarative bridge.';
        steps.push('Refactor imperative logic to be declarative or use a React-friendly library.');
    } else if (profile.patterns.includes('method-call')) {
        reason = 'method-call';
        explanation = 'Mock has methods called on it. API responses are plain JSON objects and lack methods.';
        steps.push('Convert class-based mocks to plain objects or use a transformer.');
    }

    if (steps.length === 0) {
        steps.push('Consider manually rewriting this binding or adding a new safety pattern.');
    }

    return {
      reason,
      explanation,
      suggestedSteps: steps,
      estimatedEffort: 'medium'
    };
  }
}
