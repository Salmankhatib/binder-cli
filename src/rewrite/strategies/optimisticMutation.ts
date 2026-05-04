// src/rewrite/strategies/optimisticMutation.ts
import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyOptimisticMutation(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  const hookCall = `${binding.hookName}({
    onMutate: async (newData) => {
      // Optimistic update logic here
    },
    onError: (err, newData, context) => {
      // Rollback logic here
    }
  })`;
  
  const declaration = `const mutation = ${hookCall};`;
  const alias = `const ${hookVar} = (data) => mutation.mutate(data);`;
  
  insertAfterLastHook(body, declaration);
  insertAfterLastHook(body, alias);
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
