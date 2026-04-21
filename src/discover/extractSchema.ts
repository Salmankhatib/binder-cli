import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';

export interface OpenApiSchema {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, unknown>;
}

// ─── CROSS-PLATFORM PYTHON DETECTOR ───
function findPython(): string {
  const candidates = ['python3', 'python', 'py'];
  
  for (const cmd of candidates) {
    const result = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
    if (!result.error && result.status === 0) {
      logger.system(`Python detected: ${result.stdout.trim()} (${cmd})`);
      return cmd;
    }
  }
  
  throw new Error(
    'Python not found. Tried: python3, python, py\n' +
    'Install Python 3.9+ and ensure it is in your PATH.\n' +
    'Windows: https://python.org/downloads'
  );
}

const PYTHON_EXTRACTOR = `
import json
import sys
import importlib.util
from pathlib import Path

def find_fastapi_app(module):
    for name in ['app', 'application', 'api']:
        if hasattr(module, name):
            obj = getattr(module, name)
            if hasattr(obj, 'openapi'):
                return obj
    for name in ['create_app', 'make_app', 'get_app', 'build_app']:
        if hasattr(module, name):
            factory = getattr(module, name)
            if callable(factory):
                try:
                    app = factory()
                    if hasattr(app, 'openapi'):
                        return app
                except Exception:
                    continue
    return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No Python file specified"}), file=sys.stderr)
        sys.exit(1)
    
    target_file = sys.argv[1]
    module_name = Path(target_file).stem
    
    try:
        spec = importlib.util.spec_from_file_location(module_name, target_file)
        if not spec or not spec.loader:
            print(json.dumps({"error": f"Cannot load module from {target_file}"}), file=sys.stderr)
            sys.exit(1)
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except Exception as e:
        print(json.dumps({"error": f"Import failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)
    
    app = find_fastapi_app(module)
    
    if not app:
        print(json.dumps({
            "error": f"No FastAPI app found in {target_file}. Looked for: app, application, api, create_app, make_app, get_app"
        }), file=sys.stderr)
        sys.exit(1)
    
    try:
        schema = app.openapi()
        print(json.dumps(schema))
    except Exception as e:
        print(json.dumps({"error": f"openapi() failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
`;

export async function extractOpenApiFromPython(pythonFile: string): Promise<OpenApiSchema> {
  logger.startSpinner('Extracting OpenAPI schema from Python kernel...');
  
  const pythonCmd = findPython();
  
  // FIX: Resolve to absolute path before passing to Python
  const absolutePythonFile = resolve(pythonFile);
  logger.system(`Resolved Python file: ${absolutePythonFile}`);
  
  const result = spawnSync(pythonCmd, ['-c', PYTHON_EXTRACTOR, absolutePythonFile], {
    encoding: 'utf-8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    logger.failSpinner(`Python execution failed: ${result.error.message}`);
    throw new Error(`Failed to run Python: ${result.error.message}`);
  }

  if (result.status !== 0) {
    logger.failSpinner('Python extraction failed');
    let errorMsg = 'Unknown error';
    try {
      const err = JSON.parse(result.stderr);
      errorMsg = err.error || result.stderr;
    } catch {
      errorMsg = result.stderr || `Exit code ${result.status}`;
    }
    throw new Error(`Python: ${errorMsg}`);
  }

  if (result.stderr) {
    logger.warning(`Python stderr: ${result.stderr.trim()}`);
  }

  let schema: OpenApiSchema;
  try {
    schema = JSON.parse(result.stdout);
  } catch {
    logger.failSpinner('Invalid JSON from Python');
    throw new Error('Python output is not valid JSON. Check backend file.');
  }

  if (!schema.openapi || !schema.paths) {
    logger.failSpinner('Invalid OpenAPI schema');
    throw new Error('Python output missing required OpenAPI fields (openapi, paths)');
  }

  logger.stopSpinner(true, `Schema extracted: ${schema.info?.title || 'Unknown'} v${schema.info?.version || '?'}`);
  logger.system(`Routes detected: ${Object.keys(schema.paths).length}`);

  return schema;
}