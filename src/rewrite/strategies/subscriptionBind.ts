import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applySubscriptionBind(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  // 1. Inject the useSubscription hook
  const hookCall = adapter.generateQueryCall(binding.hookName, binding.inferredInput).replace('useQuery', 'useSubscription');
  const declaration = `const { data: ${hookVar} } = ${hookCall};`;
  
  insertAfterLastHook(body, declaration);

  // 2. Find and remove real-time mock side effects (setInterval, socket.on)
  body.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(c => {
        const text = c.getExpression().getText();
        return text === 'setInterval' || text === 'setTimeout' || text.includes('socket.on');
    })
    .forEach(call => {
        if (call.getText().includes(binding.mockName)) {
            call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement)?.remove();
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
