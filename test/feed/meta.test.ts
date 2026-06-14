import { describe, it, expect } from 'vitest';
import { extractFeedTitle } from '../../src/feed/meta';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Lenny's Newsletter</title>
  <item><title>x</title></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>My YT Channel</title>
  <entry><title>v</title></entry>
</feed>`;

describe('extractFeedTitle', () => {
  it('reads the RSS channel title', () => {
    expect(extractFeedTitle(RSS)).toBe("Lenny's Newsletter");
  });
  it('reads the Atom feed title', () => {
    expect(extractFeedTitle(ATOM)).toBe('My YT Channel');
  });
  it('returns null when there is no title or the doc is unrecognized', () => {
    expect(extractFeedTitle('<rss version="2.0"><channel></channel></rss>')).toBe(null);
    expect(extractFeedTitle('<html></html>')).toBe(null);
  });
});
