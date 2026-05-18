import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SurgicalQueue } from '../src/cli/watch.js';

vi.mock('../src/cli/drift.js', () => ({
    runDrift: vi.fn().mockResolvedValue(undefined)
}));

describe('SurgicalQueue', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should debounce rapid changes to the same file', async () => {
        const mockMcp = {} as any;
        const queue = new SurgicalQueue({}, mockMcp);
        const task = vi.fn().mockResolvedValue(undefined);

        queue.enqueue('test.ts', task);
        queue.enqueue('test.ts', task);
        queue.enqueue('test.ts', task);

        // Should not have run yet (debouncing)
        expect(task).not.toHaveBeenCalled();

        // Advance time for debounce (300ms)
        vi.advanceTimersByTime(350);

        // Now it should be added to the promise chain and run
        // We need to flush promises
        await Promise.resolve();
        await Promise.resolve();
        
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('should run tasks for different files sequentially', async () => {
        const mockMcp = {} as any;
        const queue = new SurgicalQueue({}, mockMcp);
        
        let callOrder: string[] = [];
        const task1 = vi.fn().mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 100));
            callOrder.push('task1');
        });
        const task2 = vi.fn().mockImplementation(async () => {
            callOrder.push('task2');
        });

        queue.enqueue('file1.ts', task1);
        queue.enqueue('file2.ts', task2);

        vi.advanceTimersByTime(350); // Fire debouncers
        
        // Advanced timer for task1's internal delay
        vi.advanceTimersByTime(150);

        await vi.runAllTimersAsync();

        expect(callOrder).toEqual(['task1', 'task2']);
    });

    it('should enter suspended mode on burst of changes', async () => {
        const mockMcp = {} as any;
        const queue = new SurgicalQueue({}, mockMcp);
        const task = vi.fn().mockResolvedValue(undefined);

        // Send 11 changes in a row (burst threshold is > 10 in 1s)
        for (let i = 0; i < 11; i++) {
            queue.enqueue(`file${i}.ts`, task);
        }

        // Advance time for burst check (1000ms)
        vi.advanceTimersByTime(1001);

        // It should have entered suspended mode. 
        // Subsequent calls should be ignored.
        queue.enqueue('another.ts', task);
        
        vi.advanceTimersByTime(350);
        await vi.runAllTimersAsync();

        // Some might have started before suspension was detected 
        // but many should be blocked.
        // Actually, the burst check fires after 1s.
        // The first 11 debouncers were set.
        // At 300ms they start firing.
        // At 1000ms suspension kicks in.
        
        expect(task.mock.calls.length).toBeLessThan(12);
    });
});
