import "dotenv/config";
import { Command } from "commander";
import pc from "picocolors";
import pkg from "enquirer";
const { Select, Toggle } = pkg;
import { execSync } from "child_process";
import { resolve, join } from "path";
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync } from "fs";
import { loadConfig } from "./config/loader.js";
import { logger } from "./utils/logger.js";
import { logo, divider } from "./utils/ascii.js";
import { runOrval } from "./generate/orvalRunner.js";
import { scanMocks } from "./scan/mockScanner.js";
import { rewriteFile } from "./rewrite/astRewriter.js";
import { validateCommand } from "./validate/validateCommand.js";
import { discoveryPhase } from "./discover/scout.js";
import type { Config } from "./config/types.js";

const program = new Command();

/**
 * Cinematic reveal for TUI feel
 */
const revealLogo = async () => {
  const lines = logo.split('\n');
  for (const line of lines) {
    console.log(pc.cyan(line));
    await new Promise(r => setTimeout(r, 30));
  }
  console.log(pc.gray(divider));
};

program
  .name("binder")
  .description("Bind frontend mocks to backend APIs automatically")
  .version("0.1.0")
  .option("-c, --config <path>", "Path to binder config", "./binder.config.json")
  .option("-v, --verbose", "Enable verbose logging", false)
  .option("--dry-run", "Preview changes without writing files", false);

program
  .command("init")
  .description("Initialize a new Binder project with a TUI")
  .action(async () => {
    logger.startSpinner("📡 Handshaking with environment...");
    const projectMap = await discoveryPhase({ backend: { schemaPath: "", url: "" }, frontend: { generatedDir: "" } } as any);
    logger.stopSpinner(true, "Protocol sequence established.");
    
    await revealLogo();
    console.log(pc.bold("\n🚀 WELCOME TO BINDER INITIALIZATION\n"));
    
    // 1. Dependency Check
    const deps = projectMap.mainDependencies;
    if (!deps.includes("@tanstack/react-query") || !deps.includes("axios")) {
        const shouldInstall = await new Select({
            message: `Recommended dependencies ${pc.yellow("@tanstack/react-query, axios")} are missing. Install?`,
            choices: ['Yes (Install Now)', 'No (I will do it manually)']
        }).run();
        
        if (shouldInstall.startsWith('Yes')) {
            logger.startSpinner(`Installing dependencies...`);
            try {
                execSync(`npm install @tanstack/react-query axios`, { stdio: 'ignore' });
                logger.stopSpinner(true, `Dependencies installed.`);
            } catch (e) {
                logger.stopSpinner(false, `Failed to install dependencies.`);
            }
        }
    }

    // 2. Schema Discovery
    let schemaPath = projectMap.tree.find(f => f.includes("openapi.json") || f.includes("swagger.json")) || "./openapi.json";
    const schemaConfirm = await new Toggle({
        message: `Detected schema at ${pc.cyan(schemaPath)}. Use this?`,
        initial: true
    }).run();
    
    if (!schemaConfirm) {
        schemaPath = await pkg.prompt({
            type: 'input',
            name: 'path',
            message: 'Enter path to your OpenAPI schema (local or URL):'
        }).then((r: any) => r.path);
    }

    // 3. UI Template Discovery
    const hasSkeleton = projectMap.tree.some(f => f.toLowerCase().includes("skeleton"));
    let loadingTemplate = hasSkeleton ? "<Skeleton />" : "<div>Loading...</div>";
    
    const uiConfirm = await new Toggle({
        message: `Suggested loading template: ${pc.yellow(loadingTemplate)}. Use this?`,
        initial: true
    }).run();

    if (!uiConfirm) {
        loadingTemplate = await pkg.prompt({
            type: 'input',
            name: 'val',
            message: 'Enter custom loading JSX (e.g. <MySpinner />):'
        }).then((r: any) => r.val);
    }

    const configPath = resolve(process.cwd(), "binder.config.json");
    const defaultConfig = {
        backend: { 
            schemaPath: schemaPath, 
            url: "http://localhost:8000" 
        },
        frontend: { 
            generatedDir: "./src/generated",
            loadingTemplate: loadingTemplate,
            errorTemplate: "<div>Error loading data</div>"
        },
        orval: { client: "react-query" }
    };
    
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    logger.success("\n✨ binder.config.json created successfully.");

    console.log(pc.gray(divider));
    logger.success("✔ BINDER INITIALIZED SUCCESSFULLY!");
    logger.info("\n💡 NEXT STEPS:");
    console.log(pc.white("  1. Run ") + pc.green("binder bind <file>") + pc.white(" to start migrating mocks.\n"));
  });

