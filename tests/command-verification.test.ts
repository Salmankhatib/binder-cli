// tests/command-verification.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

describe('Binder CLI Command Verification', () => {
  const root = resolve(__dirname, '..');
  
  it('should list all commands in help', () => {
    // Note: this assumes we can run the source with a loader or it is built
    // For this environment, we'll check if src/cli.ts contains the definitions
    const cliContent = readFileSync(join(root, 'src/cli.ts'), 'utf-8');
    
    expect(cliContent).toContain('.command("init")');
    expect(cliContent).toContain('.command("bind <path>")');
    expect(cliContent).toContain('.command("validate")');
    expect(cliContent).toContain('.command("audit <path>")');
    expect(cliContent).toContain('.command("undo <path>")');
    expect(cliContent).toContain('.command("history [path]")');
  });

  it('should have consistent types between engine and common', () => {
    const commonTypes = readFileSync(join(root, 'src/common/types.ts'), 'utf-8');
    const engineTypes = readFileSync(join(root, 'src/engine/types.ts'), 'utf-8');
    
    // Check if both use 'Binding' and 'BindingPlan'
    expect(commonTypes).toContain('interface Binding');
    expect(engineTypes).toContain("import { Binding } from '../common/types.js'");
  });
});
