import { describe, it, expect } from 'vitest';
import { fetchSource } from '../../src/pipeline/fetch-source';
import type { SourceRow } from '../../src/pipeline/types';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>X</title>
  <item><title>One</title><link>https://x.com/1</link><guid>g1</guid></item>
</channel></rss>`;

describe('fetchSource', () => {
  it('fetches and parses an rss/youtube source from its feed_url', async () => {
    const source: SourceRow = { id: 's1', type: 'rss', feedUrl: 'https://x.com/feed' };
    const seen: string[] = [];
    const httpGet = async (url: string) => { seen.push(url); return RSS; };
    const out = await fetchSource(source, httpGet);
    expect(seen).toEqual(['https://x.com/feed']);
    expect(out.map((a) => a.guid)).toEqual(['g1']);
  });

  it('throws when an rss source has no feed_url', async () => {
    const source: SourceRow = { id: 's1', type: 'rss', feedUrl: null };
    await expect(fetchSource(source, async () => '')).rejects.toThrow();
  });

  it('fetches Hacker News top stories then their items', async () => {
    const source: SourceRow = { id: 'hn', type: 'hackernews', feedUrl: null };
    const httpGet = async (url: string) => {
      if (url.includes('topstories')) return JSON.stringify([11, 12]);
      if (url.includes('/item/11')) return JSON.stringify({ id: 11, title: 'A', url: 'https://a', time: 1700000000, type: 'story' });
      if (url.includes('/item/12')) return JSON.stringify({ id: 12, title: 'B', time: 1700000001, type: 'story' });
      throw new Error('unexpected url ' + url);
    };
    const out = await fetchSource(source, httpGet);
    expect(out.map((a) => a.guid)).toEqual(['hn:11', 'hn:12']);
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=12');
  });
});
