import { z } from 'zod';
import { logger } from '../utils/logger.js';

const bindingSchema = z.object({
  mockName: z.string(),
  hookName: z.string(),
  confidence: z.number().min(0).max(1),
  transformer: z.string().nullable(),
  loadingStrategy: z.enum(['early-return-skeleton', 'inline-conditional', 'suspense']),
  errorStrategy: z.enum(['early-return-error', 'toast', 'ignore']),
});

const planSchema = z.object({
  bindings: z.array(bindingSchema),
  importsToRemove: z.array(z.string()),
  importsToAdd: z.array(z.string()),
});

export type BindingPlan = z.infer<typeof planSchema>;

export function parseBindingPlan(rawResponse: string): BindingPlan {
  let jsonStr = rawResponse.trim();
  
  // Strip markdown fences
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) jsonStr = fenced[1];
  
  // Find first JSON object
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in LLM response');
  }
  jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    logger.error(`JSON parse failed. Raw: ${jsonStr.slice(0, 200)}`);
    throw new Error(`Invalid JSON from LLM: ${(err as Error).message}`);
  }
  
  const result = planSchema.safeParse(parsed);
  if (!result.success) {
    logger.error(`Schema validation failed: ${result.error.message}`);
    throw new Error(`LLM response schema invalid: ${result.error.errors.map(e => e.path.join('.')).join(', ')}`);
  }
  
  return result.data;
}

export type { BindingPlan } from './responseParser.js';