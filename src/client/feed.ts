import type { FeedItem } from './types';

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
    publishedAt: article?.published_at ?? null,
  };
}
