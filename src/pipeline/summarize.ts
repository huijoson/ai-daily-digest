import type { Summarizer } from './types';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export function buildSummaryPrompt(
  input: { title: string; url: string; content: string | null },
  mode: 'brief' | 'analysis' = 'brief',
): string {
  const body = input.content?.trim()
    ? input.content.trim()
    : '(no content provided; summarize based on the title and link)';
  const instructions = mode === 'analysis'
    ? [
        'Summarize the following paid article for a daily digest.',
        'Write the summary in the same language as the article.',
        'Format (no preamble, no markdown headers): first one sentence stating the core takeaway,',
        'then 3-6 bullet points (each line starting with "- ") covering the key points,',
        'then one short paragraph of analysis and implications.',
        'Be factual; ground the analysis in the article.',
      ]
    : [
        'Summarize the following article in 2-3 concise sentences for a daily digest.',
        'Write the summary in the same language as the article.',
        'Be factual and neutral. Do not add any preamble or markdown.',
      ];
  return [...instructions, '', `Title: ${input.title}`, `URL: ${input.url}`, '', 'Content:', body].join('\n');
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
    const mode = input.sourceType === 'email' ? 'analysis' : 'brief';
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${deps.apiKey}`;
    const body = { contents: [{ parts: [{ text: buildSummaryPrompt(input, mode) }] }] };
    const res = await deps.httpPostJson(url, body);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const text = parseGeminiResponse(await res.json());
    return { text, model: GEMINI_MODEL };
  };
}
