// src/human/tui/keyboardHandler.ts
import { stdin, stdout } from 'process';
import readline from 'readline';

export class KeyboardHandler {
  private currentIndex = 0;
  private totalOptions = 0;

  async getSelection(totalOptions: number): Promise<'up' | 'down' | 'select' | 'dry-run' | 'todo' | 'skip'> {
    this.totalOptions = totalOptions;
    this.currentIndex = 0;

    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const handler = (key: string) => {
        if (key === '\u001B\u005B\u0041') { // Up arrow
          this.currentIndex = Math.max(0, this.currentIndex - 1);
          resolve('up');
        } else if (key === '\u001B\u005B\u0042') { // Down arrow
          this.currentIndex = Math.min(this.totalOptions - 1, this.currentIndex + 1);
          resolve('down');
        } else if (key === '\r') { // Enter
          stdin.setRawMode(false);
          stdin.pause();
          rl.close();
          resolve('select');
        } else if (key === 'd' || key === 'D') {
          resolve('dry-run');
        } else if (key === 't' || key === 'T') {
          stdin.setRawMode(false);
          stdin.pause();
          rl.close();
          resolve('todo');
        } else if (key === 'm' || key === 'M') {
          stdin.setRawMode(false);
          stdin.pause();
          rl.close();
          resolve('manual');
        } else if (key === '\u0003') { // Ctrl+C
          process.exit(0);
        }
      };

      stdin.once('data', handler);
    });
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
}
