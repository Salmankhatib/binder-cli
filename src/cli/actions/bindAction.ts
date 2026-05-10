import pc from "picocolors";
import pkg from "enquirer";
const { Toggle } = pkg;
import { resolve, join } from "path";
import { readFileSync, writeFileSync, statSync, readdirSync } from "fs";
import { logger } from "../../utils/logger.js";
import { loadConfig } from "../../config/loader.js";
import { discoveryPhase } from "../../discover/scout.js";
import { runOrval } from "../../generate/orvalRunner.js";
import { scanMocks } from "../../scan/mockScanner.js";
import { createBackup } from "../../cli/undo.js";
import { flushCache } from "../../utils/cache.js";

export async function bindAction(targetPath: string, options: any, configPath: string, logo: string, divider: string) {
    console.log(pc.cyan(logo));
    console.log(pc.gray(divider));
    
    const startTime = Date.now();
    const config = await loadConfig(configPath);
    
    // Discovery
    const projectMap = await discoveryPhase(config);
    const absTarget = resolve(targetPath);
    
    logger.startSpinner("Preparing API Infrastructure...");
    await runOrval(config.backend.schemaPath, config.frontend.generatedDir, config.orval);
    logger.stopSpinner(true, "API Infrastructure Ready");

    const files = (options.batch && statSync(absTarget).isDirectory()) 
      ? readdirSync(absTarget).filter(f => f.endsWith(".tsx")).map(f => join(absTarget, f))
      : [absTarget];

    const { safeBind } = await import("../../orchestrator/safeBind.js");
    const { propagateMatches } = await import("../../orchestrator/propagator.js");

    const sessionSuccesses: Array<{ mockName: string, hookName: string }> = [];

    for (const file of files) {
      logger.system(`\n>>> Analyzing: ${pc.bold(file)}`);
      let mocks = scanMocks(file, config);
      
      if (options.ignore) mocks = mocks.filter(m => !options.ignore.split(',').includes(m.name));
      if (options.only) mocks = mocks.filter(m => options.only.split(',').includes(m.name));

      if (mocks.length === 0) continue;
      
      const apiPath = join(config.frontend.generatedDir, "api.ts");
      const apiContent = readFileSync(apiPath, "utf-8");
      const hookNames = [...apiContent.matchAll(/export (?:function|const) (use\w+)/g)].map(m => m[1]);
      
      const bindResults = await safeBind(mocks, file, config, hookNames, options);

      if (bindResults.rewrittenCode) {
          if (options.dryRun) {
              console.log(pc.gray(`\n--- DRY RUN: ${file} ---\n`) + bindResults.rewrittenCode);
          } else {
              createBackup(file);
              writeFileSync(file, bindResults.rewrittenCode);
              logger.success(`✔ Applied changes to ${file} (${bindResults.auto} auto, ${bindResults.human} human, ${bindResults.todo} TODOs).`);
              
              // Track for propagation
              sessionSuccesses.push(...bindResults.successes);
          }
      }

      if (bindResults.todos.length > 0) {
        for (const res of bindResults.todos) {
            logger.info(`  [TODO] ${res.mock.name}: ${res.reason}`);
        }
      }
    }

    // POST-SESSION PROPAGATION
    if (!options.dryRun && sessionSuccesses.length > 0) {
        const absoluteProcessedFiles = files.map(f => resolve(f));
        const remainingFiles = projectMap.tree
            .map(f => resolve(process.cwd(), f))
            .filter(f => f.endsWith('.tsx') && !absoluteProcessedFiles.includes(f));
        
        let shouldPropagate = options.repo;
        if (!shouldPropagate && remainingFiles.length > 0) {
            const confirm = await new Toggle({
                message: `Binder found ${sessionSuccesses.length} successful matches. Scan the rest of the project for these exact mocks?`,
                initial: true
            }).run();
            shouldPropagate = confirm;
        }

        if (shouldPropagate && remainingFiles.length > 0) {
            await propagateMatches(sessionSuccesses, config, remainingFiles);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    flushCache();
    logger.success(`\n✨ Binding complete in ${duration}s`);
}
