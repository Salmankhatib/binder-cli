// src/rewrite/strategies/guardByLoading.ts
import { Block, SourceFile, SyntaxKind } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyGuardByLoading(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  const hookCall = adapter.generateQueryCall(binding.hookName, binding.inferredInput);
  const hookDecl = `const { ${adapter.dataProperty}: ${hookVar}, ${adapter.loadingProperty}: ${hookVar}Loading } = ${hookCall};`;
  
  insertAfterLastHook(body, hookDecl);
  
  const loadingTemplate = `<div>Loading...</div>`;
  const guard = `if (${hookVar}Loading) return ${loadingTemplate};`;
  
  insertStatementAfter(body, hookDecl, guard);
}

function insertAfterLastHook(body: Block, statement: string): void {
  const statements = body.getStatements();
  let lastHookIndex = -1;
  for (let i = 0; i < statements.length; i++) {
    if (statements[i].getText().includes('use')) {
      lastHookIndex = i;
    }
  }
  body.insertStatements(lastHookIndex + 1, statement);
}

function insertStatementAfter(body: Block, afterText: string, statement: string): void {
  const statements = body.getStatements();
  const index = statements.findIndex(s => s.getText().includes(afterText));
  if (index !== -1) {
    body.insertStatements(index + 1, statement);
  }
}
