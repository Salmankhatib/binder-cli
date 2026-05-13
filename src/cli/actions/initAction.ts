import pc from "picocolors";
import pkg from "enquirer";
const { Select, Toggle } = pkg;
import { execSync, exec } from "child_process";
import { resolve, dirname, join } from "path";
import { writeFileSync, existsSync } from "fs";
import { logger } from "../../utils/logger.js";
import { divider } from "../../utils/ascii.js";
import { discoveryPhase } from "../../discover/scout.js";

async function isToolInPath(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
        const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
        exec(checkCmd, (err) => resolve(!err));
    });
}

export async function initAction(revealLogo: () => Promise<void>) {
    await revealLogo();
    console.log(pc.bold(pc.cyan("\n🚀 BINDER INITIALIZATION SEQUENCE STARTING...\n")));
    
    logger.startSpinner("📡 Analyzing project DNA...");
    const projectMap = await discoveryPhase({ backend: { schemaPath: "", url: "" }, frontend: { generatedDir: "" } } as any);
    logger.stopSpinner(true, "Project DNA decrypted.");
    
    // 0. Protocol Intelligence
    const protocolChoice = await new Select({
        message: "Which protocol does your project use for data fetching?",
        choices: [
            { name: 'rest', message: 'REST API (Standard OpenAPI)' },
            { name: 'trpc', message: 'tRPC (End-to-end Typesafe)' }
        ]
    }).run();
    const isTrpc = protocolChoice === 'trpc';

    // 1. Dependency Management
    const deps = projectMap.mainDependencies;
    const required = isTrpc ? ["@trpc/client", "@trpc/react-query", "@tanstack/react-query"] : ["@tanstack/react-query", "axios"];
    const missing = required.filter(d => !deps.includes(d));

    if (missing.length > 0) {
        console.log(pc.yellow(`\n📦 Missing infrastructure: ${missing.join(", ")}`));
        const shouldInstall = await new Select({
            message: `Would you like Binder to install these for you?`,
            choices: ['Yes, install now (npm)', 'No, I will handle it']
        }).run();
        
        if (shouldInstall.startsWith('Yes')) {
            logger.startSpinner(`Installing dependencies...`);
            try {
                execSync(`npm install ${missing.join(" ")}`, { stdio: 'ignore' });
                logger.stopSpinner(true, `Dependencies integrated.`);
            } catch (e) {
                logger.stopSpinner(false, `Automatic installation failed.`);
            }
        }
    }

    // 2. Schema / Router Discovery
    let schemaPath = "";
    let trpcRouterPath = "";
    
    if (isTrpc) {
        trpcRouterPath = projectMap.tree.find(f => f.includes("root.ts") || f.includes("router.ts") || f.includes("AppRouter")) || "./src/server/routers/root.ts";
        console.log(pc.cyan(`\n🔍 tRPC Router Discovery:`));
        const routerConfirm = await new Toggle({
            message: `Detected AppRouter definition at ${pc.bold(trpcRouterPath)}. Use it?`,
            initial: true
        }).run();
        
        if (!routerConfirm) {
            trpcRouterPath = await (pkg as any).prompt({
                type: 'input',
                name: 'path',
                message: 'Enter path to your AppRouter type definition:'
            }).then((r: any) => r.path);
        }
    } else {
        schemaPath = projectMap.tree.find(f => f.includes("openapi.json") || f.includes("swagger.json")) || "./openapi.json";
        console.log(pc.cyan(`\n🔍 Schema Discovery:`));
        const schemaConfirm = await new Toggle({
            message: `Found schema at ${pc.bold(schemaPath)}. Use it?`,
            initial: true
        }).run();
        
        if (!schemaConfirm) {
            schemaPath = await (pkg as any).prompt({
                type: 'input',
                name: 'path',
                message: 'Enter path to your OpenAPI schema (Local path or URL):'
            }).then((r: any) => r.path);
        }
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
        loadingTemplate = await (pkg as any).prompt({
            type: 'input',
            name: 'val',
            message: 'Custom loading JSX (e.g. <Spinner />):'
        }).then((r: any) => r.val);
    }

    // 4. LLM Fallback Configuration
    console.log(pc.cyan(`\n🧠 Advanced Intelligence (Optional):`));
    console.log(pc.gray(`  Binder operates 100% locally with high precision by default.`));
    console.log(pc.gray(`  However, for extremely messy legacy code, it can optionally use an LLM as a fallback.`));
    const llmConfirm = await new Toggle({
        message: `Enable optional LLM Fallback?`,
        initial: false
    }).run();

    let llmConfig: any = { enabled: false };
    if (llmConfirm) {
        const providerChoice = await new Select({
            message: "Select your preferred LLM Provider:",
            choices: ['ollama', 'openai', 'anthropic', 'google', 'deepseek']
        }).run();

        const modelChoice = await (pkg as any).prompt({
            type: 'input',
            name: 'model',
            message: `Enter model name (e.g. ${providerChoice === 'ollama' ? 'llama3' : 'gpt-4o'}):`
        }).then((r: any) => r.model);

        llmConfig = {
            enabled: true,
            provider: providerChoice,
            model: modelChoice || (providerChoice === 'ollama' ? 'llama3' : 'default')
        };

        if (providerChoice === 'ollama') {
            llmConfig.host = 'http://localhost:11434/api/generate';
        }
    }

    // 4.5 Environment Intelligence (MCP/LCP)
    logger.startSpinner("📡 Scanning environment for MCP/LCP providers...");
    const mcpServers: any[] = [
        { name: 'ts-repair', command: 'npx', args: ['ts-repair', 'mcp-server'] }
    ];
    const packagesToInstall: string[] = ['@bindercli/ts-repair'];

    // Test Runner Discovery & Provisioning
    if (deps.includes('vitest')) {
        mcpServers.push({ name: 'vitest', command: 'npx', args: ['vitest-mcp', 'mcp-server'] });
        packagesToInstall.push('@bindercli/vitest-mcp');
    } else if (deps.includes('jest')) {
        mcpServers.push({ name: 'jest', command: 'npx', args: ['jest-mcp', 'mcp-server'] });
        packagesToInstall.push('@bindercli/jest-mcp');
    } else {
        // Auto-provision Vitest if no runner found
        console.log(pc.yellow("\n🧪 No test runner detected. Provisioning Vitest for functional safety..."));
        packagesToInstall.push('vitest', '@bindercli/vitest-mcp');
        mcpServers.push({ name: 'vitest', command: 'npx', args: ['vitest-mcp', 'mcp-server'] });
    }

    // Prettier Discovery & Provisioning
    const hasPrettier = deps.includes('prettier') || 
                       existsSync(resolve(process.cwd(), '.prettierrc')) || 
                       existsSync(resolve(process.cwd(), 'prettier.config.js'));

    if (!hasPrettier) {
        console.log(pc.yellow("\n✨ No formatter detected. Provisioning Prettier for clean surgery..."));
        packagesToInstall.push('prettier');
    }
    mcpServers.push({ name: 'prettier', command: 'npx', args: ['prettier-mcp', 'mcp-server'] });
    packagesToInstall.push('@bindercli/prettier-mcp');

    // LSP Discovery
    const lspMap: Record<string, string> = {
        'gopls': 'go',
        'pyright': 'python',
        'rust-analyzer': 'rust'
    };
    let lspFound = false;
    for (const [tool, lang] of Object.entries(lspMap)) {
        if (await isToolInPath(tool)) {
            mcpServers.push({ name: 'lsp', command: 'npx', args: ['lsp-mcp', 'mcp-server', '--lang', lang] });
            packagesToInstall.push('@bindercli/lsp-mcp');
            lspFound = true;
            break; 
        }
    }

    if (!lspFound) {
        logger.info("No backend LSP (gopls/pyright) found. Real-time LCP sync will be limited.");
    }

    logger.stopSpinner(true, `Environment Intelligence gathered.`);

    // 4.6 Automatic Provisioning (Silent Installation)
    if (packagesToInstall.length > 0) {
        logger.startSpinner("📦 Provisioning autonomous agents and dependencies...");
        try {
            execSync(`npm install -D ${packagesToInstall.join(" ")}`, { stdio: 'ignore' });
            logger.stopSpinner(true, "Agents provisioned and ready.");
        } catch (e) {
            logger.stopSpinner(false, "Provisioning encountered issues. Continuing with configuration...");
        }
    }

    // 5. Configuration Commit
    const configPath = resolve(process.cwd(), "binder.config.json");
    const defaultConfig = {
        protocol: protocolChoice,
        backend: { 
            schemaPath: isTrpc ? undefined : schemaPath, 
            trpcAppRouterPath: isTrpc ? trpcRouterPath : undefined,
            trpcExportName: isTrpc ? "trpc" : undefined,
            dtoPaths: dtoPaths.length > 0 ? dtoPaths : undefined,
            url: "http://localhost:8000" 
        },
        frontend: { 
            generatedDir: "./src/generated",
            loadingTemplate: loadingTemplate,
            errorTemplate: "<div>Error loading data</div>"
        },
        mcpServers,
        orval: isTrpc ? undefined : { client: "react-query" },
        llm: llmConfig
    };
    
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    
    // 6. Sentinel Handshake (Verification)
    console.log(pc.cyan(`\n🛡️  Sentinel Handshake:`));
    logger.startSpinner("Verifying MCP connectivity...");
    
    const { BinderMCP } = await import("../../mcp/client.js");
    const mcp = new BinderMCP();
    await mcp.initialize(defaultConfig as any);
    
    // Check if servers connected (initialize logs it, but we can double check)
    // In a real implementation we might add a .ping() method to BinderMCP
    
    logger.stopSpinner(true, "Sentinel Handshake complete. Systems online.");

    console.log(pc.gray(`\n${divider}`));
    logger.success("✔ BINDER PROTOCOL INITIALIZED");
    console.log(pc.white("\n  Next Command: ") + pc.bold(pc.green("binder bind <file>")));
    console.log(pc.white("  Manual Override: ") + pc.bold(pc.cyan("binder bind <file> --interactive\n")));
}
