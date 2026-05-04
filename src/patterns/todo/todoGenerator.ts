// src/patterns/todo/todoGenerator.ts
import { MockFinding, Usage, TodoContext } from '../../engine/types.js';

export class TodoGenerator {
  generate(mock: MockFinding, usages: Usage[], patternResult: any, matchResult: any): TodoContext {
    const steps: string[] = [];
    let reason = 'complexity';
    let explanation = 'The mock usage is too complex for automatic binding.';

    if (patternResult.score === 0) {
      reason = 'no-pattern';
      explanation = 'No recognized safety pattern matches this usage.';
      steps.push('Analyze how the mock is being transformed or accessed.');
    } else if (matchResult.confidence < 0.5) {
      reason = 'weak-match';
      explanation = `Weak hook match for "${mock.name}".`;
      steps.push('Check if the corresponding API hook is generated.');
      steps.push('Verify the mock data structure aligns with the API response.');
    }

    steps.push('Consider manually rewriting this binding or adding a new safety pattern.');

    return {
      reason,
      explanation,
      suggestedSteps: steps,
      estimatedEffort: 'medium'
    };
  }
}
