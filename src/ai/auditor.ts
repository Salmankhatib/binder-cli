import { logger } from '../utils/logger.js';
import { callLLM } from './llmClient.js';

export async function auditBindingPlan(sourceCode: string, plan: any, hookTypes: string, options: any) {
  if (!plan.bindings || plan.bindings.length === 0) return plan;
  
  logger.step('🛡️', 'Proactive Audit: Checking data shape alignment...');

  const auditPrompt = `
    You are a technical code auditor. I am binding a React component to a real API.
    
    SOURCE CODE:
    ${sourceCode}

    API HOOK DEFINITIONS:
    ${hookTypes.slice(0, 8000)}

    PLANNED BINDINGS:
    ${JSON.stringify(plan.bindings, null, 2)}

    TASK:
    1. Verify if the hook return type (e.g. { data: T }) matches the mock usage (e.g. mock.map).
    2. IMPORTANT: Orval/Axios hooks return an object where the real data is often in a nested "data" property. 
       If the UI does "mock.map", but the hook returns "{ data: T[] }", you MUST add a transformer: "(data) => data.data".
    3. Ensure hook names and import paths are exactly as defined in the API definitions.

    RETURN THE UPDATED BINDING PLAN AS JSON ONLY.
  `;

  try {
    const response = await callLLM(auditPrompt, options.llm);
    
    // Robust JSON extraction: Find the first { and the last }
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("No JSON object found in auditor response.");
    }
    
    const cleaned = response.substring(firstBrace, lastBrace + 1);
    const auditedPlan = JSON.parse(cleaned);
    
    if (!auditedPlan.bindings) {
        logger.warning("Auditor returned invalid structure. Reverting to initial plan.");
        return plan;
    }
    
    return auditedPlan;
  } catch (err) {
    logger.warning(`Audit failed to parse: ${(err as Error).message}. Proceeding with initial plan.`);
    return plan;
  }
}
