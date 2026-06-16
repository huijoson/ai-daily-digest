import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt, parseGeminiResponse, GEMINI_MODEL, createGeminiSummarizer, buildGeminiContents } from '../../src/pipeline/summarize';

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

  it('instructs the model to summarize in the article\'s own language', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p.toLowerCase()).toContain('same language');
  });

  it('brief mode (default) asks for 2-3 sentences', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p).toContain('2-3');
    expect(p.toLowerCase()).toContain('same language');
  });

  it('analysis mode asks for bullets and an analysis paragraph', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' }, 'analysis');
    expect(p.toLowerCase()).toContain('bullet');
    expect(p.toLowerCase()).toContain('analysis');
    expect(p.toLowerCase()).toContain('same language');
  });

  it('analysis + hasImages tells the model figures are attached', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' }, 'analysis', true);
    expect(p.toLowerCase()).toContain('attached');
    expect(p.toLowerCase()).toContain('figures');
  });

  it('hasImages=false leaves the prompt unchanged', () => {
    const withFlag = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' }, 'analysis', false);
    const without = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' }, 'analysis');
    expect(withFlag).toBe(without);
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

describe('buildGeminiContents', () => {
  it('returns just the text part when there are no images', () => {
    expect(buildGeminiContents('hello', [])).toEqual([{ text: 'hello' }]);
  });
  it('appends one inline_data part per image', () => {
    const parts = buildGeminiContents('p', [
      { mimeType: 'image/png', base64: 'AAA' },
      { mimeType: 'image/jpeg', base64: 'BBB' },
    ]);
    expect(parts).toEqual([
      { text: 'p' },
      { inline_data: { mime_type: 'image/png', data: 'AAA' } },
      { inline_data: { mime_type: 'image/jpeg', data: 'BBB' } },
    ]);
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
    const result = await summarize({ title: 'T', url: 'u', content: 'c', sourceType: 'hackernews' });
    expect(result).toEqual({ text: 'Summed.', model: 'gemini-2.5-flash' });
    expect(calls[0].url).toContain('gemini-2.5-flash');
    expect(calls[0].url).toContain('KEY');
  });

  it('throws on a non-ok HTTP status (so the caller can mark it failed)', async () => {
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async () => ({ ok: false, status: 429, json: async () => ({}) }) as any,
    });
    await expect(summarize({ title: 'T', url: 'u', content: 'c', sourceType: 'hackernews' })).rejects.toThrow('429');
  });

  it('uses analysis mode for email sources', async () => {
    let sentBody: any;
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async (_url, body) => {
        sentBody = body;
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) } as any;
      },
    });
    await summarize({ title: 'T', url: 'u', content: 'c', sourceType: 'email' });
    const promptText = sentBody.contents[0].parts[0].text.toLowerCase();
    expect(promptText).toContain('bullet');
  });
});

import { MAX_ARTICLE_IMAGES } from '../../src/pipeline/constants';

describe('createGeminiSummarizer multimodal', () => {
  const okJson = async () => ({ candidates: [{ content: { parts: [{ text: 'sum' }] } }] });
  const hasInline = (body: any) => body.contents[0].parts.some((p: any) => p.inline_data);

  it('sends inline_data parts for an email article with images', async () => {
    let body: any;
    const s = createGeminiSummarizer({
      apiKey: 'K',
      httpPostJson: async (_u, b) => { body = b; return { ok: true, status: 200, json: okJson } as any; },
      fetchImage: async () => ({ mimeType: 'image/png', base64: 'AAA' }),
    });
    await s({ title: 't', url: 'u', content: 'c', sourceType: 'email', imageUrls: ['x', 'y'] });
    expect(hasInline(body)).toBe(true);
    expect(body.contents[0].parts.filter((p: any) => p.inline_data)).toHaveLength(2);
  });

  it('skips images that fetch as null', async () => {
    let body: any;
    let n = 0;
    const s = createGeminiSummarizer({
      apiKey: 'K',
      httpPostJson: async (_u, b) => { body = b; return { ok: true, status: 200, json: okJson } as any; },
      fetchImage: async () => (++n === 1 ? null : { mimeType: 'image/png', base64: 'AAA' }),
    });
    await s({ title: 't', url: 'u', content: 'c', sourceType: 'email', imageUrls: ['a', 'b'] });
    expect(body.contents[0].parts.filter((p: any) => p.inline_data)).toHaveLength(1);
  });

  it('does not abort when fetchImage throws (treats as skip)', async () => {
    let body: any;
    const s = createGeminiSummarizer({
      apiKey: 'K',
      httpPostJson: async (_u, b) => { body = b; return { ok: true, status: 200, json: okJson } as any; },
      fetchImage: async () => { throw new Error('boom'); },
    });
    const r = await s({ title: 't', url: 'u', content: 'c', sourceType: 'email', imageUrls: ['a'] });
    expect(r.text).toBe('sum');
    expect(hasInline(body)).toBe(false); // all images skipped -> text-only
  });

  it('is text-only for non-email or empty images, and does not call fetchImage', async () => {
    let body: any; let fetched = 0;
    const s = createGeminiSummarizer({
      apiKey: 'K',
      httpPostJson: async (_u, b) => { body = b; return { ok: true, status: 200, json: okJson } as any; },
      fetchImage: async () => { fetched++; return { mimeType: 'image/png', base64: 'A' }; },
    });
    await s({ title: 't', url: 'u', content: 'c', sourceType: 'hackernews', imageUrls: ['a'] });
    expect(fetched).toBe(0);
    expect(hasInline(body)).toBe(false);
  });

  it('falls back to a text-only request when the multimodal request fails', async () => {
    const bodies: any[] = [];
    const s = createGeminiSummarizer({
      apiKey: 'K',
      httpPostJson: async (_u, b) => {
        bodies.push(b);
        const multimodal = (b as any).contents[0].parts.some((p: any) => p.inline_data);
        if (multimodal) return { ok: false, status: 400, json: async () => ({}) } as any; // reject multimodal
        return { ok: true, status: 200, json: okJson } as any; // text-only succeeds
      },
      fetchImage: async () => ({ mimeType: 'image/png', base64: 'AAA' }),
    });
    const r = await s({ title: 't', url: 'u', content: 'c', sourceType: 'email', imageUrls: ['a'] });
    expect(r.text).toBe('sum');
    expect(bodies).toHaveLength(2); // tried multimodal, then text-only
    expect(bodies[1].contents[0].parts.some((p: any) => p.inline_data)).toBe(false);
  });
});
