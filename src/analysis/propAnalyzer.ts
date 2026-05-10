import { Project, SourceFile, SyntaxKind, Node, Identifier } from 'ts-morph';
import { PropDrillResult } from './propTracer.js';

/**
 * Analyzes if a mock is passed as a prop and determines the risk level.
 */
export function analyzePropDrillingRisk(drills: PropDrillResult[]): { 
    isHighRisk: boolean, 
    explanation: string 
} {
    if (drills.length === 0) return { isHighRisk: false, explanation: '' };

    if (drills.length > 2) {
        return { 
            isHighRisk: true, 
            explanation: `Mock is deeply drilled into ${drills.length} components. Auto-binding will likely break multiple files.` 
        };
    }

    const componentNames = drills.map(d => `<${d.componentName} />`).join(', ');
    return {
        isHighRisk: true,
        explanation: `Mock is passed as a prop to ${componentNames}. Manual update of child components is required.`
    };
}
