import { describe, it, expect } from 'vitest';
import { formatRelativeTime, mapFeedRow, groupFeed } from '../../src/client/feed';
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
      articleId: 'a2', title: 'T2', url: 'u2', summary: '', sourceTitle: 'S2', sourceType: 'hackernews', publishedAt: null,
    });
  });
});

const fi = (id: string, sourceType: FeedItem['sourceType'], publishedAt: string | null): FeedItem => ({
  articleId: id, title: id, url: 'u', summary: 's', sourceTitle: 't', sourceType, publishedAt,
});

describe('groupFeed', () => {
  it('splits paid (email) from the rest and sorts each newest-first', () => {
    const items = [
      fi('hn-old', 'hackernews', '2026-06-10T00:00:00.000Z'),
      fi('paid-new', 'email', '2026-06-16T00:00:00.000Z'),
      fi('hn-new', 'hackernews', '2026-06-15T00:00:00.000Z'),
      fi('paid-old', 'email', '2026-06-12T00:00:00.000Z'),
    ];
    const { paid, hackerNews } = groupFeed(items);
    expect(paid.map((i) => i.articleId)).toEqual(['paid-new', 'paid-old']);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['hn-new', 'hn-old']);
  });
  it('sorts null dates last', () => {
    const { hackerNews } = groupFeed([
      fi('a', 'hackernews', null),
      fi('b', 'hackernews', '2026-06-15T00:00:00.000Z'),
    ]);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['b', 'a']);
  });
});
