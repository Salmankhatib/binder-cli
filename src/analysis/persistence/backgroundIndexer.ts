import { Project } from 'ts-morph';
import { buildRepositoryImpactMap } from '../globalIndex.js';
import { logger } from '../../utils/logger.js';

/**
 * BackgroundIndexer allows the persistent project index to stay fresh 
 * without blocking the main surgical operations.
 */
export class BackgroundIndexer {
    private isRunning: boolean = false;
    private project: Project;

    constructor(project: Project) {
        this.project = project;
    }

    /**
     * Triggers a non-blocking index update.
     */
    public async triggerUpdate() {
        if (this.isRunning) return;

        this.isRunning = true;
        
        // Use setImmediate to defer execution to the next event loop cycle
        // ensuring we don't block the startup of critical CLI tasks.
        setImmediate(async () => {
            try {
                logger.debug('Background Indexer: Starting project-wide sync...');
                const startTime = Date.now();
                await buildRepositoryImpactMap(this.project);
                const duration = Date.now() - startTime;
                logger.debug(`Background Indexer: Sync complete in ${duration}ms.`);
            } catch (e: any) {
                logger.debug(`Background Indexer: Failed to update index: ${e.message}`);
            } finally {
                this.isRunning = false;
            }
        });
    }
}
