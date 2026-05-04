// src/rewrite/strategies/testWrapper.ts
import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyTestWrapper(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  // In tests, we often just want to ensure the data is available
  // or wrap the component in a provider. For now, we'll do a simple mock injection.
  const mockDecl = `const ${hookVar} = ${binding.mockName}; // Mock preserved for test context`;
  
  insertAfterLastHook(body, mockDecl);
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
