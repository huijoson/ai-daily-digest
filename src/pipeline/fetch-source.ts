import { parseRssFeed } from '../feed/rss';
import { parseHackerNewsStories } from '../feed/hackernews';
import type { HnItem, ParsedArticle } from '../feed/types';
import type { HttpGet, SourceRow } from './types';

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LIMIT = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Keep articles whose publishedAt is within maxAgeMs of now; drop undated ones. */
export function filterRecentArticles(articles: ParsedArticle[], now: number, maxAgeMs: number): ParsedArticle[] {
  return articles.filter((a) => {
    if (!a.publishedAt) return false;
    const t = new Date(a.publishedAt).getTime();
    return !Number.isNaN(t) && now - t <= maxAgeMs;
  });
}

export async function fetchSource(
  source: SourceRow,
  httpGet: HttpGet,
  now: number = Date.now(),
): Promise<ParsedArticle[]> {
  if (source.type === 'hackernews') {
    const ids = JSON.parse(await httpGet(HN_TOP)) as number[];
    const items: HnItem[] = [];
    for (const id of ids.slice(0, HN_LIMIT)) {
      items.push(JSON.parse(await httpGet(HN_ITEM(id))) as HnItem);
    }
    return filterRecentArticles(parseHackerNewsStories(items), now, ONE_DAY_MS);
  }
  // 'rss' and 'youtube' are both feed XML parsed by the same Atom/RSS parser.
  if (!source.feedUrl) throw new Error(`source ${source.id} has no feed_url`);
  return parseRssFeed(await httpGet(source.feedUrl));
}
