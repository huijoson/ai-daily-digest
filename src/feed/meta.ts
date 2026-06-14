import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true });

function titleText(node: unknown): string | null {
  if (typeof node === 'string' && node.trim().length > 0) return node.trim();
  if (node && typeof node === 'object' && '#text' in (node as any)) {
    const t = (node as any)['#text'];
    if (typeof t === 'string' && t.trim().length > 0) return t.trim();
  }
  return null;
}

export function extractFeedTitle(xml: string): string | null {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  if (doc?.rss?.channel) return titleText(doc.rss.channel.title);
  if (doc?.feed) return titleText(doc.feed.title);
  return null;
}
