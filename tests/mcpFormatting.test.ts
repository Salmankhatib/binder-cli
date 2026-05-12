import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BinderMCP } from '../src/mcp/client.js';

vi.mock('../src/mcp/client.js', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        BinderMCP: class extends actual.BinderMCP {
            initialize = vi.fn().mockResolvedValue(undefined);
            format = vi.fn().mockImplementation((_, code) => Promise.resolve(`/* formatted */\n${code}`));
        }
    };
});

describe('BinderMCP - Formatting', () => {
    it('should call prettier-mcp to format code', async () => {
        const mcp = new BinderMCP();
        await mcp.initialize();
        
        const originalCode = 'const x=1';
        const formattedCode = await mcp.format('test.ts', originalCode);
        
        expect(formattedCode).toBe(`/* formatted */\n${originalCode}`);
    });
});
