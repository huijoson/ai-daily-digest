import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt, parseGeminiResponse, GEMINI_MODEL } from '../../src/pipeline/summarize';

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
