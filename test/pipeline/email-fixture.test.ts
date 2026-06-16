import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractImageUrls } from '../../src/pipeline/email';

const html = readFileSync(new URL('../fixtures/fomo-email.html', import.meta.url), 'utf8');

describe('extractImageUrls on a real FOMO delivery email', () => {
  const urls = extractImageUrls(html);
  it('returns exactly the 7 content charts', () => {
    expect(urls).toHaveLength(7);
  });
  it('keeps only substackcdn content images, no chrome', () => {
    for (const u of urls) {
      expect(u).toContain('substackcdn.com/image/');
      expect(u).not.toMatch(/c_fill|g_face|g_auto/);
      expect(u).not.toMatch(/eotrx|email\.mg1|\/o\//);
      const w = /[/,]w_(\d+)/.exec(u);
      if (w) expect(Number(w[1])).toBeGreaterThanOrEqual(400);
    }
  });
});
