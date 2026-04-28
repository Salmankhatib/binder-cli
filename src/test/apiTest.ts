import type { TestResult } from '../common/types.js';
import { logger } from '../utils/logger.js';

export async function runApiTest(endpoint: string, mockDataSample: any): Promise<TestResult> {
  const errors: string[] = [];
  logger.system(`  [E2E] Fetching real data from ${endpoint}...`);
  
  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      errors.push(`Backend unreachable: ${res.status} ${res.statusText}`);
      return { layer: "api-test", passed: false, errors };
    }

    const realData = await res.json();
    
    // Compare structural keys between Mock and Real API
    const realSample = Array.isArray(realData) ? realData[0] : (realData.data ? realData.data[0] : realData);
    const mockSample = Array.isArray(mockDataSample) ? mockDataSample[0] : mockDataSample;

    if (realSample && mockSample) {
      const realKeys = Object.keys(realSample);
      const mockKeys = Object.keys(mockSample);
      const missingKeys = mockKeys.filter(k => !realKeys.includes(k));

      if (missingKeys.length > 0) {
        errors.push(`Data Mismatch: Real API is missing keys expected by UI: ${missingKeys.join(', ')}`);
      }
    }
  } catch (err) {
    errors.push(`Runtime Connectivity Error: ${(err as Error).message}`);
  }

  return {
    layer: "api-test",
    passed: errors.length === 0,
    errors
  };
}
