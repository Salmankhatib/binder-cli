// src/cli/reviewMode.ts
import pkg from 'enquirer';
const { Select, Confirm } = pkg;
import type { MockFinding } from '../scan/mockScanner.js';

export interface ManualReviewItem {
  mock: MockFinding;
  hook: string;
  reason: string;
}

export async function manualReviewMode(todos: ManualReviewItem[]) {
  console.log(`\n📋 Manual Review Required for ${todos.length} mocks\n`);
  
  const results = [];
  
  for (const todo of todos) {
    const action = await new Select({
      name: 'action',
      message: `Mock: ${todo.mock.name} (${todo.reason})`,
      choices: [
        { name: 'auto', message: 'Auto-convert anyway (might break)' },
        { name: 'manual', message: 'I will fix manually' },
        { name: 'skip', message: 'Skip this mock' }
      ]
    }).run();
    
    let confirmed = false;
    if (action === 'auto') {
      confirmed = await new Confirm({
        message: 'Are you sure? This might break your code.'
      }).run();
    }
    
    results.push({
      mock: todo.mock,
      action: action,
      willAutoConvert: action === 'auto' && confirmed
    });
  }
  
  return results;
}
