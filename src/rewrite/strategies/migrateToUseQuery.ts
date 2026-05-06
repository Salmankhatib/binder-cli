// src/rewrite/strategies/migrateToUseQuery.ts
import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyMigrateToUseQuery(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  const hookCall = adapter.generateQueryCall(binding.hookName, binding.inferredInput);
  const hookDecl = `const { ${adapter.dataProperty}: ${hookVar}, ${adapter.loadingProperty}: ${hookVar}Loading } = ${hookCall};`;
  
  insertAfterLastHook(body, hookDecl);
  
  // Find and remove the useState declaration for this mock
  body.getVariableDeclarations().forEach(decl => {
    if (decl.getInitializer()?.getText() === binding.mockName) {
        decl.getFirstAncestorByKind(SyntaxKind.VariableStatement)?.remove();
    }
  });
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
