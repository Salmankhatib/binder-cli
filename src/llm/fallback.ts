import axios from 'axios';
import { logger } from '../utils/logger.js';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface LLMPrediction {
    hookName: string;
    confidence: number;
    reasoning: string;
}

export class OllamaFallback {
    private config: any;

    constructor(config: any) {
        this.config = config || { enabled: false };
    }

    async predictHook(mockName: string, snippet: string, availableHooks: string[], projectContext?: any): Promise<LLMPrediction | null> {
        if (!this.config.enabled) {
            return null; // Silently skip if LLM is disabled
        }

        // 1. Repo Awareness: Load Context.txt
        let repoContext = "No custom repository context provided.";
        const contextPath = resolve(process.cwd(), 'Context.txt');
        if (existsSync(contextPath)) {
            repoContext = readFileSync(contextPath, 'utf-8');
        }

        // 2. Memory/Cache Access
        let cacheData = "No previous successful bindings found.";
        const cachePath = resolve(process.cwd(), '.binder', 'cache.json');
        if (existsSync(cachePath)) {
            cacheData = readFileSync(cachePath, 'utf-8');
        }

        const prompt = `
You are an expert React developer acting as an autonomous assistant for Binder.
Your job is to match a frontend mock variable to the correct backend API hook.

--- REPOSITORY CONTEXT ---
${repoContext}

--- PREVIOUS BINDING CACHE ---
These mappings were previously confirmed by the user in this project:
${cacheData}

--- CURRENT TASK ---
We are replacing the following mock data:
Name: ${mockName}
Snippet:
${snippet}

Available Hooks:
${availableHooks.join('\n')}

Which of the available hooks is the most likely replacement for this mock data?
Return your answer in strictly valid JSON format like this:
{
  "hookName": "useGetUsersQuery",
  "confidence": 0.85,
  "reasoning": "Because it's named mockUsers and is an array."
}
Only output JSON. Do not output anything else.`;

        try {
            const provider = this.config.provider || 'ollama';
            const model = this.config.model || 'llama3';
            let parsed: any = null;

            if (provider === 'ollama') {
                const endpoint = this.config.host || 'http://localhost:11434/api/generate';
                const response = await axios.post(endpoint, {
                    model: model,
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                });
                if (response.data?.response) {
                    parsed = JSON.parse(response.data.response);
                }
            } else if (provider === 'openai') {
                const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: "json_object" }
                }, {
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
                });
                parsed = JSON.parse(response.data.choices[0].message.content);
            } else if (provider === 'anthropic') {
                const response = await axios.post('https://api.anthropic.com/v1/messages', {
                    model: model,
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }]
                }, {
                    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
                });
                // Anthropic doesn't have strict JSON mode yet, requires parsing
                const text = response.data.content[0].text;
                const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
                parsed = JSON.parse(jsonStr);
            } else if (provider === 'google') {
                const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                });
                const text = response.data.candidates[0].content.parts[0].text;
                parsed = JSON.parse(text);
            } else if (provider === 'deepseek') {
                const response = await axios.post('https://api.deepseek.com/chat/completions', {
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: "json_object" }
                }, {
                    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
                });
                parsed = JSON.parse(response.data.choices[0].message.content);
            }

            if (parsed && availableHooks.includes(parsed.hookName)) {
                return parsed as LLMPrediction;
            }
        } catch (e: any) {
            logger.system(`LLM fallback (${this.config.provider}) failed: ${e.message}`);
        }
        return null;
    }
}
