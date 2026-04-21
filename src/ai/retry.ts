import { logger } from '../utils/logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const isRetryable = 
        lastError.message.includes('503') ||
        lastError.message.includes('429') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('ECONNRESET');
      
      if (!isRetryable || i === maxRetries - 1) {
        throw lastError;
      }
      
      const wait = delayMs * Math.pow(2, i); // Exponential backoff: 2s, 4s, 8s
      logger.warning(`LLM call failed (attempt ${i + 1}/${maxRetries}), retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}