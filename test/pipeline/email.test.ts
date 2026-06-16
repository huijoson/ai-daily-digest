import { describe, it, expect } from 'vitest';
import { parseSubstackEmail, runEmailIngest } from '../../src/pipeline/email';
import type { EmailMessage, DbClient, SourceRow } from '../../src/pipeline/types';
import type { ParsedArticle } from '../../src/feed/types';

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

  it('captures content image URLs from the html', () => {
    const chart = 'https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fc.png';
    const a = parseSubstackEmail({ ...base, html: `<p>x</p><img src="${chart}">` });
    expect(a.imageUrls).toEqual([chart]);
  });
});

function makeDb(sources: SourceRow[], existing: Record<string, string[]> = {}) {
  const inserted: Record<string, ParsedArticle[]> = {};
  const errors: Record<string, string | null> = {};
  const db: DbClient = {
    listActiveSources: async () => sources,
    existingGuids: async (id) => existing[id] ?? [],
    insertNewArticles: async (id, arts) => { inserted[id] = arts; return arts.length; },
    recordSourceError: async (id, err) => { errors[id] = err; },
    listPendingSummaries: async () => [],
    saveSummary: async () => {},
    markSummaryFailed: async () => {},
  };
  return { db, inserted, errors };
}

const email = (messageId: string) => ({
  subject: 'T', html: '<a href="https://x.substack.com/p/slug">l</a>',
  text: 'body', messageId, date: null,
});

describe('runEmailIngest', () => {
  it('ingests, dedups, and inserts articles for email sources only', async () => {
    const sources: SourceRow[] = [
      { id: 'e1', type: 'email', feedUrl: 'fomosoc@substack.com' },
      { id: 'r1', type: 'rss', feedUrl: 'https://x/feed' },
    ];
    const { db, inserted, errors } = makeDb(sources, { e1: ['<old@s>'] });
    const fetchEmails = async (sender: string) => {
      expect(sender).toBe('fomosoc@substack.com');
      return [email('<old@s>'), email('<new@s>')]; // one already seen
    };
    const res = await runEmailIngest({ db, fetchEmails });
    expect(inserted['e1'].map((a) => a.guid)).toEqual(['<new@s>']); // deduped
    expect(inserted['r1']).toBeUndefined(); // rss source untouched
    expect(errors['e1']).toBe(null);
    expect(res).toEqual({ inserted: 1, errors: 0 });
  });

  it('records last_error and continues when a source fails', async () => {
    const sources: SourceRow[] = [{ id: 'e1', type: 'email', feedUrl: 'a@b.com' }];
    const { db, errors } = makeDb(sources);
    const fetchEmails = async () => { throw new Error('imap down'); };
    const res = await runEmailIngest({ db, fetchEmails });
    expect(errors['e1']).toContain('imap down');
    expect(res).toEqual({ inserted: 0, errors: 1 });
  });

  it('skips an email source with no sender (feedUrl null)', async () => {
    const sources: SourceRow[] = [{ id: 'e1', type: 'email', feedUrl: null }];
    const { db, errors } = makeDb(sources);
    let called = false;
    const fetchEmails = async () => { called = true; return []; };
    const res = await runEmailIngest({ db, fetchEmails });
    expect(called).toBe(false);
    expect(errors['e1']).toContain('no sender');
    expect(res).toEqual({ inserted: 0, errors: 1 });
  });
});
