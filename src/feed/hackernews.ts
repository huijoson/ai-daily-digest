import type { HnItem, ParsedArticle } from './types';

export function parseHackerNewsStories(items: HnItem[]): ParsedArticle[] {
  return items
    .filter((it): it is HnItem & { title: string } =>
      !!it && it.type === 'story' && typeof it.title === 'string' && it.title.length > 0)
    .map((it) => ({
      guid: `hn:${it.id}`,
      title: it.title.trim(),
      url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
      publishedAt: it.time != null ? new Date(it.time * 1000).toISOString() : null,
    }));
}
