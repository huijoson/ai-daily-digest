import type { Summarizer } from './types';

export const GEMINI_MODEL = 'gemini-2.0-flash';

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
