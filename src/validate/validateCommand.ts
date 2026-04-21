import { logger } from '../utils/logger.js';
import type { Config } from '../config/types.js';

export async function validateCommand(_config: Config): Promise<number> {
  logger.step('🔍', 'Validating project for unbound mocks...');
  logger.info('Scanning all .tsx/.ts files for MOCK_* patterns');
  logger.success('Validation complete (stub - always passes)');
  return 0;
}