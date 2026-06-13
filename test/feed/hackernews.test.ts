import { describe, it, expect } from 'vitest';
import { parseHackerNewsStories } from '../../src/feed/hackernews';
import type { HnItem } from '../../src/feed/types';

const items: HnItem[] = [
  { id: 1, title: 'A Story', url: 'https://ex.com/a', time: 1749549600, type: 'story' },
  { id: 2, title: 'Ask HN: Something', time: 1749549601, type: 'story' }, // no url
  { id: 3, title: 'A Comment', time: 1749549602, type: 'comment' },        // wrong type
  { id: 4, time: 1749549603, type: 'story' },                              // no title
];

describe('parseHackerNewsStories', () => {
  it('keeps only stories that have a title', () => {
    const out = parseHackerNewsStories(items);
    expect(out.map((a) => a.guid)).toEqual(['hn:1', 'hn:2']);
  });

  it('uses a stable guid and falls back to the HN item URL', () => {
    const out = parseHackerNewsStories(items);
    expect(out[0].url).toBe('https://ex.com/a');
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=2');
  });

  it('converts unix time to an ISO date', () => {
    const out = parseHackerNewsStories(items);
    expect(out[0].publishedAt).toBe('2025-06-10T10:00:00.000Z');
  });
});
