import type { FeedItem } from './types';
import { MAX_PAID_ITEMS } from './constants';
import { HN_MAX_AGE_MS } from '../pipeline/constants';

export function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function mapFeedRow(row: any): FeedItem {
  const article = one<any>(row.articles);
  const source = one<any>(article?.sources);
  return {
    articleId: row.article_id,
    title: article?.title ?? '',
    url: article?.url ?? '',
    summary: row.summary_text ?? '',
    sourceTitle: source?.title ?? '',
    sourceType: source?.type ?? 'rss',
    imageUrls: article?.image_urls ?? [],
    publishedAt: article?.published_at ?? null,
  };
}

export function groupFeed(items: FeedItem[], now: number): { paid: FeedItem[]; hackerNews: FeedItem[] } {
  const byTimeDesc = (a: FeedItem, b: FeedItem) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
    return tb - ta;
  };
  const paid = items.filter((i) => i.sourceType === 'email').sort(byTimeDesc).slice(0, MAX_PAID_ITEMS);
  const hackerNews = items
    .filter((i) => i.sourceType !== 'email')
    .filter((i) => {
      if (i.sourceType !== 'hackernews') return true; // only HN is recency-bounded
      if (!i.publishedAt) return false;
      const t = new Date(i.publishedAt).getTime();
      return !Number.isNaN(t) && now - t <= HN_MAX_AGE_MS;
    })
    .sort(byTimeDesc);
  return { paid, hackerNews };
}
