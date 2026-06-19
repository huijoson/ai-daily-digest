import { describe, it, expect } from 'vitest';
import { formatRelativeTime, mapFeedRow, groupFeed } from '../../src/client/feed';
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

const fi = (id: string, sourceType: FeedItem['sourceType'], publishedAt: string | null): FeedItem => ({
  articleId: id, title: id, url: 'u', summary: 's', sourceTitle: 't', sourceType, imageUrls: [], publishedAt,
});

const NOW = new Date('2026-06-19T12:00:00.000Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('groupFeed', () => {
  it('splits paid (email) from the rest and sorts each newest-first', () => {
    // Use dates within 24h of NOW so HN items are not recency-filtered
    const items = [
      fi('hn-old', 'hackernews', iso(NOW - HN_MAX_AGE_MS + 60_000)),
      fi('paid-new', 'email', iso(NOW - 1000)),
      fi('hn-new', 'hackernews', iso(NOW - 2000)),
      fi('paid-old', 'email', iso(NOW - 2000)),
    ];
    const { paid, hackerNews } = groupFeed(items, NOW);
    expect(paid.map((i) => i.articleId)).toEqual(['paid-new', 'paid-old']);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['hn-new', 'hn-old']);
  });
  it('sorts null dates last', () => {
    const { hackerNews } = groupFeed([
      fi('a', 'rss', null),
      fi('b', 'rss', iso(NOW - 2000)),
    ], NOW);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['b', 'a']);
  });
});

describe('groupFeed (recency + paid cap)', () => {
  it('caps paid to the latest MAX_PAID_ITEMS, newest-first', () => {
    const items = [
      fi('p1', 'email', iso(NOW - 1000)),
      fi('p2', 'email', iso(NOW - 2000)),
      fi('p3', 'email', iso(NOW - 3000)),
      fi('p4', 'email', iso(NOW - 4000)),
    ];
    const { paid } = groupFeed(items, NOW);
    expect(paid.map((i) => i.articleId)).toEqual(['p1', 'p2', 'p3'].slice(0, MAX_PAID_ITEMS));
    expect(paid).toHaveLength(MAX_PAID_ITEMS);
  });
  it('keeps HN within 24h, drops older and undated HN', () => {
    const items = [
      fi('recent', 'hackernews', iso(NOW - 1000)),
      fi('old', 'hackernews', iso(NOW - HN_MAX_AGE_MS - 1000)),
      fi('undated', 'hackernews', null),
    ];
    const { hackerNews } = groupFeed(items, NOW);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['recent']);
  });
  it('does not recency-filter non-email non-HN sources (rss)', () => {
    const items = [fi('oldrss', 'rss', iso(NOW - HN_MAX_AGE_MS - 5000))];
    const { hackerNews } = groupFeed(items, NOW);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['oldrss']);
  });
});
