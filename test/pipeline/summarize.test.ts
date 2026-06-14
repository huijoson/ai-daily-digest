import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt, parseGeminiResponse, GEMINI_MODEL, createGeminiSummarizer } from '../../src/pipeline/summarize';

describe('buildSummaryPrompt', () => {
  it('includes the title and url', () => {
    const p = buildSummaryPrompt({ title: 'Hello', url: 'https://x.com/a', content: 'Body text.' });
    expect(p).toContain('Hello');
    expect(p).toContain('https://x.com/a');
    expect(p).toContain('Body text.');
  });

  it('falls back gracefully when content is null', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: null });
    expect(p).toContain('T');
    expect(p.toLowerCase()).toContain('no content');
  });
});

describe('parseGeminiResponse', () => {
  it('extracts the candidate text', () => {
    const json = { candidates: [{ content: { parts: [{ text: '  A summary.  ' }] } }] };
    expect(parseGeminiResponse(json)).toBe('A summary.');
  });

  it('throws when no text is present', () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow();
    expect(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: '   ' }] } }] })).toThrow();
  });
});

describe('GEMINI_MODEL', () => {
  it('is a non-empty model id', () => {
    expect(typeof GEMINI_MODEL).toBe('string');
    expect(GEMINI_MODEL.length).toBeGreaterThan(0);
  });
});

describe('createGeminiSummarizer', () => {
  const okResponse = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'Summed.' }] } }] }),
  };

  it('returns the summary text and the model id on success', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async (url, body) => {
        calls.push({ url, body });
        return okResponse as any;
      },
    });
    const result = await summarize({ title: 'T', url: 'u', content: 'c' });
    expect(result).toEqual({ text: 'Summed.', model: 'gemini-2.5-flash' });
    expect(calls[0].url).toContain('gemini-2.5-flash');
    expect(calls[0].url).toContain('KEY');
  });

  it('throws on a non-ok HTTP status (so the caller can mark it failed)', async () => {
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async () => ({ ok: false, status: 429, json: async () => ({}) }) as any,
    });
    await expect(summarize({ title: 'T', url: 'u', content: 'c' })).rejects.toThrow('429');
  });
});
