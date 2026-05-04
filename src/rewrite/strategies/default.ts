// src/rewrite/strategies/default.ts
import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyDefaultStrategy(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  // 1. Determine if it's a mutation or query
  const isMutation = binding.actionType !== 'READ';
  
  // 2. Generate hook call
  const hookCall = adapter.generateQueryCall(binding.hookName);
  
  // 3. Construct declaration
  let declaration = '';
  if (isMutation) {
    declaration = `const { mutate: ${hookVar} } = ${hookCall};`;
  } else {
    declaration = `const { ${adapter.dataProperty}: ${hookVar}, ${adapter.loadingProperty}: ${hookVar}Loading, ${adapter.errorProperty}: ${hookVar}Error } = ${hookCall};`;
  }
  
  // 4. Insert at top of component body
  insertAfterLastHook(body, declaration);
  
  // 5. Add loading/error guards if configured
  if (!isMutation && binding.loadingStrategy === 'early-return-skeleton') {
    const loadingTemplate = `<div>Loading ${hookVar}...</div>`;
    insertStatementAfter(body, declaration, `if (${hookVar}Loading) return ${loadingTemplate};`);
  }
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
