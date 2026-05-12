import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeBind } from '../src/orchestrator/safeBind.js';
import * as astRewriter from '../src/rewrite/astRewriter.js';
import * as typeCheck from '../src/test/typeCheck.js';
import { BinderMCP } from '../src/mcp/client.js';
import { ProjectManager } from '../src/engine/projectManager.js';
import * as fs from 'fs';

vi.mock('fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('original content'),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

vi.mock('../src/rewrite/astRewriter.js', () => ({ rewriteFile: vi.fn() }));
vi.mock('../src/test/typeCheck.js', () => ({ runTypeCheck: vi.fn() }));
vi.mock('../src/mcp/client.js', () => ({
  BinderMCP: class {
    async initialize() {}
    async repair() { return { success: true, newCode: 'code' }; }
    async autoFix(fp, code) { return code; }
  }
}));
vi.mock('../src/utils/logger.js'); 
vi.mock('../src/utils/cache.js', () => ({
    saveBinding: vi.fn(),
    recordPatternSuccess: vi.fn()
}));
vi.mock('../src/analysis/globalIndex.js', () => ({ buildRepositoryImpactMap: vi.fn().mockResolvedValue({}) }));
vi.mock('../src/analysis/mutationAnalyzer.js', () => ({ 
    MutationAnalyzer: class {
        analyzeProject = vi.fn().mockResolvedValue(new Map());
    }
}));
vi.mock('../src/analysis/hookIndexer.js', () => ({ 
  HookIndexer: class {
    indexProject = vi.fn().mockResolvedValue(new Map());
  }
}));
vi.mock('../src/analysis/usageFinder.js', () => ({ findAllUsages: vi.fn().mockReturnValue([]) }));
vi.mock('../src/analysis/propTracer.js', () => ({ tracePropDrilling: vi.fn().mockResolvedValue([]) }));
vi.mock('../src/engine/decisionEngine.js', () => ({ 
  DecisionEngine: class {
    decide = vi.fn().mockImplementation((mock) => Promise.resolve({ 
        type: 'auto', 
        confidence: 1, 
        binding: { mockName: mock.name, hookName: 'useGetItemsQuery', actionType: 'READ' } 
    }));
  }
}));
vi.mock('../src/human/sessionManager.js', () => ({
  SessionManager: class {
    resolveHumanDecision = vi.fn();
  }
}));
vi.mock('../src/engine/projectManager.js', () => {
  const mockSourceFile = {
    getImportDeclarations: () => [],
    getFullText: () => 'repaired code with todos',
    getDescendantAtPos: () => ({
      getStartLineNumber: () => 1,
      getParentWhile: () => ({
          replaceWithText: vi.fn(),
          getText: () => 'some code'
      })
    }),
    compilerNode: {
        getPositionOfLineAndCharacter: () => 0
    }
  };
  const mockProject = {
    createSourceFile: () => mockSourceFile,
    getSourceFiles: () => [],
    getCompilerOptions: () => ({})
  };
  return {
    ProjectManager: {
      getInstance: () => ({
        getProject: () => mockProject,
        getSourceFile: () => ({
          getImportDeclarations: () => [],
        }),
        getProjectGraph: () => ({ files: [], dependencies: {}, tsConfig: {} })
      })
    }
  };
});

describe('safeBind - Iterative Healing Loop', () => {
  const mockConfig = {
    protocol: 'rest',
    frontend: {
      generatedDir: './generated',
    },
    backend: {
      schemaPath: './schema.json'
    }
  };

  const mockMocks = [{ name: 'MOCK_DATA', line: 1, type: 'variable' }];
  const mockHookNames = ['useGetItemsQuery'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attempt healing up to 5 times and succeed on the 3rd', async () => {
    // 1. Setup mocks
    vi.mocked(astRewriter.rewriteFile).mockReturnValue('initial code');
    
    // Type check failures for first 2 tries, success on 3rd
    vi.mocked(typeCheck.runTypeCheck)
      .mockReturnValueOnce({ passed: false, errors: ['error1'] } as any) // Try 1 fails
      .mockReturnValueOnce({ passed: false, errors: ['error2'] } as any) // Try 2 fails
      .mockReturnValueOnce({ passed: true } as any);                   // Try 3 passes

    // MCP repair success
    const mockRepair = vi.fn().mockResolvedValue({ success: true, newCode: 'repaired code' });
    vi.spyOn(BinderMCP.prototype, 'repair').mockImplementation(mockRepair);

    // Run safeBind
    const result = await safeBind(mockMocks as any, 'test.tsx', mockConfig as any, mockHookNames);

    // 2. Assertions
    expect(typeCheck.runTypeCheck).toHaveBeenCalledTimes(3);
    expect(mockRepair).toHaveBeenCalledTimes(2);
    expect(result.rewrittenCode).toBe('repaired code'); 
  });

  it('should pass structured diagnostics to the repair tool', async () => {
    vi.mocked(astRewriter.rewriteFile).mockReturnValue('initial code');
    
    const mockDiagnostic = { message: 'Property x does not exist', code: 2339, line: 10, character: 5, file: 'test.tsx' };
    vi.mocked(typeCheck.runTypeCheck).mockReturnValueOnce({ 
        passed: false, 
        errors: [mockDiagnostic.message], 
        diagnostics: [mockDiagnostic] 
    } as any).mockReturnValueOnce({ passed: true } as any);

    const mockRepair = vi.fn().mockResolvedValue({ success: true, newCode: 'repaired code' });
    vi.spyOn(BinderMCP.prototype, 'repair').mockImplementation(mockRepair);

    await safeBind(mockMocks as any, 'test.tsx', mockConfig as any, mockHookNames);

    expect(mockRepair).toHaveBeenCalledWith(expect.objectContaining({
        diagnostics: [mockDiagnostic]
    }));
  });
});
