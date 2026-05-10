// src/rewrite/strategies/manual.ts
import { Block } from 'ts-morph';
import { Binding } from '../../common/types.js';

/**
 * Manual strategy: Inserts the code exactly as provided by the user during a TUI session.
 */
export function applyManualFix(
  body: Block,
  binding: Binding
): void {
  if (!binding.manualCode) return;

  const statements = body.getStatements();
  let lastHookIndex = -1;
  for (let i = 0; i < statements.length; i++) {
    if (statements[i].getText().includes('use')) {
      lastHookIndex = i;
    }
  }
  
  body.insertStatements(lastHookIndex + 1, binding.manualCode);
}
