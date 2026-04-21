import { logger } from '../utils/logger.js';

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'gemini';
  model: string;
  host?: string;
  temperature?: number;
}

interface LLMResponse {
  success: boolean;
  text: string;
  error?: string;
}

export async function callLLM(prompt: string, config: LLMConfig): Promise<string> {
  logger.step('🤖', `Calling LLM (${config.provider})`);

  let result: LLMResponse;

  if (config.provider === 'ollama') {
    result = await callOllama(prompt, config);
  } else if (config.provider === 'gemini') {
    result = await callGemini(prompt, config);
  } else if (config.provider === 'openai') {
    result = await callOpenAI(prompt, config);
  } else {
    throw new Error(`Unknown LLM provider: ${config.provider}`);
  }

  if (!result.success) {
    throw new Error(`LLM failed: ${result.error}`);
  }

  return result.text;
}

// ─── OLLAMA ───
async function callOllama(prompt: string, config: LLMConfig): Promise<LLMResponse> {
  const host = config.host || 'http://localhost:11434';
  
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        options: {
          temperature: config.temperature ?? 0.2,
          num_predict: 4096,
        },
      }),
    });

    if (!res.ok) {
      return { success: false, text: '', error: `Ollama HTTP ${res.status}: ${await res.text()}` };
    }

    const data = await res.json();
    return { success: true, text: data.response || '' };
  } catch (err) {
    return { success: false, text: '', error: `Ollama connection failed: ${(err as Error).message}` };
  }
}

// ─── GEMINI ───
async function callGemini(prompt: string, config: LLMConfig): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    return { success: false, text: '', error: 'GEMINI_API_KEY or GOOGLE_API_KEY not set in .env' };
  }

  const model = config.model || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: config.temperature ?? 0.2,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, text: '', error: `Gemini HTTP ${res.status}: ${errorText}` };
    }

    const data = await res.json();

    // SAFETY: Check the full path exists before accessing
    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      return { success: false, text: '', error: `Gemini returned no candidates: ${JSON.stringify(data)}` };
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts)) {
      return { success: false, text: '', error: `Gemini response missing content.parts: ${JSON.stringify(candidate)}` };
    }

    const text = candidate.content.parts.map((p: any) => p.text || '').join('');
    return { success: true, text };

  } catch (err) {
    return { success: false, text: '', error: `Gemini request failed: ${(err as Error).message}` };
  }
}

// ─── OPENAI ───
async function callOpenAI(prompt: string, config: LLMConfig): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { success: false, text: '', error: 'OPENAI_API_KEY not set in .env' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are a code binding engine. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.2,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, text: '', error: `OpenAI HTTP ${res.status}: ${errorText}` };
    }

    const data = await res.json();

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      return { success: false, text: '', error: `OpenAI returned no choices: ${JSON.stringify(data)}` };
    }

    const text = data.choices[0]?.message?.content || '';
    return { success: true, text };

  } catch (err) {
    return { success: false, text: '', error: `OpenAI request failed: ${(err as Error).message}` };
  }
}

// ─── RESPONSE PARSER ───
export function extractJSONFromMarkdown(response: string): unknown {
  if (!response || typeof response !== 'string') {
    throw new Error('LLM response is empty or not a string');
  }

  // Try fenced code block first
  const fencedMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch && fencedMatch[1]) {
    return JSON.parse(fencedMatch[1].trim());
  }

  // Try raw JSON object (find first { and last })
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = response.slice(firstBrace, lastBrace + 1);
    return JSON.parse(jsonStr);
  }

  throw new Error('No JSON found in LLM response');
}