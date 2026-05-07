import { Project, SyntaxKind, ArrayLiteralExpression, Node, SourceFile } from 'ts-morph';
import { logger } from '../utils/logger.js';
import { RepoTools } from '../utils/repoTools.js';
import type { Config } from '../config/types.js';

export interface MockFinding {
  type: 'import_mock' | 'inline_array' | 'variable_mock' | 'jsx_prop_mock' | 'action_mock' | 'msw_handler' | 'mirage_handler' | 'factory_mock';
  name: string;
  source?: string;
  line: number;
  snippet: string;
  inferredShape?: Record<string, string>;
  resolvedContent?: string;
  actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
}

const MOCK_PATTERNS = /mock|mocks|fake|fixture|stub|dummy|sample|test|data/i;
const MOCK_PREFIX = /^(MOCK|FAKE|STUB|DUMMY|SAMPLE|TEST)_/i;
const DATA_SUFFIX = /_(DATA|LIST|ARRAY|ITEMS|SET)$/i;
const ACTION_PATTERNS = /handle(Add|Create|Delete|Remove|Update|Edit|Save)/i;
const MSW_PATTERNS = /(rest|http)\.(get|post|put|delete|patch)\(/;
const MIRAGE_PATTERNS = /this\.(get|post|put|delete|patch)\(/;

export function scanMocks(filePath: string, config?: Config): MockFinding[] {
  logger.startSpinner('Scanning target for mock signatures and actions...');
  
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4 }
  });
  
  const sourceFile = project.addSourceFileAtPath(filePath);
  const repo = new RepoTools();
  const findings: MockFinding[] = [];
  const mockVariables = new Set<string>();

  // Use custom detection rules from config if available
  const customPrefixes = config?.mockDetection?.variablePrefixes || [];
  const customSuffixes = config?.mockDetection?.variableSuffixes || [];
  
  const isMockName = (name: string) => {
      if (MOCK_PREFIX.test(name) || DATA_SUFFIX.test(name)) return true;
      if (MOCK_PATTERNS.test(name)) return true;
      if (customPrefixes.some(p => name.startsWith(p))) return true;
      if (customSuffixes.some(s => name.endsWith(s))) return true;
      return false;
  };

  // 1. Detect Imports (The Mock Tracer)
  sourceFile.getImportDeclarations().forEach(imp => {
    const specifier = imp.getModuleSpecifierValue();
    const customPatterns = config?.mockDetection?.importPatterns || [];
    
    imp.getNamedImports().forEach(n => {
      const name = n.getName();
      // If it's from a mock file, OR if the variable itself looks like a mock
      if (MOCK_PATTERNS.test(specifier) || isMockName(name) || customPatterns.some(p => specifier.includes(p))) {
        logger.system(`  [Tracer] Following mock import: ${name} from ${specifier}`);
        const resolved = repo.resolveMockData(filePath, name);
        
        findings.push({ 
            type: 'import_mock', 
            name, 
            source: specifier, 
            line: imp.getStartLineNumber(), 
            snippet: imp.getText().slice(0, 80),
            resolvedContent: resolved || undefined
        });
        mockVariables.add(name);
      }
    });
  });

  // 2. Detect Variables & Arrays (File-wide scan, not just top-level)
  sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(decl => {
    const nameNode = decl.getNameNode();
    let name = decl.getName();
    
    // Handle destructuring from useState: const [data, setData] = useState([...])
    if (Node.isArrayBindingPattern(nameNode)) {
        name = nameNode.getElements()[0]?.getText() || 'unknown';
    }

    if (mockVariables.has(name)) return;

    if (isMockName(name) || name === "data" || name === "items" || name.startsWith("data")) {
      const init = decl.getInitializer();
      
      // If it's initialized by a custom hook (already bound to API), skip it!
      if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText().startsWith('use') && init.getExpression().getText() !== 'useState') {
          return; // Skip already bound queries
      }
      
      // If it's useState, the actual array/object is inside the first argument
      let actualInit = init;
      if (init?.isKind(SyntaxKind.CallExpression) && init.getExpression().getText() === 'useState') {
          actualInit = init.getArguments()[0];
      }

      if (actualInit?.isKind(SyntaxKind.ArrayLiteralExpression)) {
        findings.push({ 
            type: 'inline_array', 
            name, 
            line: decl.getStartLineNumber(), 
            snippet: decl.getText().slice(0, 100), 
            inferredShape: inferShape(actualInit as ArrayLiteralExpression),
            resolvedContent: actualInit.getText()
        });
      } else if (actualInit?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        findings.push({ 
            type: 'variable_mock', 
            name, 
            line: decl.getStartLineNumber(), 
            snippet: decl.getText().slice(0, 100), 
            inferredShape: inferObjectShape(actualInit as any),
            resolvedContent: actualInit.getText()
        });
      } else {
        findings.push({ 
            type: 'variable_mock', 
            name, 
            line: decl.getStartLineNumber(), 
            snippet: decl.getText().slice(0, 80),
            resolvedContent: actualInit?.getText()
        });
      }
      mockVariables.add(name);
    }
  });

  // 3. Detect Actions (Event Handlers)
  const factoryNames = config?.mockDetection?.factoryFunctions || [];

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
    
    // 4. Detect MSW/Mirage Handlers & Factories
    if (Node.isCallExpression(node)) {
      const text = node.getText();
      const exprText = node.getExpression().getText();

      // Factories
      if (factoryNames.includes(exprText)) {
          findings.push({
              type: 'factory_mock',
              name: exprText,
              line: node.getStartLineNumber(),
              snippet: text.slice(0, 100)
          });
      }

      else if (MSW_PATTERNS.test(text)) {
        findings.push({
          type: 'msw_handler',
          name: 'MSW Handler',
          line: node.getStartLineNumber(),
          snippet: text.slice(0, 100)
        });
      } else if (MIRAGE_PATTERNS.test(text)) {
        findings.push({
          type: 'mirage_handler',
          name: 'Mirage Handler',
          line: node.getStartLineNumber(),
          snippet: text.slice(0, 100)
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
  return inferObjectShape(first);
}

function inferObjectShape(objLit: any): Record<string, string> {
  const shape: Record<string, string> = {};
  if (!Node.isObjectLiteralExpression(objLit)) return shape;
  
  objLit.getProperties().forEach(prop => {
    if (Node.isPropertyAssignment(prop)) {
      shape[prop.getName()] = prop.getInitializer()?.getKindName().replace('Literal', '').toLowerCase() || 'any';
    }
  });
  return shape;
}

function findReactQueryMocks(sourceFile: any): MockFinding[] {
    const findings: MockFinding[] = [];
    
    // Find useQuery calls
    const queryCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => call.getText().includes('useQuery'));
    
    for (const call of queryCalls) {
      // Check if it's using mock data
      const text = call.getText();
      if (text.includes('mock') || text.includes('fake')) {
        // Extract queryKey and queryFn
        const args = call.getArguments();
        const queryKey = args[0]?.getText();
        const queryFn = args[1]?.getText();
        
        findings.push({
          type: 'react_query_mock', // New type
          name: 'useQuery',
          line: call.getStartLineNumber(),
          snippet: text.slice(0, 150),
          inferredShape: this.inferQueryShape(queryFn),
          resolvedContent: queryFn,
          // Extra metadata for TanStack conversion
          queryKey,
          hasMockData: true
        });
      }
    }
    
    return findings;
  }
