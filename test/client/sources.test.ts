import { describe, it, expect } from 'vitest';
import { prepareSource, mapSourceRow } from '../../src/client/sources';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Lenny's Newsletter</title>
  <item><title>x</title><link>u</link><guid>g</guid></item>
</channel></rss>`;

describe('prepareSource', () => {
  it('validates an rss feed, detects type, and derives the title', async () => {
    const httpGet = async (url: string) => { expect(url).toBe('https://lenny.substack.com/feed'); return RSS; };
    const out = await prepareSource('https://lenny.substack.com/feed', httpGet);
    expect(out).toEqual({ type: 'rss', feedUrl: 'https://lenny.substack.com/feed', title: "Lenny's Newsletter" });
  });

  it('falls back to the hostname when the feed has no title', async () => {
    const noTitle = '<rss version="2.0"><channel><item><guid>g</guid></item></channel></rss>';
    const out = await prepareSource('https://blog.example.com/rss', async () => noTitle);
    expect(out.title).toBe('blog.example.com');
  });

  it('detects youtube and still validates the feed', async () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Chan</title><entry><id>i</id></entry></feed>`;
    const out = await prepareSource('https://www.youtube.com/feeds/videos.xml?channel_id=X', async () => atom);
    expect(out.type).toBe('youtube');
    expect(out.title).toBe('Chan');
  });

  it('prepares Hacker News without fetching', async () => {
    let called = false;
    const out = await prepareSource('https://news.ycombinator.com/rss', async () => { called = true; return ''; });
    expect(out).toEqual({ type: 'hackernews', feedUrl: null, title: 'Hacker News' });
    expect(called).toBe(false);
  });

  it('throws when the feed cannot be parsed', async () => {
    await expect(prepareSource('https://x.com/feed', async () => '<html></html>')).rejects.toThrow();
  });

  it('throws on an invalid URL', async () => {
    await expect(prepareSource('not a url', async () => RSS)).rejects.toThrow();
  });
});

describe('mapSourceRow', () => {
  it('maps a DB row to a SourceListItem', () => {
    const row = { id: 's1', type: 'rss', title: 'T', is_active: true, last_error: null };
    expect(mapSourceRow(row)).toEqual({ id: 's1', type: 'rss', title: 'T', isActive: true, lastError: null });
  });
  it('falls back to an empty title and preserves last_error', () => {
    const row = { id: 's2', type: 'hackernews', title: null, is_active: false, last_error: 'boom' };
    expect(mapSourceRow(row)).toEqual({ id: 's2', type: 'hackernews', title: '', isActive: false, lastError: 'boom' });
  });
});
