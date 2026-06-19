import { describe, it, expect } from 'vitest';
import { formatRelativeTime, mapFeedRow, buildFeedSections, neighbors, scrollFailureOffset } from '../../src/client/feed';
import { MAX_PAID_ITEMS } from '../../src/client/constants';
import { HN_MAX_AGE_MS } from '../../src/pipeline/constants';
import type { FeedItem } from '../../src/client/types';

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-14T12:00:00.000Z').getTime();
  it('shows "just now" under a minute', () => {
    expect(formatRelativeTime('2026-06-14T11:59:30.000Z', now)).toBe('just now');
  });
  it('shows minutes', () => {
    expect(formatRelativeTime('2026-06-14T11:45:00.000Z', now)).toBe('15m ago');
  });
  it('shows hours', () => {
    expect(formatRelativeTime('2026-06-14T09:00:00.000Z', now)).toBe('3h ago');
  });
  it('shows days', () => {
    expect(formatRelativeTime('2026-06-12T12:00:00.000Z', now)).toBe('2d ago');
  });
  it('returns empty string for a null date', () => {
    expect(formatRelativeTime(null, now)).toBe('');
  });
});

describe('mapFeedRow', () => {
  it('maps a joined summary row to a FeedItem', () => {
    const row = {
      article_id: 'a1',
      summary_text: 'A summary.',
      articles: {
        title: 'Title',
        url: 'https://x/1',
        published_at: '2026-06-14T09:00:00.000Z',
        image_urls: ['https://cdn/img1.png'],
        sources: { title: 'Lenny', type: 'email' },
      },
    };
    expect(mapFeedRow(row)).toEqual({
      articleId: 'a1',
      title: 'Title',
      url: 'https://x/1',
      summary: 'A summary.',
      sourceTitle: 'Lenny',
      sourceType: 'email',
      imageUrls: ['https://cdn/img1.png'],
      publishedAt: '2026-06-14T09:00:00.000Z',
    });
  });
  it('handles the embed arriving as a one-element array and missing fields', () => {
    const row = {
      article_id: 'a2',
      summary_text: null,
      articles: [{ title: 'T2', url: 'u2', published_at: null, sources: [{ title: 'S2', type: 'hackernews' }] }],
    };
    expect(mapFeedRow(row)).toEqual({
      articleId: 'a2', title: 'T2', url: 'u2', summary: '', sourceTitle: 'S2', sourceType: 'hackernews', imageUrls: [], publishedAt: null,
    });
  });
});

const fi = (
  id: string,
  sourceType: FeedItem['sourceType'],
  publishedAt: string | null,
  sourceTitle = 't',
): FeedItem => ({
  articleId: id, title: id, url: 'u', summary: 's', sourceTitle, sourceType, imageUrls: [], publishedAt,
});

