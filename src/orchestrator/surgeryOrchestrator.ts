import { Project, SourceFile } from 'ts-morph';
import { BinderMCP } from '../mcp/client.js';
import { logger } from '../utils/logger.js';
import { runTypeCheck } from '../test/typeCheck.js';
import { RepoTools } from '../utils/repoTools.js';
import { ProjectManager } from '../engine/projectManager.js';
import type { Config } from '../config/types.js';

export interface SurgeryResult {
    success: boolean;
    finalCode: string;
    iterations: number;
}

export class SurgeryOrchestrator {
    private mcp: BinderMCP;
    private config: Config;
    private projectManager: ProjectManager;

    constructor(config: Config, mcp: BinderMCP) {
        this.config = config;
        this.mcp = mcp;
        this.projectManager = ProjectManager.getInstance();
    }

    /**
     * Executes a transactional AST surgery with iterative healing.
     */
    async operate(filePath: string, initialCode: string): Promise<SurgeryResult> {
        let currentCode = initialCode;
        const MAX_HEAL_TRIES = 5;
        const MAX_TEST_TRIES = 8;
        let success = false;
        let totalIterations = 0;

        // 1. Structural Healing Loop (Compiler)
        while (totalIterations < MAX_HEAL_TRIES && !success) {
            const check = runTypeCheck(filePath, currentCode, this.config.frontend.generatedDir, this.config.backend.trpcAppRouterPath);
            
            if (check.passed) {
                // 2. Functional Healing Loop (Tests)
                const repoTools = new RepoTools();
                const testFilePath = repoTools.findTestFile(filePath);
                
                if (testFilePath) {
                    logger.info(`  [Orchestrator] Running functional validation for ${filePath}...`);
                    let testTry = 0;
                    let testsPassed = false;

                    while (testTry < MAX_TEST_TRIES && !testsPassed) {
                        const testResult = await this.mcp.runTests(filePath, testFilePath);
                        if (testResult.success) {
                            testsPassed = true;
                            success = true;
                        } else {
                            testTry++;
                            logger.warn(`  [Orchestrator] Logic failure (Attempt ${testTry}). Repairing...`);
                            
                            const healed = await this.mcp.repair({
                                filePath,
                                code: currentCode,
                                mockName: 'unknown',
                                hookName: 'unknown',
                                errorType: 'FUNCTIONAL_FAILURE',
                                diagnostics: (testResult.failures || []).map((f: any) => ({
                                    message: f.message,
                                    code: 0,
                                    line: f.line || 0,
                                    character: 0,
                                    file: filePath
                                })),
                                projectGraph: this.projectManager.getProjectGraph()
                            });

                            if (healed.success && healed.newCode) {
                                currentCode = healed.newCode;
                            } else {
                                break;
                            }
                        }
                    }
                    if (!testsPassed) break; // Exit structural loop to trigger failure logic
                } else {
                    success = true;
                }
            } else {
                totalIterations++;
                logger.info(`  [Orchestrator] Type mismatch (Attempt ${totalIterations}). Requesting repair...`);
                
                const diagnostics = check.diagnostics || [];
                const healed = await this.mcp.repair({
                    filePath,
                    code: currentCode,
                    mockName: 'unknown',
                    hookName: 'unknown',
                    diagnostics,
                    projectGraph: this.projectManager.getProjectGraph()
                });
                
                if (healed.success && healed.newCode) {
                    currentCode = healed.newCode;
                } else {
                    break; 
                }
            }
        }

        if (success) {
            currentCode = await this.mcp.format(filePath, currentCode);
        }

        return {
            success,
            finalCode: currentCode,
            iterations: totalIterations
        };
    }
}
