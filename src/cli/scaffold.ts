import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { loadPatterns } from '../generate/patternLoader.js';
import { generateComponent } from '../generate/componentGenerator.js';
import { loadConfig } from '../config/loader.js';
import { BinderMCP } from '../mcp/client.js';

/**
 * binder scaffold generates frontend code from an OpenAPI endpoint.
 */
export async function runScaffold(endpointPath: string, options: { pattern?: string, write?: boolean, output?: string }) {
  const config = await loadConfig('./binder.config.json');
  const mcp = new BinderMCP();
  await mcp.initialize(config);
  
  const schemaPath = resolve(process.cwd(), config.backend.schemaPath || 'openapi.json');
  
  if (!existsSync(schemaPath)) {
    logger.error(`Schema not found at ${schemaPath}`);
    return;
  }

  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  
  // Find the endpoint in schema
  const pathData = schema.paths[endpointPath];
  if (!pathData) {
    logger.error(`Endpoint "${endpointPath}" not found in schema paths.`);
    return;
  }

  const method = Object.keys(pathData)[0]; // Just take the first method for now
  const patterns = loadPatterns();
  
  // Auto-select pattern based on method if not provided
  let patternKey = options.pattern;
  if (!patternKey) {
    patternKey = method === 'get' ? 'query-list' : 'mutation-form';
  }
  
  const pattern = patterns[patternKey];
  if (!pattern) {
    logger.warn(`Pattern "${patternKey}" not found. Falling back to internal default.`);
  }

  // If the pattern exists in the library, use the generator
  let generatedCode = '';
  if (pattern) {
    generatedCode = generateComponent(schema, endpointPath, method, pattern);
  } else {
    // Basic fallback for unknown patterns
    const hookName = `use${method.toUpperCase()}${endpointPath.replace(/\//g, '')}`;
    generatedCode = `// Generated fallback for ${endpointPath}\nexport const ${hookName}Form = () => { return <div>Generated</div>; };`;
  }

  if (options.write) {
    const outDir = resolve(process.cwd(), options.output || 'src/components/generated');
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    
    const fileName = `${endpointPath.replace(/\//g, '')}Form.tsx`;
    const fullPath = join(outDir, fileName);
    
    // Final pass: Formatting
    const formattedCode = await mcp.format(fullPath, generatedCode);
    
    writeFileSync(fullPath, formattedCode);
    logger.success(`✔ Component successfully written to ${pc.bold(fullPath)}`);
  } else {
    console.log(pc.cyan(`\n✨ SCAFFOLD PREVIEW [Endpoint: ${endpointPath}, Pattern: ${patternKey}]`));
    console.log(pc.gray('----------------------------------------'));
    console.log(pc.white(generatedCode));
    console.log(pc.gray('----------------------------------------'));
    console.log(pc.yellow('\n💡 Run with --write to save this component to your project.'));
  }
}
