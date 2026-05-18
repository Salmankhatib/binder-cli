import chokidar from 'chokidar';
import { resolve } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { runDrift } from './drift.js';
import { loadConfig } from '../config/loader.js';
import { BinderMCP } from '../mcp/client.js';
import { ProjectManager } from '../engine/projectManager.js';
import { MigrationOrchestrator } from '../orchestrator/migrationOrchestrator.js';
import { SurgeryOrchestrator } from '../orchestrator/surgeryOrchestrator.js';
import { BackgroundIndexer } from '../analysis/persistence/backgroundIndexer.js';

/**
 * Manages the sequential execution of surgeries and debouncing.
 */
export class SurgicalQueue {
    private queue: Promise<void> = Promise.resolve();
    private debouncers: Map<string, NodeJS.Timeout> = new Map();
    private isSuspended: boolean = false;
    private burstCounter: number = 0;
    private burstTimer: NodeJS.Timeout | null = null;
    private stabilityTimer: NodeJS.Timeout | null = null;

    constructor(private config: any, private mcp: BinderMCP) {}

    public enqueue(path: string, task: () => Promise<void>) {
        if (this.isSuspended) {
            this.resetStabilityTimer();
            return;
        }

        // 1. Burst Detection (Detect git pull/checkout)
        this.burstCounter++;
        if (!this.burstTimer) {
            this.burstTimer = setTimeout(() => {
                if (this.burstCounter > 10) {
                    this.enterSuspendedMode();
                }
                this.burstCounter = 0;
                this.burstTimer = null;
            }, 1000);
        }

        // 2. Debouncing per file
        if (this.debouncers.has(path)) {
            clearTimeout(this.debouncers.get(path)!);
        }

        const timeout = setTimeout(() => {
            this.debouncers.delete(path);
            this.queue = this.queue.then(async () => {
                if (this.isSuspended) return;
                try {
                    await task();
                } catch (e: any) {
                    logger.error(`Queue task failed: ${e.message}`);
                }
            });
        }, 300);

        this.debouncers.set(path, timeout);
    }

    private enterSuspendedMode() {
        this.isSuspended = true;
        logger.warning("🚀 Mass change detected (Git pull/checkout?). Suspending autonomous patches...");
        this.resetStabilityTimer();
    }

    private resetStabilityTimer() {
        if (this.stabilityTimer) clearTimeout(this.stabilityTimer);
        this.stabilityTimer = setTimeout(async () => {
            this.isSuspended = false;
            logger.success("✨ Repository stabilized. Resuming watch sentinel.");
            await runDrift(); // One-time full re-validation
            this.stabilityTimer = null;
        }, 2000);
    }
}

/**
 * binder watch provides real-time feedback for local developers.
 * It watches the schema and source files for changes.
 */
export async function runWatch() {
  const config = await loadConfig('./binder.config.json');
  const schemaPath = resolve(process.cwd(), config.backend.schemaPath || 'openapi.json');
  const srcPath = resolve(process.cwd(), 'src');
  const dtoPaths = (config.backend.dtoPaths || []).map(p => resolve(process.cwd(), p));

  console.clear();
  console.log(pc.bold(pc.cyan('👁️  BINDER WATCH SENTINEL ACTIVE')));
  console.log(pc.gray(`Watching schema: ${schemaPath}`));
  console.log(pc.gray(`Watching source: ${srcPath}`));
  if (dtoPaths.length > 0) {
    console.log(pc.gray(`Watching Backend DTOs: ${dtoPaths.length} paths registered.`));
  }
  console.log(pc.gray('----------------------------------------\n'));

  const watcher = chokidar.watch([schemaPath, srcPath, ...dtoPaths], {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });

  const mcp = new BinderMCP();
  await mcp.initialize(config);

  const surgicalQueue = new SurgicalQueue(config, mcp);
  const backgroundIndexer = new BackgroundIndexer(ProjectManager.getInstance().getProject());
  
  // Initial sync
  backgroundIndexer.triggerUpdate();

  watcher.on('change', async (path) => {
    const absPath = resolve(path);
    
    // Refresh background index on every change
    backgroundIndexer.triggerUpdate();

    surgicalQueue.enqueue(absPath, async () => {
        console.log(pc.yellow(`\n🔔 Processing change: ${pc.bold(path)}`));
        
        // 1. Check if it's a backend DTO change (LCP Flow)
        if (dtoPaths.some(dp => absPath.startsWith(dp) || absPath === dp)) {
            logger.info('Initiating Local Contract Protocol (LCP) sync...');
            const deltas = await mcp.getDelta(absPath);
            
            if (deltas.length > 0) {
                const projectManager = ProjectManager.getInstance();
                const migrationOrch = new MigrationOrchestrator(projectManager.getProject());
                const surgeryOrch = new SurgeryOrchestrator(config, mcp);
                
                for (const delta of deltas) {
                    if (delta.type === 'RENAME') {
                        await migrationOrch.applyRename({
                            hookName: delta.affectedHook,
                            oldFieldName: delta.oldName,
                            newFieldName: delta.newName,
                            confidence: 1.0,
                            reason: 'LCP Real-time Sync'
                        });
                    }
                }
                
                // Post-migration safety check & formatting via Surgical Orchestrator
                const changedFiles = projectManager.getProject().getSourceFiles().filter(sf => sf.getUnsavedChanges() !== undefined);
                for (const sf of changedFiles) {
                    const result = await surgeryOrch.operate(sf.getFilePath(), sf.getFullText());
                    if (result.success) {
                        sf.replaceWithText(result.finalCode);
                    } else {
                        logger.error(`  [LCP] Failed to heal ${pc.bold(sf.getFilePath())}. Reverting to original state.`);
                        sf.refreshFromFileSystemSync();
                    }
                }

                await projectManager.getProject().save();
                logger.success(`LCP Sync: Applied ${deltas.length} structural changes to frontend.`);
            } else {
                logger.debug('LCP: No structural changes detected in DTO.');
            }
            return;
        }

        if (path.endsWith('.json')) {
          logger.info('Schema updated! Re-validating contracts...');
          await runDrift();
        } else {
          logger.info('Source updated! Checking for drift...');
          await runDrift();
        }
        
        console.log(pc.gray('\nWaiting for changes...'));
    });
  });

  watcher.on('error', error => logger.error(`Watcher error: ${error}`));
}
