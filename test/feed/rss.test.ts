import { describe, it, expect } from 'vitest';
import { parseRssFeed } from '../../src/feed/rss';

const RSS2 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example</title>
  <item>
    <title>Hello World</title>
    <link>https://example.com/a</link>
    <guid>https://example.com/a</guid>
    <pubDate>Tue, 10 Jun 2025 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Second Post</title>
    <link>https://example.com/b</link>
    <guid isPermaLink="false">tag:example,b</guid>
    <pubDate>Wed, 11 Jun 2025 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>YT Channel</title>
  <entry>
    <id>yt:video:ABC123</id>
    <title>My Video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=ABC123"/>
    <published>2025-06-10T12:00:00+00:00</published>
  </entry>
</feed>`;

describe('parseRssFeed', () => {
  it('parses RSS 2.0 items', () => {
    const items = parseRssFeed(RSS2);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      guid: 'https://example.com/a',
      title: 'Hello World',
      url: 'https://example.com/a',
      publishedAt: '2025-06-10T09:00:00.000Z',
    });
  });

  it('reads guid text when guid has attributes', () => {
    const items = parseRssFeed(RSS2);
    expect(items[1].guid).toBe('tag:example,b');
  });

  it('parses Atom entries (e.g. YouTube) using the alternate link', () => {
    const items = parseRssFeed(ATOM);
    expect(items[0]).toEqual({
      guid: 'yt:video:ABC123',
      title: 'My Video',
      url: 'https://www.youtube.com/watch?v=ABC123',
      publishedAt: '2025-06-10T12:00:00.000Z',
    });
  });

  it('throws on an unrecognized document', () => {
    expect(() => parseRssFeed('<html></html>')).toThrow();
  });

  it('returns null publishedAt when RSS item has no pubDate', () => {
    const rssNoPubDate = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>No Date Feed</title>
  <item>
    <title>Dateless Article</title>
    <link>https://example.com/no-date</link>
    <guid>https://example.com/no-date</guid>
  </item>
</channel></rss>`;
    const items = parseRssFeed(rssNoPubDate);
    expect(items[0].publishedAt).toBe(null);
  });

  it('throws on a non-Atom <feed> document (no Atom xmlns)', () => {
    expect(() => parseRssFeed('<feed><entry/></feed>')).toThrow('Unrecognized');
  });

  it('does not set imageUrls (text-only source)', () => {
    expect(parseRssFeed(RSS2)[0].imageUrls).toBeUndefined();
  });
});