const NOW = new Date('2026-06-19T12:00:00.000Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('buildFeedSections', () => {
  it('makes one section per email sourceTitle, capped to MAX_PAID_ITEMS, newest-first', () => {
    const items = [
      fi('a-old', 'email', iso(NOW - 5000), 'Lenny'),
      fi('a-new', 'email', iso(NOW - 1000), 'Lenny'),
      fi('a-mid', 'email', iso(NOW - 3000), 'Lenny'),
      fi('a-older', 'email', iso(NOW - 7000), 'Lenny'),
    ];
    const sections = buildFeedSections(items, NOW);
    expect(sections).toHaveLength(1);
    const [s] = sections;
    expect(s.key).toBe('email:Lenny');
    expect(s.title).toBe('📧 Lenny');
    expect(s.data).toHaveLength(MAX_PAID_ITEMS);
    expect(s.data.map((i) => i.articleId)).toEqual(['a-new', 'a-mid', 'a-old']);
  });

  it('does not starve a second email source by the first', () => {
    const items = [
      fi('l1', 'email', iso(NOW - 1000), 'Lenny'),
      fi('l2', 'email', iso(NOW - 2000), 'Lenny'),
      fi('l3', 'email', iso(NOW - 3000), 'Lenny'),
      fi('l4', 'email', iso(NOW - 4000), 'Lenny'),
      fi('s1', 'email', iso(NOW - 5000), 'Stratechery'),
    ];
    const sections = buildFeedSections(items, NOW);
    const lenny = sections.find((sec) => sec.key === 'email:Lenny');
    const strat = sections.find((sec) => sec.key === 'email:Stratechery');
    expect(lenny?.data.map((i) => i.articleId)).toEqual(['l1', 'l2', 'l3']);
    expect(strat?.title).toBe('📧 Stratechery');
    expect(strat?.data.map((i) => i.articleId)).toEqual(['s1']);
  });

  it('sorts items within a section newest-first with null dates last', () => {
    const items = [
      fi('b', 'email', iso(NOW - 2000), 'Lenny'),
      fi('n', 'email', null, 'Lenny'),
      fi('a', 'email', iso(NOW - 1000), 'Lenny'),
    ];
    const [s] = buildFeedSections(items, NOW);
    expect(s.data.map((i) => i.articleId)).toEqual(['a', 'b', 'n']);
  });

  it('makes a single hackernews section bounded to HN_MAX_AGE_MS, dropping older and undated HN', () => {
    const items = [
      fi('recent', 'hackernews', iso(NOW - 1000)),
      fi('old', 'hackernews', iso(NOW - HN_MAX_AGE_MS - 1000)),
      fi('undated', 'hackernews', null),
    ];
    const sections = buildFeedSections(items, NOW);
    const hn = sections.find((sec) => sec.key === 'hackernews');
    expect(hn?.title).toBe('🟠 Hacker News');
    expect(hn?.data.map((i) => i.articleId)).toEqual(['recent']);
  });

  it('does not recency-bound rss sources (an old rss item still appears)', () => {
    const items = [fi('oldrss', 'rss', iso(NOW - HN_MAX_AGE_MS - 5000), 'My Blog')];
    const sections = buildFeedSections(items, NOW);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('rss:My Blog');
    expect(sections[0].title).toBe('My Blog');
    expect(sections[0].data.map((i) => i.articleId)).toEqual(['oldrss']);
  });

  it('orders non-HN sections by newest item desc, with Hacker News always last', () => {
    const items = [
      fi('rss-old', 'rss', iso(NOW - 10_000), 'Old Blog'),
      fi('email-fresh', 'email', iso(NOW - 1000), 'Fresh'),
      fi('hn1', 'hackernews', iso(NOW - 500)), // newest overall, but HN goes last
    ];
    const sections = buildFeedSections(items, NOW);
    expect(sections.map((sec) => sec.key)).toEqual(['email:Fresh', 'rss:Old Blog', 'hackernews']);
  });

  it('omits empty sections (HN with only stale items disappears)', () => {
    const items = [
      fi('hn-old', 'hackernews', iso(NOW - HN_MAX_AGE_MS - 1000)),
      fi('e1', 'email', iso(NOW - 1000), 'Lenny'),
    ];
    const sections = buildFeedSections(items, NOW);
    expect(sections.map((sec) => sec.key)).toEqual(['email:Lenny']);
    expect(sections.some((sec) => sec.key === 'hackernews')).toBe(false);
  });

  it('each section has { key, title, data }', () => {
    const [s] = buildFeedSections([fi('e1', 'email', iso(NOW - 1000), 'Lenny')], NOW);
    expect(Object.keys(s).sort()).toEqual(['data', 'key', 'title']);
    expect(typeof s.key).toBe('string');
    expect(typeof s.title).toBe('string');
    expect(Array.isArray(s.data)).toBe(true);
  });
});

describe('neighbors', () => {
  it('returns both neighbors for a middle element', () => {
    expect(neighbors(['a', 'b', 'c'], 'b')).toEqual({ prevId: 'a', nextId: 'c' });
  });

  it('returns null prevId for the first element', () => {
    expect(neighbors(['a', 'b', 'c'], 'a')).toEqual({ prevId: null, nextId: 'b' });
  });

  it('returns null nextId for the last element', () => {
    expect(neighbors(['a', 'b', 'c'], 'c')).toEqual({ prevId: 'b', nextId: null });
  });

  it('returns both null when the id is not in the list', () => {
    expect(neighbors(['a', 'b', 'c'], 'z')).toEqual({ prevId: null, nextId: null });
  });

  it('returns both null for a single-element list', () => {
    expect(neighbors(['a'], 'a')).toEqual({ prevId: null, nextId: null });
  });

  it('returns both null for an empty list', () => {
    expect(neighbors([], 'a')).toEqual({ prevId: null, nextId: null });
  });

  it('uses the first occurrence of a duplicated id', () => {
    expect(neighbors(['a', 'b', 'a', 'c'], 'a')).toEqual({ prevId: null, nextId: 'b' });
  });
});

describe('scrollFailureOffset', () => {
  it('multiplies averageItemLength by index', () => {
    expect(scrollFailureOffset({ averageItemLength: 80, index: 5 })).toBe(400);
  });

  it('returns 0 for a zero index', () => {
    expect(scrollFailureOffset({ averageItemLength: 80, index: 0 })).toBe(0);
  });

  it('returns 0 when averageItemLength is NaN', () => {
    expect(scrollFailureOffset({ averageItemLength: NaN, index: 3 })).toBe(0);
  });

  it('returns 0 when averageItemLength is missing', () => {
    expect(scrollFailureOffset({ index: 3 })).toBe(0);
  });

  it('returns 0 when index is missing', () => {
    expect(scrollFailureOffset({ averageItemLength: 80 })).toBe(0);
  });
});
