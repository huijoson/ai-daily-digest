import type { Summarizer } from './types';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export function buildSummaryPrompt(input: {
  title: string;
  url: string;
  content: string | null;
}): string {
  const body = input.content?.trim()
    ? input.content.trim()
    : '(no content provided; summarize based on the title and link)';
  return [
    'Summarize the following article in 2-3 concise sentences for a daily digest.',
    'Write the summary in the same language as the article.',
    'Be factual and neutral. Do not add any preamble or markdown.',
    '',
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    '',
    'Content:',
    body,
  ].join('\n');
}

export function parseGeminiResponse(json: unknown): string {
  const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Gemini response missing text');
  }
  return text.trim();
}

export interface GeminiDeps {
  apiKey: string;
  httpPostJson: (
    url: string,
    body: unknown,
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

export function createGeminiSummarizer(deps: GeminiDeps): Summarizer {
  return async (input) => {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${deps.apiKey}`;
    const body = { contents: [{ parts: [{ text: buildSummaryPrompt(input) }] }] };
    const res = await deps.httpPostJson(url, body);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const text = parseGeminiResponse(await res.json());
    return { text, model: GEMINI_MODEL };
  };
}
