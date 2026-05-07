import { Block, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyMutationSetter(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const mockVar = binding.mockName;
  const mutationHookName = binding.hookName;
  const mutationVar = mockVar.startsWith('set') ? mockVar.replace('set', 'mutate') : `mutate${mockVar.charAt(0).toUpperCase()}${mockVar.slice(1)}`;

  // 1. Inject the useMutation hook
  const hookCall = adapter.generateMutationCall(mutationHookName, binding.mutationTemplate);
  const declaration = `const { mutate: ${mutationVar} } = ${hookCall};`;
  
  insertAfterLastHook(body, declaration);

  // 1.5 Inject useUtils or queryClient for invalidations
  if (binding.mutationTemplate?.invalidates.length) {
      if (adapter.name === 'trpc') {
          const utilsVar = 'utils';
          if (!body.getStatements().some(s => s.getText().includes(`${utilsVar} =`))) {
              insertAfterLastHook(body, `const ${utilsVar} = ${binding.trpcExportName || 'trpc'}.useUtils();`);
          }
      } else {
          if (!body.getStatements().some(s => s.getText().includes('queryClient ='))) {
              insertAfterLastHook(body, `const queryClient = useQueryClient();`);
              ensureImport(sourceFile, 'useQueryClient', '@tanstack/react-query');
          }
      }
  }

  // 2. Find and replace all setter calls: setUsers([...users, newItem]) -> mutateUsers(newItem)
  const setterName = mockVar.startsWith('set') ? mockVar : `set${mockVar.charAt(0).toUpperCase()}${mockVar.slice(1)}`;
  
  body.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(c => c.getExpression().getText() === setterName)
    .forEach(call => {
        const args = call.getArguments();
        if (args.length > 0) {
            const arg = args[0];
            const argText = arg.getText();
            
            // Try to extract the NEW item from the spread
            // e.g. [...users, newItem] or [...MOCK_USERS, newItem]
            if (argText.includes('...')) {
                const elements = arg.getDescendantsOfKind(SyntaxKind.Identifier);
                // The last identifier that isn't the mockVar or setterName is likely the new item
                const newItem = elements.reverse().find(id => id.getText() !== mockVar && id.getText() !== setterName);
                if (newItem) {
                    call.replaceWithText(`${mutationVar}(${newItem.getText()})`);
                } else {
                    // Fallback: just pass the whole thing
                    call.replaceWithText(`${mutationVar}(${argText})`);
                }
            } else {
                call.replaceWithText(`${mutationVar}(${argText})`);
            }
        }
    });

  // 3. Remove the useState declaration if it exists
  body.getVariableDeclarations().forEach(decl => {
      const init = decl.getInitializer();
      if (init && Node.isCallExpression(init) && init.getExpression().getText() === 'useState') {
          const nameNode = decl.getNameNode();
          if (Node.isArrayBindingPattern(nameNode)) {
              if (nameNode.getElements().some(el => el.getText().includes(setterName))) {
                  decl.getFirstAncestorByKind(SyntaxKind.VariableStatement)?.remove();
              }
          }
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

function ensureImport(sourceFile: SourceFile, name: string, module: string): void {
  const existing = sourceFile.getImportDeclaration(i => i.getModuleSpecifierValue() === module);
  if (!existing) {
    sourceFile.addImportDeclaration({ moduleSpecifier: module, namedImports: [name] });
  } else if (!existing.getNamedImports().some(n => n.getName() === name)) {
    existing.addNamedImport(name);
  }
}
