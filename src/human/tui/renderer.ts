// src/human/tui/renderer.ts
import { HumanOption, MockFinding } from '../../engine/types.js';
import pc from 'picocolors';

export class TUIRenderer {
  render(mock: MockFinding, options: HumanOption[], currentIndex: number): string {
    const lines: string[] = [];
    
    lines.push(pc.cyan('\n═════════════════════════════════════════'));
    lines.push(pc.bold(`📋 Mock: ${pc.yellow(mock.name)}`));
    lines.push(pc.gray(`   Found in line: ${mock.line}`));
    lines.push(pc.cyan('═════════════════════════════════════════\n'));

    options.forEach((option, index) => {
      const isSelected = index === currentIndex;
      const prefix = isSelected ? pc.green('▶') : ' ';
      const riskColor = option.riskLevel === 'safe' ? pc.green : option.riskLevel === 'caution' ? pc.yellow : pc.red;
      
      lines.push(`${prefix} ${isSelected ? pc.bold(option.label) : option.label}`);
      lines.push(`   ${pc.gray(option.description)}`);
      lines.push(`   ${pc.gray('Effort:')} ${option.effortEstimate} ${pc.gray('| Risk:')} ${riskColor(option.riskLevel)} ${pc.gray('| Confidence:')} ${(option.confidence * 100).toFixed(0)}%`);
      
      if (isSelected) {
        lines.push(pc.dim('\n   Preview:'));
        lines.push(pc.dim(option.consequence.codeDiff.split('\n').map(l => '   ' + l).join('\n')));
      }
      
      lines.push('');
    });

    lines.push(pc.gray('[↑↓] Navigate  [Enter] Select  [d] Dry run  [t] TODO  [s] Skip'));

    return lines.join('\n');
  }

  renderSelectionConfirmed(option: HumanOption): string {
    return pc.green(`\n✓ Selected: ${option.label}\n`);
  }
}
