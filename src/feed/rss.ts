import { XMLParser } from 'fast-xml-parser';
import type { ParsedArticle } from './types';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toIso(date: unknown): string | null {
  if (date === undefined || date === null) return null;
  const d = new Date(String(date));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRss2(channel: any): ParsedArticle[] {
  return toArray(channel.item).map((item: any) => {
    const guidRaw = item.guid;
    const guid = typeof guidRaw === 'object' && guidRaw !== null ? guidRaw['#text'] : guidRaw;
    return {
      guid: String(guid ?? item.link ?? ''),
      title: String(item.title ?? '').trim(),
      url: String(item.link ?? ''),
      publishedAt: toIso(item.pubDate),
    };
  });
}

function parseAtom(feed: any): ParsedArticle[] {
  return toArray(feed.entry).map((entry: any) => {
    const links = toArray<any>(entry.link);
    const link = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    const href = typeof link === 'string' ? link : (link?.['@_href'] ?? '');
    const title = entry.title?.['#text'] ?? entry.title ?? '';
    return {
      guid: String(entry.id ?? href ?? ''),
      title: String(title).trim(),
      url: String(href),
      publishedAt: toIso(entry.published ?? entry.updated),
    };
  });
}

export function parseRssFeed(xml: string): ParsedArticle[] {
  const doc = parser.parse(xml);
  if (doc?.rss?.channel) return parseRss2(doc.rss.channel);
  const ns = doc?.feed?.['@_xmlns'];
  if (doc?.feed && typeof ns === 'string' && ns.includes('w3.org/2005/Atom')) {
    return parseAtom(doc.feed);
  }
  throw new Error('Unrecognized feed format (expected RSS 2.0 or Atom)');
}
