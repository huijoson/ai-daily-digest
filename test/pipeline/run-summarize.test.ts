import { describe, it, expect } from 'vitest';
import { runSummarize } from '../../src/pipeline/run-summarize';
import type { DbClient, PendingSummary, Summarizer } from '../../src/pipeline/types';

function makeDb(pending: PendingSummary[]) {
  const saved: Record<string, { text: string; model: string }> = {};
  const failed: string[] = [];
  let requestedLimit = -1;
  const db: DbClient = {
    listActiveSources: async () => [],
    existingGuids: async () => [],
    insertNewArticles: async () => 0,
    recordSourceError: async () => {},
    listPendingSummaries: async (limit) => { requestedLimit = limit; return pending.slice(0, limit); },
    saveSummary: async (id, r) => { saved[id] = r; },
    markSummaryFailed: async (id) => { failed.push(id); },
  };
  return { db, saved, failed, getLimit: () => requestedLimit };
}

const p = (articleId: string): PendingSummary => ({ articleId, title: 't', url: 'u', content: 'c', sourceType: 'hackernews' });

describe('runSummarize', () => {
  it('summarizes each pending article and marks it done', async () => {
    const { db, saved } = makeDb([p('a1'), p('a2')]);
    const summarize: Summarizer = async () => ({ text: 'sum', model: 'gemini-2.0-flash' });
    const res = await runSummarize({ db, summarize, batchSize: 10 });
    expect(saved['a1']).toEqual({ text: 'sum', model: 'gemini-2.0-flash' });
    expect(saved['a2']).toEqual({ text: 'sum', model: 'gemini-2.0-flash' });
    expect(res).toEqual({ done: 2, failed: 0 });
  });

  it('marks a failed summary without aborting the batch', async () => {
    const { db, saved, failed } = makeDb([p('a1'), p('a2')]);
    // Fail the first article only; the second must still be summarized.
    let n = 0;
    const summarize: Summarizer = async () => {
      n += 1;
      if (n === 1) throw new Error('boom');
      return { text: 'ok', model: 'm' };
    };
    const res = await runSummarize({ db, summarize, batchSize: 10 });
    expect(failed).toEqual(['a1']);
    expect(saved['a2']).toEqual({ text: 'ok', model: 'm' });
    expect(res).toEqual({ done: 1, failed: 1 });
  });

  it('requests at most batchSize pending items', async () => {
    const { db, getLimit } = makeDb([p('a1'), p('a2'), p('a3')]);
    const summarize: Summarizer = async () => ({ text: 's', model: 'm' });
    const res = await runSummarize({ db, summarize, batchSize: 2 });
    expect(getLimit()).toBe(2);
    expect(res.done).toBe(2);
  });

  it('forwards sourceType to the summarizer', async () => {
    const { db } = makeDb([{ articleId: 'a1', title: 't', url: 'u', content: 'c', sourceType: 'email' }]);
    let seen: string | undefined;
    const summarize: Summarizer = async (input) => { seen = input.sourceType; return { text: 's', model: 'm' }; };
    await runSummarize({ db, summarize, batchSize: 10 });
    expect(seen).toBe('email');
  });
});
