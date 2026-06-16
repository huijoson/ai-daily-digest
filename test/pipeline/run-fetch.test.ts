import { describe, it, expect } from 'vitest';
import { runFetch } from '../../src/pipeline/run-fetch';
import type { DbClient, SourceRow } from '../../src/pipeline/types';
import type { ParsedArticle } from '../../src/feed/types';

const RSS = (guid: string) => `<?xml version="1.0"?>
<rss version="2.0"><channel><title>X</title>
  <item><title>t</title><link>u</link><guid>${guid}</guid></item>
</channel></rss>`;

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

describe('runFetch', () => {
  it('inserts only new (deduped) articles per source and clears the error', async () => {
    const src: SourceRow = { id: 's1', type: 'rss', feedUrl: 'https://x/feed' };
    const { db, inserted, errors } = makeDb([src], { s1: ['old'] });
    const httpGet = async () => RSS('new');
    const res = await runFetch({ db, httpGet });
    expect(inserted['s1'].map((a) => a.guid)).toEqual(['new']);
    expect(errors['s1']).toBe(null);
    expect(res).toEqual({ inserted: 1, errors: 0 });
  });

  it('skips an already-seen guid (idempotent re-run inserts nothing)', async () => {
    const src: SourceRow = { id: 's1', type: 'rss', feedUrl: 'https://x/feed' };
    const { db, inserted } = makeDb([src], { s1: ['dup'] });
    const res = await runFetch({ db, httpGet: async () => RSS('dup') });
    expect(inserted['s1']).toEqual([]);
    expect(res.inserted).toBe(0);
  });

  it('records last_error and continues when one source fails', async () => {
    const bad: SourceRow = { id: 'bad', type: 'rss', feedUrl: 'https://bad/feed' };
    const good: SourceRow = { id: 'good', type: 'rss', feedUrl: 'https://good/feed' };
    const { db, inserted, errors } = makeDb([bad, good]);
    const httpGet = async (url: string) => {
      if (url.includes('bad')) throw new Error('boom');
      return RSS('g');
    };
    const res = await runFetch({ db, httpGet });
    expect(errors['bad']).toContain('boom');
    expect(inserted['good'].map((a) => a.guid)).toEqual(['g']);
    expect(res).toEqual({ inserted: 1, errors: 1 });
  });

  it('skips email-type sources (no HTTP fetch attempted)', async () => {
    const src: SourceRow = { id: 'e1', type: 'email', feedUrl: 'a@b.com' };
    const { db, inserted } = makeDb([src]);
    let called = false;
    const httpGet = async () => { called = true; return RSS('x'); };
    const res = await runFetch({ db, httpGet });
    expect(called).toBe(false);
    expect(inserted['e1']).toBeUndefined();
    expect(res).toEqual({ inserted: 0, errors: 0 });
  });
});
