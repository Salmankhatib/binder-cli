// src/rewrite/strategies/wrapInUseMemo.ts
import { Block, SourceFile, SyntaxKind } from 'ts-morph';
import { DataLibraryAdapter } from '../../adapters/adapter.interface.js';
import { Binding } from '../../common/types.js';

export function applyWrapInUseMemo(
  body: Block,
  binding: Binding,
  sourceFile: SourceFile,
  adapter: DataLibraryAdapter
): void {
  const hookVar = binding.mockName.replace(/^(MOCK_|FAKE_|STUB_|DUMMY_|SAMPLE_|TEST_)/i, '').toLowerCase();
  
  // Generate hook call
  const hookCall = adapter.generateQueryCall(binding.hookName);
  
  // Insert hook declaration
  const hookDecl = `const { ${adapter.dataProperty}: ${hookVar}Raw, ${adapter.loadingProperty}: ${hookVar}Loading, ${adapter.errorProperty}: ${hookVar}Error } = ${hookCall};`;
  
  insertAfterLastHook(body, hookDecl);
  
  // Generate useMemo for transformations
  const transforms = binding.transformer || 'map(x => x)';
  const memoDecl = `const ${hookVar} = ${adapter.generateMemoCall(`${hookVar}Raw`, transforms)};`;
  
  insertAfterLastHook(body, memoDecl);
  
  // Ensure useMemo import
  ensureImport(sourceFile, 'useMemo', 'react');
  
  // Add loading/error guards if configured
  if (binding.loadingStrategy === 'early-return-skeleton') {
    const loadingTemplate = `<div>Loading ${hookVar}...</div>`; 
    insertStatementAfter(body, hookDecl, `if (${hookVar}Loading) return ${loadingTemplate};`);
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

function ensureImport(sourceFile: SourceFile, name: string, module: string): void {
  const existing = sourceFile.getImportDeclaration(i => i.getModuleSpecifierValue() === module);
  if (!existing) {
    sourceFile.addImportDeclaration({ moduleSpecifier: module, namedImports: [name] });
  } else if (!existing.getNamedImports().some(n => n.getName() === name)) {
    existing.addNamedImport(name);
  }
}
