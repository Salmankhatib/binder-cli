import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createBindingPlan } from '../../src/match/bindingEngine.ts';
import { scanMocks } from '../../src/scan/mockScanner.ts';
import { rewriteFile } from '../../src/rewrite/astRewriter.ts';
import { discoveryPhase } from '../../src/discover/scout.ts';

// Mock Orval as it seems broken in the test environment
vi.mock('../../src/generate/orvalRunner.ts', () => ({
  runOrval: vi.fn(async () => {
    return { types: '', api: '', hooks: '' };
  })
}));

// Mock the LLM to return deterministic results for tests
vi.mock('../../src/ai/llmClient.ts', () => ({
  callLLM: vi.fn(async (prompt: string) => {
    if (prompt.includes('TodoList.tsx')) {
      return `FINAL_PLAN: {
        "bindings": [
          {
            "mockName": "MOCK_TODOS",
            "hookName": "useGetTodosQuery",
            "confidence": 0.9,
            "transformer": null,
            "loadingStrategy": "early-return-skeleton",
            "errorStrategy": "early-return-error"
          }
        ],
        "importsToRemove": [],
        "importsToAdd": []
      }`;
    }
    if (prompt.includes('UserProfile.tsx')) {
       return `FINAL_PLAN: {
        "bindings": [
          {
            "mockName": "MOCK_USERS",
            "hookName": "useGetUsersQuery",
            "confidence": 0.9,
            "transformer": null,
            "loadingStrategy": "early-return-skeleton",
            "errorStrategy": "early-return-error"
          }
        ],
        "importsToRemove": [],
        "importsToAdd": []
      }`;
    }
    return 'FINAL_PLAN: { "bindings": [], "importsToRemove": [], "importsToAdd": [] }';
  })
}));

async function runBinding(options: { schemaPath: string; sourceDir: string; outputDir: string; dryRun: boolean }) {
  const config = {
    backend: { schemaPath: options.schemaPath, url: 'http://localhost:8000' },
    frontend: { generatedDir: options.outputDir },
    llm: { provider: 'openai', model: 'gpt-4o' },
    orval: { client: 'react-query' }
  };

  // 1. Generate API Stub
  const apiPath = join(config.frontend.generatedDir, 'api.ts');
  if (!existsSync(config.frontend.generatedDir)) cpSync(join(process.cwd(), 'tests/fixtures/react-query-app/src'), config.frontend.generatedDir, { recursive: true });
  writeFileSync(apiPath, 'export function useGetTodosQuery() { return { data: [] } }; export function useGetUsersQuery() { return { data: [] } };');

  // 2. Scout
  const projectMap = await discoveryPhase(config as any);

  // 3. Bind
  const files = [
    join(options.sourceDir, 'components/TodoList.tsx'),
    join(options.sourceDir, 'components/UserProfile.tsx')
  ].filter(f => existsSync(f));

  let totalBindings = 0;
  for (const file of files) {
    const mocks = scanMocks(file);
    if (mocks.length === 0) continue;

    const apiContent = readFileSync(apiPath, "utf-8");
    
    const plan = await createBindingPlan(
      mocks,
      [],
      file,
      config as any,
      apiContent,
      projectMap
    );

    const rewritten = rewriteFile(file, plan, config.frontend.generatedDir);
    if (!options.dryRun) {
      writeFileSync(file, rewritten);
    }
    totalBindings += plan.bindings.length;
  }

  return { bindingsApplied: totalBindings };
}

describe('Binder Integration Tests', () => {
  const tempDir = join(process.cwd(), 'tests/temp/test-run');
  const fixtureDir = join(process.cwd(), 'tests/fixtures/react-query-app');
  
  beforeEach(() => {
    // Copy the fixture to a temp location (so each test gets a fresh copy)
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
    cpSync(fixtureDir, tempDir, { recursive: true });
  });
  
  afterEach(() => {
    // Clean up after test
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  });
  
  it('finds and binds mock todos', async () => {
    const result = await runBinding({
      schemaPath: join(tempDir, 'openapi.json'),
      sourceDir: join(tempDir, 'src'),
      outputDir: join(tempDir, 'src/generated'),
      dryRun: false
    });
    
    // Should find at least one mock
    expect(result.bindingsApplied).toBeGreaterThan(0);
    
    // Check that TodoList.tsx was changed
    const todoListPath = join(tempDir, 'src/components/TodoList.tsx');
    const content = readFileSync(todoListPath, 'utf-8');
    
    // Should NOT have mock data anymore
    expect(content).not.toContain('MOCK_TODOS');
    
    // Should HAVE the generated hook
    expect(content).toContain('useGetTodosQuery');
  });
  
  it('handles imported mocks correctly', async () => {
    await runBinding({
      schemaPath: join(tempDir, 'openapi.json'),
      sourceDir: join(tempDir, 'src'),
      outputDir: join(tempDir, 'src/generated'),
      dryRun: false
    });
    
    const userProfilePath = join(tempDir, 'src/components/UserProfile.tsx');
    const content = readFileSync(userProfilePath, 'utf-8');
    
    // Should replace the imported mock
    expect(content).not.toContain('MOCK_USERS');
    expect(content).toContain('useGetUsersQuery');
  });
});
