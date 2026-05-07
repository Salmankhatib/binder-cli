import pc from 'picocolors';
import ora, { type Ora } from 'ora';

let currentSpinner: Ora | null = null;

export const logger = {
  // Raw tech logs (for system stuff)
  system: (msg: string) => console.log(pc.gray(`[SYS] ${msg}`)),
  engine: (msg: string) => console.log(pc.cyan(`[ENGINE] ${msg}`)),
  ai: (msg: string) => console.log(pc.magenta(`[AI] ${msg}`)),
  net: (msg: string) => console.log(pc.blue(`[NET] ${msg}`)),
  io: (msg: string) => console.log(pc.yellow(`[IO] ${msg}`)),
  
  // Standard colored logs
  info: (msg: string) => console.log(pc.blue('ℹ'), msg),
  success: (msg: string) => console.log(pc.green('✔'), msg),
  error: (msg: string) => console.log(pc.red('✖'), msg),
  warning: (msg: string) => console.log(pc.yellow('⚠'), msg),
  debug: (msg: string) => console.log(pc.gray('DEBUG:'), msg),
  
  // Step with tech prefix.
  step: (label: string, detail?: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const prefix = pc.gray(`[${timestamp}]`);
    const lbl = pc.bold(pc.cyan(label));
    console.log(`${prefix} ${lbl}${detail ? ' ' + pc.gray(detail) : ''}`);
  },

  // Spinner for async operations.
  startSpinner: (text: string): Ora => {
    if (currentSpinner) currentSpinner.stop();
    currentSpinner = ora({
      text: pc.cyan(text),
      spinner: 'dots12', // techy dots
      color: 'cyan',
    }).start();
    return currentSpinner;
  },

  stopSpinner: (success = true, text?: string) => {
    if (!currentSpinner) return;
    if (success) {
      currentSpinner.succeed(text ? pc.green(text) : undefined);
    } else {
      currentSpinner.fail(text ? pc.red(text) : undefined);
    }
    currentSpinner = null;
  },

  failSpinner: (text?: string) => {
    if (!currentSpinner) return;
    currentSpinner.fail(text ? pc.red(text) : undefined);
    currentSpinner = null;
  },

  // Verbose debug
  verbose: (msg: string, isVerbose: boolean) => {
    if (isVerbose) console.log(pc.gray(`  [debug] ${msg}`));
  },

  // Boxed output for results
  box: (title: string, lines: string[]) => {
    const width = 50;
    const top = pc.cyan('┌' + '─'.repeat(width) + '┐');
    const bottom = pc.cyan('└' + '─'.repeat(width) + '┘');
    const titleLine = pc.cyan('│') + ' ' + pc.bold(title).padEnd(width - 1) + pc.cyan('│');
    
    console.log(top);
    console.log(titleLine);
    console.log(pc.cyan('├' + '─'.repeat(width) + '┤'));
    lines.forEach(line => {
      const truncated = line.length > width - 2 ? line.slice(0, width - 5) + '...' : line;
      console.log(pc.cyan('│') + ' ' + truncated.padEnd(width - 1) + pc.cyan('│'));
    });
    console.log(bottom);
  },

  // Clear line (for animations)
  clear: () => process.stdout.write('\x1b[2K\r'),
};

export { logo, divider } from './ascii.js'
