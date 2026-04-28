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
    await new Promise(r => setTimeout(r, 1000));
    logger.stopSpinner(true, "Protocol sequence established.");
    
    await revealLogo();
    console.log(pc.bold("\n🚀 WELCOME TO BINDER INITIALIZATION\n"));
    
    const checkAndInstall = async (dep: string) => {
        const isInstalled = await new Select({
            message: `Is ${pc.yellow(dep)} already installed?`,
            choices: ['Yes', 'No']
        }).run();
        
        if (isInstalled === 'No') {
            const shouldInstall = await new Select({
                message: `Would you like Binder to run ${pc.cyan("npm install " + dep)}?`,
                choices: ['Yes (Install Now)', 'No (I will do it manually)']
            }).run();
            
            if (shouldInstall.startsWith('Yes')) {
                logger.startSpinner(`Installing ${dep}...`);
                try {
                    execSync(`npm install ${dep}`, { stdio: 'ignore' });
                    logger.stopSpinner(true, `${dep} installed successfully.`);
                } catch (e) {
                    logger.stopSpinner(false, `Failed to install ${dep}.`);
                }
            }
        }
    };

    try {
        await checkAndInstall("@tanstack/react-query");
        await checkAndInstall("axios");

        console.log(pc.bold("\n🤖 AI CORE CONFIGURATION"));
        const provider = await new Select({
            message: 'Choose your AI Engine:',
            choices: [
                { name: 'openai', message: 'OpenAI (GPT-4o/Turbo)' },
                { name: 'gemini', message: 'Google Gemini (Flash/Pro)' },
                { name: 'ollama', message: 'Ollama (Local/Private)' },
                { name: 'manual', message: 'Custom / Manual Setup' }
            ]
        }).run();
        
        const configPath = resolve(process.cwd(), "binder.config.json");
        const defaultConfig = {
            backend: { schemaPath: "./openapi.json", url: "http://localhost:8000" },
            frontend: { generatedDir: "./src/generated" },
            llm: { 
                provider: provider === 'manual' ? "openai" : provider, 
                model: provider === 'openai' ? "gpt-4o" : (provider === 'gemini' ? "gemini-1.5-flash" : (provider === 'ollama' ? "codellama" : "YOUR_MODEL_HERE")) 
            },
            orval: { client: "react-query" },
            mcpServers: []
        };
        
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        logger.success("\n✨ binder.config.json created successfully.");

        console.log(pc.gray(divider));
        logger.success("✔ BINDER INITIALIZED SUCCESSFULLY!");
        logger.info("\n💡 NEXT STEPS:");
        console.log(pc.white("  1. Configure your API keys in ") + pc.cyan(".env"));
        console.log(pc.white("  2. Run ") + pc.green("binder tutorial") + pc.white(" for usage details.\n"));

    } catch (err) {
        console.log(pc.red("\n✖ Initialization interrupted."));
    }
  });

program
  .command("tutorial")
  .description("Guide on how to use Binder")
  .action(async () => {
    await revealLogo();
    logger.box("BINDER WORKFLOW GUIDE", [
      "1. CONFIG: Point to your openapi.json file (local or URL).",
      "2. BIND:   Run 'binder bind <file>' to swap mocks.",
      "3. TEST:   Use '--with-integration' for E2E checks.",
      "4. AUTH:   Add 'custom-instance.ts' for global auth."
    ]);
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
      logger.system(`\n>>> Processing: ${file}`);
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
        logger.warning("No mocks detected after filtering. Skipping.");
        continue;
      }
      
      const apiContent = readFileSync(join(config.frontend.generatedDir, "api.ts"), "utf-8");
      const hookNames = [...apiContent.matchAll(/export (?:function|const) (use\w+)/g)].map(m => m[1]);
      
      // PHASE 2 & 3: HEURISTIC MATCHING & SAFETY CHECK
      const bindResults = await safeBind(mocks, file, config, hookNames);

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
            logger.success(`✓ Manual Override: ${res.mock.name} → ${res.hook}`);
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
