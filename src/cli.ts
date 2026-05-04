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
import { createBackup, undoLast, listHistory } from "./cli/undo.js";
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
  .description("Initialize a new Binder project with an interactive setup")
  .action(async () => {
    await revealLogo();
    console.log(pc.bold(pc.cyan("\n🚀 BINDER INITIALIZATION SEQUENCE STARTING...\n")));
    
    logger.startSpinner("📡 Analyzing project DNA...");
    const projectMap = await discoveryPhase({ backend: { schemaPath: "", url: "" }, frontend: { generatedDir: "" } } as any);
    logger.stopSpinner(true, "Project DNA decrypted.");
    
    // 1. Dependency Management
    const deps = projectMap.mainDependencies;
    const required = ["@tanstack/react-query", "axios"];
    const missing = required.filter(d => !deps.includes(d));

    if (missing.length > 0) {
        console.log(pc.yellow(`\n📦 Missing infrastructure: ${missing.join(", ")}`));
        const shouldInstall = await new Select({
            message: `Would you like Binder to install these for you?`,
            choices: ['Yes, install now (npm)', 'No, I will handle it']
        }).run();
        
        if (shouldInstall.startsWith('Yes')) {
            logger.startSpinner(`Installing ${missing.join(", ")}...`);
            try {
                execSync(`npm install ${missing.join(" ")}`, { stdio: 'ignore' });
                logger.stopSpinner(true, `Dependencies integrated.`);
            } catch (e) {
                logger.stopSpinner(false, `Automatic installation failed. Please run 'npm install ${missing.join(" ")}' manually.`);
            }
        }
    }

    // 2. Schema Discovery
    let schemaPath = projectMap.tree.find(f => f.includes("openapi.json") || f.includes("swagger.json")) || "./openapi.json";
    console.log(pc.cyan(`\n🔍 Schema Discovery:`));
    const schemaConfirm = await new Toggle({
        message: `Found schema at ${pc.bold(schemaPath)}. Use it?`,
        initial: true
    }).run();
    
    if (!schemaConfirm) {
        schemaPath = await pkg.prompt({
            type: 'input',
            name: 'path',
            message: 'Enter path to your OpenAPI schema (Local path or URL):'
        }).then((r: any) => r.path);
    }

    // 3. UI Template Intelligence
    const hasSkeleton = projectMap.tree.some(f => f.toLowerCase().includes("skeleton"));
    let loadingTemplate = hasSkeleton ? "<Skeleton />" : "<div>Loading...</div>";
    
    console.log(pc.cyan(`\n🎨 UI Intelligence:`));
    const uiConfirm = await new Toggle({
        message: `Suggested loading guard: ${pc.yellow(loadingTemplate)}. Accept?`,
        initial: true
    }).run();

    if (!uiConfirm) {
        loadingTemplate = await pkg.prompt({
            type: 'input',
            name: 'val',
            message: 'Custom loading JSX (e.g. <Spinner />):'
        }).then((r: any) => r.val);
    }

    // 4. Configuration Commit
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
    
    console.log(pc.gray(`\n${divider}`));
    logger.success("✔ BINDER PROTOCOL INITIALIZED");
    console.log(pc.white("\n  Next Command: ") + pc.bold(pc.green("binder bind <file>")));
    console.log(pc.white("  Manual Override: ") + pc.bold(pc.cyan("binder bind <file> --interactive\n")));
  });

