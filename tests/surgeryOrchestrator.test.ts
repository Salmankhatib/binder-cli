import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SurgeryOrchestrator } from '../src/orchestrator/surgeryOrchestrator.js';
import * as typeCheck from '../src/test/typeCheck.js';
import { BinderMCP } from '../src/mcp/client.js';
import { ProjectManager } from '../src/engine/projectManager.js';

vi.mock('../src/test/typeCheck.js', () => ({ runTypeCheck: vi.fn() }));
vi.mock('../src/mcp/client.js', () => ({
  BinderMCP: class {
    async initialize() {}
    async repair() { return { success: true, newCode: 'repaired code' }; }
    async format(fp, code) { return `/* formatted */\n${code}`; }
    async runTests() { return { success: true }; }
  }
}));
vi.mock('../src/utils/logger.js'); 
vi.mock('../src/engine/projectManager.js', () => ({
  ProjectManager: {
    getInstance: () => ({
      getProjectGraph: () => ({ files: [], dependencies: {}, tsConfig: {} })
    })
  }
}));

describe('SurgeryOrchestrator', () => {
    const mockConfig = {
        frontend: { generatedDir: './gen' },
        backend: { trpcAppRouterPath: './router' }
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should operate successfully on valid code', async () => {
        vi.mocked(typeCheck.runTypeCheck).mockReturnValue({ passed: true } as any);
        const mcp = new BinderMCP();
        const orch = new SurgeryOrchestrator(mockConfig, mcp);

        const result = await orch.operate('test.ts', 'const x = 1;');

        expect(result.success).toBe(true);
        expect(result.finalCode).toContain('/* formatted */');
        expect(typeCheck.runTypeCheck).toHaveBeenCalledTimes(1);
    });

    it('should attempt healing on type errors', async () => {
        vi.mocked(typeCheck.runTypeCheck)
            .mockReturnValueOnce({ passed: false, diagnostics: [] } as any)
            .mockReturnValueOnce({ passed: true } as any);
        
        const mcp = new BinderMCP();
        const repairSpy = vi.spyOn(mcp, 'repair');
        const orch = new SurgeryOrchestrator(mockConfig, mcp);

        const result = await orch.operate('test.ts', 'const x: string = 1;');

        expect(result.success).toBe(true);
        expect(repairSpy).toHaveBeenCalledTimes(1);
        expect(typeCheck.runTypeCheck).toHaveBeenCalledTimes(2);
    });
});
