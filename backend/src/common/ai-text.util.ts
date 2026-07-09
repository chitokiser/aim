import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ANTHROPIC_MODEL = 'claude-opus-4-8';

export interface AiKeys {
  geminiKey?: string;
  anthropicKey?: string;
}

function isConfigured(key: string | undefined, placeholder: string): key is string {
  return Boolean(key) && key !== placeholder;
}

export function hasAiProvider(keys: AiKeys): boolean {
  return isConfigured(keys.geminiKey, 'your-gemini-api-key') || isConfigured(keys.anthropicKey, 'your-anthropic-api-key');
}

// Prefers Gemini (genuinely free tier via Google AI Studio, no billing
// required) and falls back to Claude only if Gemini isn't configured or
// its call fails — keeps the blog/webzine AI features usable without a
// paid Anthropic balance.
export async function generateText(keys: AiKeys, prompt: string, maxTokens = 4096): Promise<string> {
  if (isConfigured(keys.geminiKey, 'your-gemini-api-key')) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys.geminiKey });
      const resp = await ai.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
      if (resp.text) return resp.text;
    } catch (err) {
      if (!isConfigured(keys.anthropicKey, 'your-anthropic-api-key')) throw err;
      console.warn('Gemini call failed, falling back to Claude:', err instanceof Error ? err.message : err);
    }
  }

  if (isConfigured(keys.anthropicKey, 'your-anthropic-api-key')) {
    const anthropic = new Anthropic({ apiKey: keys.anthropicKey });
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return resp.content[0].type === 'text' ? resp.content[0].text : '';
  }

  throw new Error('No AI provider configured — set GEMINI_API_KEY or ANTHROPIC_API_KEY');
}

export function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}