program
  .command("guide")
  .alias("help")
  .description("Comprehensive guide on Binder commands and workflow")
  .action(async () => {
    await revealLogo();
    console.log(pc.bold(pc.cyan("\n📖 BINDER OPERATIONAL GUIDE\n")));
    
    const table = [
        { Command: 'init', Purpose: 'Auto-detect project structure and setup config.' },
        { Command: 'bind <path>', Purpose: 'Swap mocks with real API hooks (Auto/Human/TODO).' },
        { Command: 'validate', Purpose: 'Verify schema and project health.' },
        { Command: 'audit <path>', Purpose: 'Scan and catalog all mocks without changing code.' },
        { Command: 'undo <file>', Purpose: 'Revert the last binding operation.' },
        { Command: 'history', Purpose: 'View the timeline of all past bindings.' },
        { Command: 'guide', Purpose: 'You are looking at it!' }
    ];
    
    console.table(table);

    console.log(pc.bold("\n💡 WORKFLOW TIPS:"));
    console.log(pc.white("  • Use ") + pc.bold(pc.green("--interactive")) + pc.white(" to review complex architectural decisions."));
    console.log(pc.white("  • Use ") + pc.bold(pc.yellow("--dry-run")) + pc.white(" to preview AST changes in the terminal."));
    console.log(pc.white("  • Binder ") + pc.bold(pc.cyan("Self-Heals")) + pc.white(" using MCP if type checks fail after surgery."));
  });

program
  .command("bind <path>")
  .description("Bind file(s) to API")
  .option("--batch", "Batch mode", false)
  .option("-i, --interactive", "Review and confirm each binding", false)
  .option("--dry-run", "Preview changes without writing files", false)
  .option("--generate-tests", "Auto-generate Vitest compatibility tests", false)
  .option("--auto-only", "Only auto-convert 100% safe matches", false)
  .option("--ignore <variables>", "Comma-separated list of mock variables to ignore")
  .option("--only <variables>", "Comma-separated list of mock variables to exclusively target")
  .action(async (targetPath, options) => {
    console.log(pc.cyan(logo));
    console.log(pc.gray(divider));
    
    const startTime = Date.now();
    const config = await loadConfig(program.opts().config);
    
    // Discovery
    const projectMap = await discoveryPhase(config);
    const absTarget = resolve(targetPath);
    
    logger.startSpinner("Preparing API Infrastructure...");
    await runOrval(config.backend.schemaPath, config.frontend.generatedDir, config.orval);
    logger.stopSpinner(true, "API Infrastructure Ready");

    const files = (options.batch && statSync(absTarget).isDirectory()) 
      ? readdirSync(absTarget).filter(f => f.endsWith(".tsx")).map(f => join(absTarget, f))
      : [absTarget];

    const { safeBind } = await import("./orchestrator/safeBind.js");

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
          }
      }

      if (bindResults.todos.length > 0) {
        // Handle remaining TODOs (those not resolved by human)
        for (const res of bindResults.todos) {
            // Append TODO comments to the file
            // Simplified: we should ideally insert them near the mock site
            logger.info(`  [TODO] ${res.mock.name}: ${res.reason}`);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success(`\n✨ Binding complete in ${duration}s`);
  });

program
  .command("validate")
  .description("Validate project state and configuration")
  .action(async () => {
    const config = await loadConfig(program.opts().config);
    await validateCommand(config);
  });

program
  .command("audit <path>")
  .description("Catalog all mocks without modifying code")
  .option("-o, --output <path>", "Output JSON report")
  .action(async (targetPath, options) => {
    const config = await loadConfig(program.opts().config);
    const absTarget = resolve(targetPath);
    const files = statSync(absTarget).isDirectory() 
        ? readdirSync(absTarget).filter(f => f.endsWith(".tsx")).map(f => join(absTarget, f))
        : [absTarget];

    const report: any[] = [];
    for (const file of files) {
        const mocks = scanMocks(file, config);
        report.push({ file, count: mocks.length, mocks: mocks.map(m => ({ name: m.name, type: m.type })) });
    }

    if (options.output) {
        writeFileSync(options.output, JSON.stringify(report, null, 2));
        logger.success(`Audit report saved to ${options.output}`);
    } else {
        console.table(report.map(r => ({ File: r.file, Mocks: r.count })));
    }
  });

program
  .command("undo <path>")
  .description("Restore a file to its state before the last Binder operation")
  .action((path) => {
    undoLast(resolve(path));
  });

program
  .command("history [path]")
  .description("List binding history for a file or project")
  .action((path) => {
    listHistory(path ? resolve(path) : undefined);
  });

program.parse();
