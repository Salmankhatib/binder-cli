import pc from "picocolors";
import pkg from "enquirer";
const { Select, Toggle } = pkg;
import { execSync } from "child_process";
import { resolve } from "path";
import { writeFileSync } from "fs";
import { logger } from "../../utils/logger.js";
import { divider } from "../../utils/ascii.js";
import { discoveryPhase } from "../../discover/scout.js";

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

    // 5. Configuration Commit
    const configPath = resolve(process.cwd(), "binder.config.json");
    const defaultConfig = {
        protocol: protocolChoice,
        backend: { 
            schemaPath: isTrpc ? undefined : schemaPath, 
            trpcAppRouterPath: isTrpc ? trpcRouterPath : undefined,
            trpcExportName: isTrpc ? "trpc" : undefined,
            url: "http://localhost:8000" 
        },
        frontend: { 
            generatedDir: "./src/generated",
            loadingTemplate: loadingTemplate,
            errorTemplate: "<div>Error loading data</div>"
        },
        orval: isTrpc ? undefined : { client: "react-query" },
        llm: llmConfig
    };
    
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    
    console.log(pc.gray(`\n${divider}`));
    logger.success("✔ BINDER PROTOCOL INITIALIZED");
    console.log(pc.white("\n  Next Command: ") + pc.bold(pc.green("binder bind <file>")));
    console.log(pc.white("  Manual Override: ") + pc.bold(pc.cyan("binder bind <file> --interactive\n")));
}
