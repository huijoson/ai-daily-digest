import { describe, it, expect } from 'vitest';
import { parseSubstackEmail } from '../../src/pipeline/email';
import type { EmailMessage } from '../../src/pipeline/types';

const base: EmailMessage = {
  subject: '  The Big Post  ',
  html: '<p>Read it here: <a href="https://fomosoc.substack.com/p/the-big-post?utm=1">link</a></p>',
  text: '  Full article body.\n\nSecond paragraph.  ',
  messageId: '<abc123@substack.com>',
  date: '2026-06-16T08:00:00.000Z',
};

describe('parseSubstackEmail', () => {
  it('maps subject→title, messageId→guid, text→content, date→ISO', () => {
    const a = parseSubstackEmail(base);
    expect(a.guid).toBe('<abc123@substack.com>');
    expect(a.title).toBe('The Big Post');
    expect(a.content).toBe('Full article body.\n\nSecond paragraph.');
    expect(a.publishedAt).toBe('2026-06-16T08:00:00.000Z');
  });

  it('extracts the substack /p/ post url from the html', () => {
    const a = parseSubstackEmail(base);
    expect(a.url).toBe('https://fomosoc.substack.com/p/the-big-post');
  });

  it('falls back to empty url when no substack post link is present', () => {
    const a = parseSubstackEmail({ ...base, html: '<p>no link here</p>' });
    expect(a.url).toBe('');
  });

  it('handles a null date and empty text', () => {
    const a = parseSubstackEmail({ ...base, date: null, text: '   ' });
    expect(a.publishedAt).toBe(null);
    expect(a.content).toBe(null);
  });
});
