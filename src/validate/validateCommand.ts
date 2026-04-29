import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';
import type { Config } from '../config/types.js';

export interface PreFlightIssue {
    severity: 'error' | 'warning';
    message: string;
    detail?: string;
    mocks?: string[];
    hooks?: string[];
}

export interface PreFlightResult {
    canProceed: boolean;
    issues: PreFlightIssue[];
}

export async function preFlightCheck(config: Config): Promise<PreFlightResult> {
  const issues: PreFlightIssue[] = [];
  
  // 1. Schema parse check
  try {
    if (!config.backend.schemaPath) {
        issues.push({ severity: 'error', message: 'OpenAPI schema path is not configured' });
    } else if (!config.backend.schemaPath.startsWith('http') && !existsSync(config.backend.schemaPath)) {
        issues.push({ severity: 'error', message: 'OpenAPI schema file not found', detail: config.backend.schemaPath });
    } else if (!config.backend.schemaPath.startsWith('http')) {
        JSON.parse(readFileSync(config.backend.schemaPath, 'utf-8'));
    }
  } catch (e: any) {
    issues.push({ severity: 'error', message: 'Cannot parse OpenAPI schema', detail: e.message });
  }
  
  return {
    canProceed: !issues.some(i => i.severity === 'error'),
    issues
  };
}

export async function validateCommand(config: Config): Promise<number> {
    logger.startSpinner("Validating project state...");
    const check = await preFlightCheck(config);
    
    if (check.issues.length > 0) {
        check.issues.forEach(issue => {
            if (issue.severity === 'error') logger.error(`[Error] ${issue.message}: ${issue.detail || ''}`);
            else logger.warning(`[Warning] ${issue.message}`);
        });
    }

    if (!check.canProceed) {
        logger.stopSpinner(false, "Validation failed. Please fix errors before proceeding.");
        return 1;
    }

    logger.stopSpinner(true, "Validation complete. Project is ready for binding.");
    return 0;
}
