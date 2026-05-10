// src/human/sessionManager.ts
import { Decision, HumanOption, MockFinding } from '../engine/types.js';
import { TUIRenderer } from './tui/renderer.js';
import { KeyboardHandler } from './tui/keyboardHandler.js';
import { LearningAccelerator } from '../learning/accelerator.js';
import pc from 'picocolors';

export class SessionManager {
  private renderer = new TUIRenderer();
  private keyboard = new KeyboardHandler();
  private accelerator = new LearningAccelerator();

  async resolveHumanDecision(mock: MockFinding, decision: Decision): Promise<{ choice: HumanOption; apply: boolean; manualCode?: string }> {
    if (!decision.options || decision.options.length === 0) {
      // If it's a TODO with no options, we still want to allow manual fix
      decision.options = [{
        id: 'manual-only',
        hookName: 'manual',
        strategy: 'manual',
        explanation: 'Manual intervention required',
        consequence: { codeDiff: '' }
      }];
    }

    let currentIndex = 0;
    const options = decision.options;

    // Render initial state
    console.log(this.renderer.render(mock, options, currentIndex));

    while (true) {
      const action = await this.keyboard.getSelection(options.length) as any;
      
      if (action === 'up' || action === 'down') {
        currentIndex = this.keyboard.getCurrentIndex();
        process.stdout.write('\x1Bc'); 
        console.log(this.renderer.render(mock, options, currentIndex));
      } else if (action === 'select') {
        const choice = options[currentIndex];
        console.log(this.renderer.renderSelectionConfirmed(choice));

        this.accelerator.recordChoice({
          mockName: mock.name,
          patternName: decision.reasoning.find(r => r.layer === 'pattern')?.details?.matchedPattern as string || 'unknown',
          structuralSignature: mock.name, 
          projectContext: '' 
        }, choice);

        return { choice, apply: true };
      } else if (action === 'manual') {
        const manualCode = await this.openEditor(mock.snippet);
        const choice: HumanOption = {
          id: 'manual-fix',
          hookName: 'custom',
          strategy: 'manual',
          explanation: 'User manually corrected the code',
          consequence: { codeDiff: manualCode }
        };
        
        // Learn that for this mock, the user prefers manual/custom logic
        this.accelerator.recordChoice({
          mockName: mock.name,
          patternName: 'manual-intervention',
          structuralSignature: mock.name,
          projectContext: ''
        }, choice);

        return { choice, apply: true, manualCode };
      } else if (action === 'dry-run') {
        const choice = options[currentIndex];
        console.log(pc.cyan('\n--- DRY RUN ---'));
        console.log(choice.consequence.codeDiff);
        console.log(pc.cyan('---------------\n'));
      } else if (action === 'todo') {
        return { choice: options[0], apply: false }; 
      } else if (action === 'skip') {
        process.exit(0);
      }
    }
  }

  private async openEditor(initialContent: string): Promise<string> {
    const pkg = await import('enquirer');
    const { Editor } = pkg.default as any;
    
    const prompt = new Editor({
      name: 'code',
      message: 'Edit the code to fix the binding (Save and Close to finish):',
      initial: initialContent
    });

    return await prompt.run();
  }
}
