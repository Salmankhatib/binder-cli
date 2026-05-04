// src/rewrite/strategies/clientPagination.ts
import { Block, SourceFile, SyntaxKind } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyClientPagination(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  const hookCall = adapter.generateQueryCall(binding.hookName);
  const hookDecl = `const { ${adapter.dataProperty}: ${hookVar}Raw } = ${hookCall};`;
  
  insertAfterLastHook(body, hookDecl);
  
  const memoDecl = `const ${hookVar} = useMemo(() => ${hookVar}Raw?.slice(page * size, (page + 1) * size) ?? [], [${hookVar}Raw, page, size]);`;
  
  insertAfterLastHook(body, memoDecl);
  
  ensureImport(sourceFile, 'useMemo', 'react');
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
