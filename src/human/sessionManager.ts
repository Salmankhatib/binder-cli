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

  async resolveHumanDecision(mock: MockFinding, decision: Decision): Promise<{ choice: HumanOption; apply: boolean }> {
    if (!decision.options || decision.options.length === 0) {
      throw new Error('No options provided for human decision');
    }

    let currentIndex = 0;
    const options = decision.options;

    // Render initial state
    console.log(this.renderer.render(mock, options, currentIndex));

    while (true) {
      const action = await this.keyboard.getSelection(options.length);
      
      if (action === 'up' || action === 'down') {
        currentIndex = this.keyboard.getCurrentIndex();
        // Clear and re-render
        process.stdout.write('\x1Bc'); 
        console.log(this.renderer.render(mock, options, currentIndex));
      } else if (action === 'select') {
        const choice = options[currentIndex];
        console.log(this.renderer.renderSelectionConfirmed(choice));

        // Learn from this choice
        this.accelerator.recordChoice({
          mockName: mock.name,
          patternName: decision.reasoning.find(r => r.layer === 'pattern')?.details?.matchedPattern as string || 'unknown',
          structuralSignature: decision.binding?.mockName || '', // We should ensure we have the right signature here
          projectContext: '' 
        }, choice);

        return { choice, apply: true };
      } else if (action === 'dry-run') {
        const choice = options[currentIndex];
        console.log(pc.cyan('\n--- DRY RUN ---'));
        console.log(choice.consequence.codeDiff);
        console.log(pc.cyan('---------------\n'));
        // Continue loop
      } else if (action === 'todo') {
        return { choice: options[0], apply: false }; // Treat as TODO
      } else if (action === 'skip') {
        process.exit(0);
      }
    }
  }
}
