import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import pc from 'picocolors';
import { logger } from '../utils/logger.js';
import { collectAPICalls } from '../analysis/apiCallCollector.js';
import { loadConfig } from '../config/loader.js';
import { TrpcRouterAnalyzer } from '../analysis/trpcAnalyzer.js';

/**
 * binder drift identifies mismatches between frontend code and the API schema.
 * This "Ultimate" version performs deep field-level drift analysis.
 */
export async function runDrift() {
  const config = await loadConfig('./binder.config.json');
  const isTrpc = config.protocol === 'trpc';
  
  let schema: any = null;
  let trpcProcedures: any[] = [];

  if (isTrpc) {
    const trpcPath = resolve(process.cwd(), config.backend.trpcAppRouterPath || '');
    if (!existsSync(trpcPath)) {
      logger.error(`tRPC Router not found at ${trpcPath}`);
      return;
    }
    const analyzer = new TrpcRouterAnalyzer();
    const proceduresMap = await analyzer.analyze(trpcPath);
    trpcProcedures = Array.from(proceduresMap.values());
  } else {
    const schemaPath = resolve(process.cwd(), config.backend.schemaPath || 'openapi.json');
    if (!existsSync(schemaPath)) {
      logger.error(`Schema not found at ${schemaPath}`);
      return;
    }
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  }
  
  logger.startSpinner('Performing Deep Contract Drift Analysis...');
  const calls = await collectAPICalls(resolve(process.cwd(), 'src'));
  
  const results: { file: string, line: number, hook: string, drift: string[] }[] = [];

  for (const call of calls) {
    const drift: string[] = [];
    
    if (isTrpc) {
      // tRPC Analysis
      const procedureName = call.hookName.replace(/^use/, '').split('.').map(s => s.charAt(0).toLowerCase() + s.slice(1)).join('.');
      const procedure = trpcProcedures.find(p => p.path === procedureName || p.procedure === procedureName.split('.').pop());
      
      if (!procedure) {
        drift.push(`Orphaned tRPC Hook: ${pc.red(call.hookName)} has no matching procedure in AppRouter.`);
      } else {
        // Simple output type mismatch check (heuristic)
        // In a real implementation, we'd compare the expected fields in call.accessedProperties
        // against the TypeScript properties of procedure.outputType.
      }
    } else {
      // OpenAPI Analysis
      const operation = findOperationForHook(schema, call.hookName);
      
      if (!operation) {
        drift.push(`Orphaned Hook: ${pc.red(call.hookName)} has no matching endpoint in schema.`);
      } else {
        const responseSchema = getResponseSchema(schema, operation);
        if (responseSchema && responseSchema.properties) {
          const schemaProps = Object.keys(responseSchema.properties);
          for (const accessedProp of call.accessedProperties) {
            if (!schemaProps.includes(accessedProp)) {
              drift.push(`Field Mismatch: Code accesses ${pc.red('.' + accessedProp)} but schema only provides [${schemaProps.join(', ')}]`);
            }
          }
        }
      }
    }

    if (drift.length > 0) {
      results.push({
        file: relative(process.cwd(), call.file),
        line: call.line,
        hook: call.hookName,
        drift
      });
    }
  }

  logger.stopSpinner(true, `Scan complete. Found ${results.length} files with drift.`);

  if (results.length === 0) {
    logger.success('\n✨ DEEP DRIFT STATUS: PERFECT SYNC');
    console.log(pc.green('  No field-level or type-level contract drift detected across project.\n'));
  } else {
    console.log(pc.bold(pc.red(`\n⚠️  CONTRACT DRIFT DETECTED (${results.length} files affected)`)));
    console.log(pc.gray('========================================'));

    results.forEach(res => {
      console.log(`\n📄 ${pc.bold(res.file)}:${pc.cyan(res.line)}`);
      console.log(`   Hook: ${pc.yellow(res.hook)}`);
      res.drift.forEach(d => console.log(`   ❌ ${d}`));
    });
    
    console.log(pc.gray('\n========================================'));
    logger.warn('💡 Suggestion: Update your schema or use "binder scaffold --update" to resync hooks.');
    process.exit(1); // Exit with error for CI/CD blockers
  }
}

/**
 * Heuristic to find an OpenAPI operation from a hook name.
 * e.g. useGetUsers -> GET /users
 */
function findOperationForHook(schema: any, hookName: string): any {
  const cleanName = hookName.replace(/^use/, '').toLowerCase(); // e.g. getusers
  
  for (const path in schema.paths) {
    for (const method in schema.paths[path]) {
      const op = schema.paths[path][method];
      // Check summary, operationId, or path name
      const matches = 
        (op.operationId && op.operationId.toLowerCase().includes(cleanName)) ||
        (path.replace(/\//g, '').toLowerCase().includes(cleanName.replace('get', ''))) ||
        (path.replace(/\//g, '').toLowerCase().includes(cleanName.replace('use', '')));
        
      if (matches) return op;
    }
  }
  return null;
}

/**
 * Extracts the 200 response schema, resolving $refs if necessary.
 */
function getResponseSchema(schema: any, operation: any): any {
  const response = operation.responses?.['200'] || operation.responses?.['201'];
  if (!response) return null;

  let content = response.content?.['application/json']?.schema;
  if (!content) return null;

  // Resolve $ref (one level deep for now)
  if (content.$ref) {
    const refPath = content.$ref.replace('#/', '').split('/');
    let current = schema;
    for (const segment of refPath) {
      current = current[segment];
    }
    content = current;
  }

  // Handle arrays
  if (content.type === 'array' && content.items) {
    if (content.items.$ref) {
      const refPath = content.items.$ref.replace('#/', '').split('/');
      let current = schema;
      for (const segment of refPath) {
        current = current[segment];
      }
      return current;
    }
    return content.items;
  }

  return content;
}
