import { parseRssFeed } from '../feed/rss';
import { parseHackerNewsStories } from '../feed/hackernews';
import type { HnItem, ParsedArticle } from '../feed/types';
import type { HttpGet, SourceRow } from './types';

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LIMIT = 30;

export async function fetchSource(source: SourceRow, httpGet: HttpGet): Promise<ParsedArticle[]> {
  if (source.type === 'hackernews') {
    const ids = JSON.parse(await httpGet(HN_TOP)) as number[];
    const items: HnItem[] = [];
    for (const id of ids.slice(0, HN_LIMIT)) {
      items.push(JSON.parse(await httpGet(HN_ITEM(id))) as HnItem);
    }
    return parseHackerNewsStories(items);
  }
  // 'rss' and 'youtube' are both feed XML parsed by the same Atom/RSS parser.
  if (!source.feedUrl) throw new Error(`source ${source.id} has no feed_url`);
  return parseRssFeed(await httpGet(source.feedUrl));
}
