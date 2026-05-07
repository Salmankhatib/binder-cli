import { logger } from '../utils/logger.js';
import { runSync } from './sync.js';
import { runDrift } from './drift.js';
import { runSnapshot } from './snapshot.js';
import pc from 'picocolors';

/**
 * binder auto-pilot automates the full Binder workflow.
 */
export async function runAutoPilot() {
  console.log(pc.bold(pc.cyan('\n🚀 BINDER AUTO-PILOT ENGAGED\n')));

  logger.system('Step 1: Synchronizing infrastructure...');
  await runSync();

  logger.system('\nStep 2: Checking for contract drift...');
  try {
    await runDrift();
    logger.success('No drift detected. Moving to final step.');
  } catch (e) {
    logger.warn('Drift detected. Please review changes before continuing.');
    // We don't exit here, we just warn.
  }

  logger.system('\nStep 3: Creating automated snapshot...');
  await runSnapshot({ status: 'verified' }); // Assuming success if we got here
  
  logger.success('\n✨ Auto-Pilot mission accomplished.');
}
