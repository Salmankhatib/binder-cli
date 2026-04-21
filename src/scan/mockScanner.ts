import { Project, SyntaxKind, ArrayLiteralExpression, Node } from 'ts-morph';
import { logger } from '../utils/logger.js';

export interface MockFinding {
  type: 'import_mock' | 'inline_array' | 'variable_mock' | 'jsx_prop_mock' | 'action_mock';
  name: string;
  source?: string;
  line: number;
  snippet: string;
  inferredShape?: Record<string, string>;
  actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
}

const MOCK_PATTERNS = /mock|mocks|fake|fixture|stub|dummy|sample|test|data/i;
const MOCK_PREFIX = /^(MOCK|FAKE|STUB|DUMMY|SAMPLE|TEST)_/i;
const DATA_SUFFIX = /_(DATA|LIST|ARRAY|ITEMS|SET)$/i;
const ACTION_PATTERNS = /handle(Add|Create|Delete|Remove|Update|Edit|Save)/i;

export function scanMocks(filePath: string): MockFinding[] {
  logger.startSpinner('Scanning target for mock signatures and actions...');
  
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4 }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const findings: MockFinding[] = [];
  const mockVariables = new Set<string>();

  // 1. Detect Imports
  sourceFile.getImportDeclarations().forEach(imp => {
    const specifier = imp.getModuleSpecifierValue();
    if (!MOCK_PATTERNS.test(specifier)) return;
    
    imp.getNamedImports().forEach(n => {
      const name = n.getName();
      findings.push({ type: 'import_mock', name, source: specifier, line: imp.getStartLineNumber(), snippet: imp.getText().slice(0, 80) });
      mockVariables.add(name);
    });
  });

  // 2. Detect Variables & Arrays
  sourceFile.getVariableDeclarations().forEach(decl => {
    const name = decl.getName();
    const init = decl.getInitializer();
    if (MOCK_PREFIX.test(name) || DATA_SUFFIX.test(name) || name === "data" || name === "items" || name === "data" || name === "items") {
      if (init?.isKind(SyntaxKind.ArrayLiteralExpression)) {
        findings.push({ type: 'inline_array', name, line: decl.getStartLineNumber(), snippet: decl.getText().slice(0, 100), inferredShape: inferShape(init as ArrayLiteralExpression) });
      } else {
        findings.push({ type: 'variable_mock', name, line: decl.getStartLineNumber(), snippet: decl.getText().slice(0, 80) });
      }
      mockVariables.add(name);
    }
  });

  // 3. Detect Actions (Event Handlers)
  sourceFile.forEachDescendant(node => {
    if (Node.isFunctionDeclaration(node) || Node.isVariableDeclaration(node)) {
      const name = Node.isFunctionDeclaration(node) ? node.getName() : node.getName();
      if (name && ACTION_PATTERNS.test(name)) {
        const actionType = name.match(/Delete|Remove/i) ? 'DELETE' : (name.match(/Add|Create/i) ? 'CREATE' : 'UPDATE');
        findings.push({
          type: 'action_mock',
          name,
          line: node.getStartLineNumber(),
          snippet: node.getText().slice(0, 150),
          actionType
        });
      }
    }
  });

  logger.stopSpinner(true, `${findings.length} signatures detected`);
  return findings;
}

function inferShape(arrayLit: ArrayLiteralExpression): Record<string, string> | undefined {
  const elements = arrayLit.getElements();
  if (elements.length === 0) return undefined;
  const first = elements[0];
  if (!Node.isObjectLiteralExpression(first)) return undefined;
  const shape: Record<string, string> = {};
  first.getProperties().forEach(prop => {
    if (Node.isPropertyAssignment(prop)) {
      shape[prop.getName()] = prop.getInitializer()?.getKindName().replace('Literal', '').toLowerCase() || 'any';
    }
  });
  return shape;
}
