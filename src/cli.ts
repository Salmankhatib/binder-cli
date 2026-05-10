import { Command } from "commander";
import pc from "picocolors";
import { logo, divider, revealLogo } from "./utils/ascii.js";
import { flushCache } from "./utils/cache.js";
import { initAction } from "./cli/actions/initAction.js";
import { bindAction } from "./cli/actions/bindAction.js";
import { validateCommand } from "./validate/validateCommand.js";
import { undoLast, listHistory } from "./cli/undo.js";
import { loadConfig } from "./config/loader.js";

const program = new Command();

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
    await initAction(revealLogo);
  });

program
  .command("guide")
  .alias("help")
  .description("Comprehensive guide on Binder commands and workflow")
  .action(async () => {
    await revealLogo();
    console.log(pc.bold(pc.cyan("\n📖 BINDER OPERATIONAL GUIDE\n")));
    
    const table = [
        { Command: 'init', Purpose: 'Setup project DNA and automated protocols.' },
        { Command: 'bind <path>', Purpose: 'Surgically swap mocks for real API hooks.' },
        { Command: 'drift', Purpose: 'Deep field-level analysis of code vs schema.' },
        { Command: 'watch', Purpose: 'Real-time local sentinel for contract health.' },
        { Command: 'snapshot', Purpose: 'Capture an immutable record of contract state.' },
        { Command: 'dashboard', Purpose: 'Generate cinematic report with rollback intelligence.' },
        { Command: 'scaffold', Purpose: 'Generate UI components and hooks from OpenAPI.' },
        { Command: 'deploy-guard', Purpose: 'CI check: abort deployment if unverified.' },
        { Command: 'serve', Purpose: 'Host the live dashboard and version capabilities.' },
        { Command: 'upgrade', Purpose: 'Analyze snapshots to generate migration plans.' },
        { Command: 'undo', Purpose: 'Safety net: Revert the last surgical operation.' },
        { Command: 'validate', Purpose: 'Verify project health and config alignment.' },
    ];
    
    console.table(table);

    console.log(pc.bold("\n💡 WORKFLOW TIPS:"));
    console.log(pc.white("  • Use ") + pc.bold(pc.green("--interactive")) + pc.white(" to review complex architectural decisions."));
    console.log(pc.white("  • Use ") + pc.bold(pc.yellow("--dry-run")) + pc.white(" to preview AST changes in the terminal."));
    console.log(pc.white("  • Binder ") + pc.bold(pc.cyan("Self-Heals")) + pc.white(" using MCP if type checks fail after surgery."));
  });

// Register new CLI commands – snapshot
import { runSnapshot } from "./cli/snapshot.js";
import { runUpgrade } from "./cli/upgrade.js";
import { runDashboard } from "./cli/dashboard.js";
import { runScaffold } from "./cli/scaffold.js";
import { runWatch } from "./cli/watch.js";
import { runDrift } from "./cli/drift.js";
import { runDeployGuard } from "./cli/deployGuard.js";
import { runVerify } from "./cli/verify.js";
import { runSync } from "./cli/sync.js";
import { runAutoPilot } from "./cli/autoPilot.js";


program
  .command("snapshot")
  .description("Create a Binder snapshot of repo state and OpenAPI hash")
  .option("--status <type>", "Status of the contract (verified | failed)")
  .action(async (opts) => {
    await runSnapshot(opts);
  });

// Serve command – starts the Express version‑negotiation server
import { startServer } from "./server/app.js";
program
  .command("serve")
  .description("Run Binder auxiliary server (version negotiation & capabilities)")
  .option("-p, --port <number>", "Port to listen on", "3000")
  .action(async (opts) => {
    const port = Number(opts.port);
    startServer(port);
    console.log(`Binder server started on http://localhost:${port}`);
  });

program
  .command("upgrade")
  .description("Analyze snapshots and generate a migration plan")
  .action(async () => {
    await runUpgrade();
  });

program
  .command("dashboard")
  .alias("map")
  .description("Generate a visual compatibility dashboard with rollback intelligence")
  .action(async () => {
    await runDashboard();
  });

program
  .command("scaffold <endpoint>")
  .description("Generate frontend code from an OpenAPI endpoint")
  .option("-p, --pattern <name>", "Pattern name from .binder/patterns/")
  .option("-w, --write", "Write the generated component to disk", false)
  .option("-o, --output <path>", "Output directory for the component", "src/components/generated")
  .action(async (endpoint, options) => {
    await runScaffold(endpoint, options);
  });

program
  .command("watch")
  .description("Real-time local sentinel: watch schema and source for drift")
  .action(async () => {
    await runWatch();
  });

program
  .command("drift")
  .description("Analyze live code vs schema for contract mismatches")
  .action(async () => {
    await runDrift();
  });

program
  .command("deploy-guard")
  .description("Verify deployment safety against the latest snapshot")
  .action(async () => {
    await runDeployGuard();
  });

program
  .command("verify")
  .description("Cross-check compatibility with a specific snapshot tag")
  .requiredOption("-t, --target <tag>", "Target snapshot tag or ID")
  .action(async (opts) => {
    await runVerify(opts);
  });

program
  .command("sync")
  .description("Pull latest schema and scan project for mocks")
  .action(async () => {
    await runSync();
  });

program
  .command("auto-pilot")
  .description("Execute full Binder workflow: sync -> drift -> snapshot")
  .action(async () => {
    await runAutoPilot();
  });


program
  .command("bind <path>")
  .description("Bind file(s) to API")
  .option("--batch", "Batch mode", false)
  .option("-i, --interactive", "Review and confirm each binding", false)
  .option("--dry-run", "Preview changes without writing files", false)
  .option("--generate-tests", "Auto-generate Vitest compatibility tests", false)
  .option("--auto-only", "Only auto-convert 100% safe matches", false)
  .option("--repo", "Full repository sweep: propagate matches across the entire project", false)
  .option("--ignore <variables>", "Comma-separated list of mock variables to ignore")
  .option("--only <variables>", "Comma-separated list of mock variables to exclusively target")
  .action(async (targetPath, options) => {
    await bindAction(targetPath, options, program.opts().config, logo, divider);
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
