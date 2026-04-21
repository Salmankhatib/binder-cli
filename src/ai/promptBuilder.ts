import type { MockFinding } from '../scan/mockScanner.js';

export interface HookSignature {
  name: string;
  method: string;
  path: string;
  responseType: string;
  params?: Array<{ name: string; type: string; required: boolean }>;
}

export function buildMatchingPrompt(
  sourceFile: string,
  mocks: MockFinding[],
  hooks: HookSignature[],
  mockUsages: string[]
): string {
  const hooksBlock = hooks.map(h => {
    const params = h.params?.map(p => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ') || '';
    return `- ${h.name}(${params}) → { data: ${h.responseType}, isLoading: boolean, error: Error | null } [${h.method.toUpperCase()} ${h.path}]`;
  }).join('\n');

  const mocksBlock = mocks.map(m => {
    let shape = '';
    if (m.inferredShape) {
      shape = `\n  Inferred shape: ${JSON.stringify(m.inferredShape)}`;
    }
    return `- ${m.name} (found at line ${m.line}, type: ${m.type})${shape}\n  Code: ${m.snippet}`;
  }).join('\n');

  const usageBlock = mockUsages.join('\n');

  return `You are a code binding engine. Your job is to match frontend mock data variables to backend API hooks.

SOURCE FILE: ${sourceFile}

AVAILABLE API HOOKS (auto-generated from OpenAPI schema):
${hooksBlock}

MOCK VARIABLES FOUND IN FILE:
${mocksBlock}

HOW MOCKS ARE USED IN JSX/COMPONENT:
${usageBlock}

TASK:
For each mock variable, determine which API hook should replace it.

RULES:
1. Match by semantic meaning, not just name similarity
2. If the mock is an array used in a table/list, it likely maps to a GET /list endpoint
3. If the mock is a single object used in a form, it likely maps to a GET /detail or POST endpoint
4. Consider the response type: if the hook returns Sale[] and the mock is sales data, that's a match
5. If shapes differ slightly (e.g., total_amount vs amount), note that a transformer is needed

TRANSFORMER RULES:
- Write as a TypeScript arrow function: (apiData) => ({ ... })
- Map snake_case API fields to camelCase if the mock uses camelCase
- Rename fields if names differ (e.g., total_amount → amount)
- If no transformation needed, return null

OUTPUT STRICT JSON (no markdown, no explanation):
{
  "bindings": [
    {
      "mockName": "MOCK_SALES",
      "hookName": "useGetSales",
      "confidence": 0.95,
      "transformer": "(data) => data.map(s => ({ id: s.id, amount: s.total_amount, date: s.transaction_date, customer: s.customer_name, region: s.region }))",
      "loadingStrategy": "early-return-skeleton",
      "errorStrategy": "early-return-error"
    }
  ],
  "importsToRemove": ["import { MOCK_SALES } from '../mocks';"],
  "importsToAdd": ["import { useGetSales } from '../generated/hooks';"]
}

loadingStrategy options: "early-return-skeleton", "inline-conditional", "suspense"
errorStrategy options: "early-return-error", "toast", "ignore"

Respond with ONLY the JSON object.`;
}

export function buildRepairPrompt(
  rewrittenCode: string,
  failureReport: string
): string {
  return `You are a Senior TypeScript Engineer specialized in React and TanStack Query (React Query) v5.
Your task is to fix a component that failed compilation after being bound to a real API.

### CONTEXT
REWRITTEN CODE (CONTAINS ERRORS):
\`\`\`tsx
${rewrittenCode}
\`\`\`

DIAGNOSTIC ERRORS:
${failureReport}

### CRITICAL INSTRUCTIONS
1. **ORVAL WRAPPER**: Orval often returns an object where the real data is in \`data.data\`. If you see "property map does not exist", check if you need to access \`.data\`.
2. **MUTATIONS**: In React Query v5, \`useMutation\` returns an object with \`isPending\`, NOT \`isLoading\`. Fix any usage of \`.isLoading\` on mutations.
3. **NO REDECLARATIONS**: Do not declare variables or functions that already exist. If you are injecting a hook with the same name as a mock, ensure the mock was removed or aliased.
4. **GUIDED FREEDOM**: You are encouraged to add new imports from the provided API definitions if needed, rename aliased variables for clarity, or wrap complex logic in \`useMemo\`. Do NOT change core component logic or delete UI.
5. **IMPORTS**: Use the exact names from the API definitions provided below.

### OUTPUT FORMAT
1. First, explain your reasoning (1-2 sentences).
2. Then, provide the COMPLETE fixed file in a backtick block.

Reasoning:
<your_reasoning>

\`\`\`tsx
<fixed_code>
\`\`\`
`;
}