program
  .command("tutorial")
  .description("Guide on how to use Binder")
  .action(async () => {
    await revealLogo();
    logger.box("BINDER WORKFLOW GUIDE", [
      "1. INIT:   Run 'binder init' to auto-detect your project structure.",
      "2. CONFIG: Check binder.config.json. We've auto-detected your schema and UI components.",
      "3. BIND:   Run 'binder bind <file>' to swap mocks. Use --batch for directories.",
      "4. REVIEW: For complex cases, Binder leaves TODOs. Follow the instructions in the comments.",
      "5. CACHE:  Binder remembers your choices! The more you use it, the more it auto-binds."
    ]);
    console.log(pc.bold("\n💡 PRO TIPS:"));
    console.log(pc.cyan("  --safe-only: ") + pc.white("Only auto-converts 100% safe patterns (Default)."));
    console.log(pc.cyan("  --ignore:    ") + pc.white("Skip specific mocks if they are too complex."));
  });

program
  .command("bind <path>")
  .description("Bind file(s) to API")
  .option("--batch", "Batch mode", false)
  .option("-i, --interactive", "Review and confirm each binding", false)
  .option("--safe-only", "Only auto-convert safe patterns", true)
  .option("--with-integration", "E2E mode", false)
  .option("--ignore <variables>", "Comma-separated list of mock variables to ignore")
  .option("--only <variables>", "Comma-separated list of mock variables to exclusively target")
  .action(async (targetPath, options) => {
    console.log(pc.cyan(logo));
    console.log(pc.gray(divider));
    
    const startTime = Date.now();
    const config = await loadConfig(program.opts().config);
    
    // PHASE 1: THE SCOUT (Discovery)
    const projectMap = await discoveryPhase(config);
    const absTarget = resolve(targetPath);
    
    logger.startSpinner("Preparing API Infrastructure...");
    const schemaPath = config.backend.schemaPath;

    if (!schemaPath || (!schemaPath.startsWith('http') && !existsSync(schemaPath))) {
        logger.stopSpinner(false, "Schema file not found.");
        logger.error(`Ensure your openapi.json exists at: ${schemaPath}`);
        throw new Error("Missing OpenAPI schema.");
    }
    
    await runOrval(schemaPath, config.frontend.generatedDir, config.orval);
    logger.stopSpinner(true, "API Infrastructure Ready");

    const files = (options.batch && statSync(absTarget).isDirectory()) 
      ? readdirSync(absTarget).filter(f => f.endsWith(".tsx")).map(f => join(absTarget, f))
      : [absTarget];

    const { safeBind } = await import("./orchestrator/safeBind.js");
    const { manualReviewMode } = await import("./cli/reviewMode.js");

    for (const file of files) {
      logger.system(`\n>>> Analyzing: ${pc.bold(file)}`);
      let mocks = scanMocks(file);
      
      if (options.ignore) {
        const toIgnore = options.ignore.split(',').map((s: string) => s.trim());
        mocks = mocks.filter(m => !toIgnore.includes(m.name));
      }
      if (options.only) {
        const toOnly = options.only.split(',').map((s: string) => s.trim());
        mocks = mocks.filter(m => toOnly.includes(m.name));
      }

      if (mocks.length === 0) {
        logger.warning("No mocks detected in this file. Skipping.");
        continue;
      }
      
      const apiPath = join(config.frontend.generatedDir, "api.ts");
      if (!existsSync(apiPath)) {
          logger.error(`API hooks not found at ${apiPath}. Did you run "binder bind" once already?`);
          continue;
      }

      const apiContent = readFileSync(apiPath, "utf-8");
      const hookNames = [...apiContent.matchAll(/export (?:function|const) (use\w+)/g)].map(m => m[1]);
      
      // RUN BINDING ENGINE
      const bindResults = await safeBind(mocks, file, config, hookNames);

      if (bindResults.auto > 0) {
          logger.success(`✔ Successfully auto-bound ${bindResults.auto} mocks.`);
      }

      if (bindResults.todos.length > 0) {
        const manualResults = await manualReviewMode(bindResults.todos);
        
        for (const res of manualResults) {
          if (res.willAutoConvert) {
            const { rewriteFile } = await import("./rewrite/astRewriter.js");
            const plan = {
              bindings: [{
                mockName: res.mock.name,
                hookName: res.hook,
                confidence: 0.5,
                actionType: 'READ'
              }]
            };
            const rewritten = rewriteFile(file, plan as any, config.frontend.generatedDir);
            writeFileSync(file, rewritten);
            logger.success(`✓ Manual Override applied for ${res.mock.name}.`);
          }
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success(`\n✨ Binding complete in ${duration}s`);
  });

      logger.success(`Bound: ${file}`);
    }
    logger.system(`\nProtocol terminated in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  });

program.parse();
