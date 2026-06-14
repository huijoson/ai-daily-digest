import { detectSourceType } from '../feed/detect';
import { parseRssFeed } from '../feed/rss';
import { extractFeedTitle } from '../feed/meta';
import type { HttpGet } from '../pipeline/types';
import type { PreparedSource, SourceListItem } from './types';

/** Validate a pasted feed URL and derive its type + title. Throws if the URL is
 *  invalid or the feed is unreachable/unparseable. `httpGet` is injected for testing. */
export async function prepareSource(url: string, httpGet: HttpGet): Promise<PreparedSource> {
  const type = detectSourceType(url); // throws on an invalid URL
  if (type === 'hackernews') {
    return { type, feedUrl: null, title: 'Hacker News' };
  }
  const xml = await httpGet(url);
  parseRssFeed(xml); // throws if the feed is not parseable
  const title = extractFeedTitle(xml) ?? new URL(url).hostname.replace(/^www\./, '');
  return { type, feedUrl: url, title };
}

interface SourceRowDb {
  id: string;
  /** Raw string from the DB — cast to SourceType on the way out. */
  type: string;
  title: string | null;
  is_active: boolean;
  last_error: string | null;
}

export function mapSourceRow(row: SourceRowDb): SourceListItem {
  return {
    id: row.id,
    type: row.type as SourceListItem['type'],
    title: row.title ?? '',
    isActive: row.is_active,
    lastError: row.last_error,
  };
}
