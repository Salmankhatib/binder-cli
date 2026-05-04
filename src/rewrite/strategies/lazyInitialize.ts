// src/rewrite/strategies/lazyInitialize.ts
import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyLazyInitialize(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  const hookCall = adapter.generateQueryCall(binding.hookName);
  const hookDecl = `const { ${adapter.dataProperty}: ${hookVar}Data } = ${hookCall};`;
  
  insertAfterLastHook(body, hookDecl);
  
  // Find the useState that was using the mock
  body.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(c => c.getExpression().getText() === 'useState')
    .forEach(call => {
        const args = call.getArguments();
        if (args.length > 0 && args[0].getText() === hookVar) {
            args[0].replaceWithText(`${hookVar}Data || []`);
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
