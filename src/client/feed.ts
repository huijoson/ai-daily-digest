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

/**
 * Find the prev/next neighbors of `currentId` within an ordered list of ids.
 * Uses the first occurrence (indexOf). Returns both null when `currentId` is
 * absent or when there are fewer than 2 ids to navigate between.
 */
export function neighbors(
  ids: string[],
  currentId: string,
): { prevId: string | null; nextId: string | null } {
  if (ids.length < 2) return { prevId: null, nextId: null };
  const i = ids.indexOf(currentId);
  if (i === -1) return { prevId: null, nextId: null };
  return {
    prevId: i > 0 ? ids[i - 1] : null,
    nextId: i < ids.length - 1 ? ids[i + 1] : null,
  };
}

/**
 * Estimate a scroll offset from a `SectionList.onScrollToIndexFailed` payload.
 * Guards both fields with `Number.isFinite` (NaN/missing → 0) so a `NaN`
 * offset is never returned. Returns `Math.max(0, averageItemLength * index)`.
 */
export function scrollFailureOffset(info: { averageItemLength?: number; index?: number }): number {
  const len = Number.isFinite(info.averageItemLength) ? (info.averageItemLength as number) : 0;
  const idx = Number.isFinite(info.index) ? (info.index as number) : 0;
  return Math.max(0, len * idx);
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

export type FeedSection = { key: string; title: string; data: FeedItem[] };

const timeOf = (i: FeedItem | undefined): number =>
  i && i.publishedAt ? new Date(i.publishedAt).getTime() : -Infinity;

const byTimeDesc = (a: FeedItem, b: FeedItem) => timeOf(b) - timeOf(a);

function groupBy(items: FeedItem[], keyOf: (i: FeedItem) => string): Map<string, FeedItem[]> {
  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const k = keyOf(item);
    const arr = groups.get(k);
    if (arr) arr.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

/**
 * Build ordered per-source feed sections.
 * - Email: one section per sourceTitle, capped to MAX_PAID_ITEMS, newest-first.
 * - Hacker News: one section, recency-bounded to HN_MAX_AGE_MS, newest-first, always last.
 * - Other types (rss/youtube/…): one section per sourceTitle, newest-first, not recency-bounded.
 * Non-HN sections are ordered by their newest item's publishedAt descending. Empty sections are omitted.
 */
export function buildFeedSections(items: FeedItem[], now: number): FeedSection[] {
  const nonHn: FeedSection[] = [];

  // Email sections: one per sourceTitle, capped, newest-first.
  for (const [sourceTitle, group] of groupBy(
    items.filter((i) => i.sourceType === 'email'),
    (i) => i.sourceTitle,
  )) {
    const data = [...group].sort(byTimeDesc).slice(0, MAX_PAID_ITEMS);
    if (data.length > 0) nonHn.push({ key: `email:${sourceTitle}`, title: `📧 ${sourceTitle}`, data });
  }

  // Other non-email, non-HN sections: one per sourceTitle, newest-first, not recency-bounded.
  for (const [key, group] of groupBy(
    items.filter((i) => i.sourceType !== 'email' && i.sourceType !== 'hackernews'),
    (i) => `${i.sourceType}:${i.sourceTitle}`,
  )) {
    const data = [...group].sort(byTimeDesc);
    if (data.length > 0) nonHn.push({ key, title: group[0].sourceTitle, data });
  }

  // Order all non-HN sections by their newest item (descending); stable on ties.
  nonHn.sort((a, b) => timeOf(b.data[0]) - timeOf(a.data[0]));

  // Hacker News: single recency-bounded section, always last.
  const hnData = items
    .filter((i) => {
      if (i.sourceType !== 'hackernews' || !i.publishedAt) return false;
      const t = new Date(i.publishedAt).getTime();
      return !Number.isNaN(t) && now - t <= HN_MAX_AGE_MS;
    })
    .sort(byTimeDesc);

  const sections = [...nonHn];
  if (hnData.length > 0) sections.push({ key: 'hackernews', title: '🟠 Hacker News', data: hnData });
  return sections;
}
