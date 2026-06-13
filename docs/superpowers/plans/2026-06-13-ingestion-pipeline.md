# Ingestion Pipeline (Fetch + Summarize + Schedule) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the unattended ingestion pipeline: fetch each active source, dedup and insert new articles, summarize pending articles via a provider-agnostic `summarize()` (Gemini free tier), and schedule it daily — with the business logic fully unit-tested in Node and only thin Deno/DB adapters deferred to live verification.

**Architecture:** All orchestration is pure TypeScript in `src/pipeline/` that depends ONLY on injected interfaces (`DbClient`, `HttpGet`, `Summarizer`) plus the Plan A feed core. These are unit-tested with in-memory fakes in Vitest — no Docker, no network. The Supabase Edge Functions (`supabase/functions/fetch`, `summarize`) are thin Deno entry points that construct the real dependencies (supabase-js service-role client, real `fetch`, real Gemini call) and call the pure orchestrators. A `deno.json` import map makes the shared `src/` code resolve under Deno. Scheduling is a `pg_cron` migration. This is Plan B of 4 (A done: feed core + schema; C: mobile app; D: push + verification).

**Tech Stack:** TypeScript, Vitest, Deno (Supabase Edge Functions), supabase-js, Gemini API, `pg_cron`.

**Spec:** `openspec/changes/add-daily-digest-mvp/` — capabilities `fetch-pipeline` (scheduled fetch/insert/isolation), `summarization` (abstraction, batching, retry state machine).

**Prerequisite from Plan A:** the pure feed core at `src/feed/` (`parseRssFeed`, `parseHackerNewsStories`, `filterNewArticles`, types `ParsedArticle`, `HnItem`, `SourceType`) and the schema/RLS migrations. `filterNewArticles` MUST be called with per-source existing guids.

---

## File Structure

```
deno.json                              # Deno import map (fast-xml-parser, supabase-js, std)
src/pipeline/types.ts                  # SourceRow, PendingSummary, SummaryResult, Summarizer, HttpGet, DbClient, deps
src/pipeline/summarize.ts              # buildSummaryPrompt, parseGeminiResponse, createGeminiSummarizer
src/pipeline/fetch-source.ts           # fetchSource(source, httpGet) -> ParsedArticle[]
src/pipeline/run-fetch.ts              # runFetch(deps) — load active, dedup per-source, insert, isolate errors
src/pipeline/run-summarize.ts          # runSummarize(deps) — batch pending, summarize, done/failed
test/pipeline/summarize.test.ts
test/pipeline/fetch-source.test.ts
test/pipeline/run-fetch.test.ts
test/pipeline/run-summarize.test.ts
supabase/functions/_shared/db.ts       # SupabaseDbClient implementing DbClient via service-role client (Deno)
supabase/functions/fetch/index.ts      # Deno entry: build deps -> runFetch
supabase/functions/summarize/index.ts  # Deno entry: build deps -> runSummarize
supabase/migrations/0003_cron.sql      # pg_cron daily schedule
```

Pure orchestrators never import `fetch`, `supabase-js`, or Deno APIs directly — those arrive through injected interfaces, which is what makes them testable in Node. Tasks 1–6 are fully TDD-tested; Tasks 7–9 are Deno/DB adapters verified live by the user (Docker required).

---

## Task 1: Deno import map + pipeline types

**Files:**
- Create: `deno.json`, `src/pipeline/types.ts`

- [ ] **Step 1: Create the Deno import map — `deno.json`**

```json
{
  "imports": {
    "fast-xml-parser": "npm:fast-xml-parser@^4.5.0",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.45.0"
  }
}
```

This resolves the bare `fast-xml-parser` specifier (used by `src/feed/rss.ts`) and supabase-js when the Edge Functions import the shared code under Deno. Node/Vitest continues to resolve via `node_modules`.

- [ ] **Step 2: Create the pipeline interfaces — `src/pipeline/types.ts`**

```ts
import type { ParsedArticle, SourceType } from '../feed/types';

/** A source row as the pipeline needs it (subset of the DB row). */
export interface SourceRow {
  id: string;
  type: SourceType;
  feedUrl: string | null;
}

/** An article awaiting summarization, with whatever content we have. */
export interface PendingSummary {
  articleId: string;
  title: string;
  url: string;
  content: string | null;
}

export interface SummaryResult {
  text: string;
  model: string;
}

/** Provider-agnostic summarizer: the seam that hides the LLM. */
export type Summarizer = (input: {
  title: string;
  url: string;
  content: string | null;
}) => Promise<SummaryResult>;

/** Minimal HTTP GET returning the response body as text. Injected for testability. */
export type HttpGet = (url: string) => Promise<string>;

/** The database operations the pipeline needs. Implemented by supabase-js in Deno (Task 7),
 *  and by an in-memory fake in the unit tests. */
export interface DbClient {
  listActiveSources(): Promise<SourceRow[]>;
  /** Guids already stored FOR THIS SOURCE — uniqueness is per (source_id, guid). */
  existingGuids(sourceId: string): Promise<string[]>;
  /** Insert new articles and a 'pending' summary row for each; returns the number inserted. */
  insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number>;
  /** Set or clear (null) the source's last_error. */
  recordSourceError(sourceId: string, error: string | null): Promise<void>;
  /** Up to `limit` summaries in 'pending' or 'failed' state, with article fields, oldest first. */
  listPendingSummaries(limit: number): Promise<PendingSummary[]>;
  /** Persist a successful summary and mark it 'done'. */
  saveSummary(articleId: string, result: SummaryResult): Promise<void>;
  /** Mark a summary 'failed' and increment its attempt counter. */
  markSummaryFailed(articleId: string): Promise<void>;
}

export interface FetchDeps {
  db: DbClient;
  httpGet: HttpGet;
}

export interface SummarizeDeps {
  db: DbClient;
  summarize: Summarizer;
  batchSize: number;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (no implementation yet, just types importing from `../feed/types`).

- [ ] **Step 4: Commit**

```bash
git add deno.json src/pipeline/types.ts
git commit -m "feat: add Deno import map and pipeline dependency interfaces"
```

---

## Task 2: Summary prompt + Gemini response parsing (TDD)

**Files:**
- Create: `src/pipeline/summarize.ts`
- Test: `test/pipeline/summarize.test.ts`

- [ ] **Step 1: Write the failing test — `test/pipeline/summarize.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt, parseGeminiResponse, GEMINI_MODEL } from '../../src/pipeline/summarize';

describe('buildSummaryPrompt', () => {
  it('includes the title and url', () => {
    const p = buildSummaryPrompt({ title: 'Hello', url: 'https://x.com/a', content: 'Body text.' });
    expect(p).toContain('Hello');
    expect(p).toContain('https://x.com/a');
    expect(p).toContain('Body text.');
  });

  it('falls back gracefully when content is null', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: null });
    expect(p).toContain('T');
    expect(p.toLowerCase()).toContain('no content');
  });
});

describe('parseGeminiResponse', () => {
  it('extracts the candidate text', () => {
    const json = { candidates: [{ content: { parts: [{ text: '  A summary.  ' }] } }] };
    expect(parseGeminiResponse(json)).toBe('A summary.');
  });

  it('throws when no text is present', () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow();
    expect(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: '   ' }] } }] })).toThrow();
  });
});

describe('GEMINI_MODEL', () => {
  it('is a non-empty model id', () => {
    expect(typeof GEMINI_MODEL).toBe('string');
    expect(GEMINI_MODEL.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- summarize`
Expected: FAIL — cannot find module `../../src/pipeline/summarize`.

- [ ] **Step 3: Implement the pure pieces — `src/pipeline/summarize.ts`**

```ts
import type { Summarizer } from './types';

export const GEMINI_MODEL = 'gemini-2.0-flash';

export function buildSummaryPrompt(input: {
  title: string;
  url: string;
  content: string | null;
}): string {
  const body = input.content?.trim()
    ? input.content.trim()
    : '(no content provided; summarize based on the title and link)';
  return [
    'Summarize the following article in 2-3 concise sentences for a daily digest.',
    'Be factual and neutral. Do not add any preamble or markdown.',
    '',
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    '',
    'Content:',
    body,
  ].join('\n');
}

export function parseGeminiResponse(json: unknown): string {
  const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Gemini response missing text');
  }
  return text.trim();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- summarize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/summarize.ts test/pipeline/summarize.test.ts
git commit -m "feat: build summary prompt and parse Gemini responses"
```

---

## Task 3: Gemini summarizer wrapper (TDD)

**Files:**
- Modify: `src/pipeline/summarize.ts` (add `createGeminiSummarizer`)
- Test: `test/pipeline/summarize.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `test/pipeline/summarize.test.ts`**

Append these imports/cases (add `createGeminiSummarizer` to the existing import line):

```ts
import { createGeminiSummarizer } from '../../src/pipeline/summarize';

describe('createGeminiSummarizer', () => {
  const okResponse = {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'Summed.' }] } }] }),
  };

  it('returns the summary text and the model id on success', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async (url, body) => {
        calls.push({ url, body });
        return okResponse as any;
      },
    });
    const result = await summarize({ title: 'T', url: 'u', content: 'c' });
    expect(result).toEqual({ text: 'Summed.', model: 'gemini-2.0-flash' });
    expect(calls[0].url).toContain('gemini-2.0-flash');
    expect(calls[0].url).toContain('KEY');
  });

  it('throws on a non-ok HTTP status (so the caller can mark it failed)', async () => {
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async () => ({ ok: false, status: 429, json: async () => ({}) }) as any,
    });
    await expect(summarize({ title: 'T', url: 'u', content: 'c' })).rejects.toThrow('429');
  });
});
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- summarize`
Expected: FAIL — `createGeminiSummarizer` is not exported.

- [ ] **Step 3: Implement `createGeminiSummarizer` in `src/pipeline/summarize.ts`**

Append to the file:

```ts
export interface GeminiDeps {
  apiKey: string;
  httpPostJson: (
    url: string,
    body: unknown,
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

export function createGeminiSummarizer(deps: GeminiDeps): Summarizer {
  return async (input) => {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${deps.apiKey}`;
    const body = { contents: [{ parts: [{ text: buildSummaryPrompt(input) }] }] };
    const res = await deps.httpPostJson(url, body);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const text = parseGeminiResponse(await res.json());
    return { text, model: GEMINI_MODEL };
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- summarize`
Expected: PASS (all summarize cases).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/pipeline/summarize.ts test/pipeline/summarize.test.ts
git commit -m "feat: provider-agnostic Gemini summarizer with injected HTTP"
```

---

## Task 4: Fetch a single source (TDD)

**Files:**
- Create: `src/pipeline/fetch-source.ts`
- Test: `test/pipeline/fetch-source.test.ts`

- [ ] **Step 1: Write the failing test — `test/pipeline/fetch-source.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fetchSource } from '../../src/pipeline/fetch-source';
import type { SourceRow } from '../../src/pipeline/types';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>X</title>
  <item><title>One</title><link>https://x.com/1</link><guid>g1</guid></item>
</channel></rss>`;

describe('fetchSource', () => {
  it('fetches and parses an rss/youtube source from its feed_url', async () => {
    const source: SourceRow = { id: 's1', type: 'rss', feedUrl: 'https://x.com/feed' };
    const seen: string[] = [];
    const httpGet = async (url: string) => { seen.push(url); return RSS; };
    const out = await fetchSource(source, httpGet);
    expect(seen).toEqual(['https://x.com/feed']);
    expect(out.map((a) => a.guid)).toEqual(['g1']);
  });

  it('throws when an rss source has no feed_url', async () => {
    const source: SourceRow = { id: 's1', type: 'rss', feedUrl: null };
    await expect(fetchSource(source, async () => '')).rejects.toThrow();
  });

  it('fetches Hacker News top stories then their items', async () => {
    const source: SourceRow = { id: 'hn', type: 'hackernews', feedUrl: null };
    const httpGet = async (url: string) => {
      if (url.includes('topstories')) return JSON.stringify([11, 12]);
      if (url.includes('/item/11')) return JSON.stringify({ id: 11, title: 'A', url: 'https://a', time: 1700000000, type: 'story' });
      if (url.includes('/item/12')) return JSON.stringify({ id: 12, title: 'B', time: 1700000001, type: 'story' });
      throw new Error('unexpected url ' + url);
    };
    const out = await fetchSource(source, httpGet);
    expect(out.map((a) => a.guid)).toEqual(['hn:11', 'hn:12']);
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=12');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- fetch-source`
Expected: FAIL — cannot find module `fetch-source`.

- [ ] **Step 3: Implement — `src/pipeline/fetch-source.ts`**

```ts
import { parseRssFeed } from '../feed/rss';
import { parseHackerNewsStories } from '../feed/hackernews';
import type { HnItem, ParsedArticle } from '../feed/types';
import type { HttpGet, SourceRow } from './types';

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LIMIT = 30;

export async function fetchSource(source: SourceRow, httpGet: HttpGet): Promise<ParsedArticle[]> {
  if (source.type === 'hackernews') {
    const ids = JSON.parse(await httpGet(HN_TOP)) as number[];
    const items: HnItem[] = [];
    for (const id of ids.slice(0, HN_LIMIT)) {
      items.push(JSON.parse(await httpGet(HN_ITEM(id))) as HnItem);
    }
    return parseHackerNewsStories(items);
  }
  // 'rss' and 'youtube' are both feed XML parsed by the same Atom/RSS parser.
  if (!source.feedUrl) throw new Error(`source ${source.id} has no feed_url`);
  return parseRssFeed(await httpGet(source.feedUrl));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- fetch-source`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/pipeline/fetch-source.ts test/pipeline/fetch-source.test.ts
git commit -m "feat: fetch and parse a single source (rss/youtube/hackernews)"
```

---

## Task 5: Fetch orchestration with per-source isolation (TDD)

**Files:**
- Create: `src/pipeline/run-fetch.ts`
- Test: `test/pipeline/run-fetch.test.ts`

- [ ] **Step 1: Write the failing test — `test/pipeline/run-fetch.test.ts`**

```ts
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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run-fetch`
Expected: FAIL — cannot find module `run-fetch`.

- [ ] **Step 3: Implement — `src/pipeline/run-fetch.ts`**

```ts
import { filterNewArticles } from '../feed/dedup';
import { fetchSource } from './fetch-source';
import type { FetchDeps } from './types';

export async function runFetch(deps: FetchDeps): Promise<{ inserted: number; errors: number }> {
  const sources = await deps.db.listActiveSources();
  let inserted = 0;
  let errors = 0;
  for (const source of sources) {
    try {
      const parsed = await fetchSource(source, deps.httpGet);
      // Existing guids are scoped to THIS source — uniqueness is per (source_id, guid).
      const existing = await deps.db.existingGuids(source.id);
      const fresh = filterNewArticles(parsed, existing);
      inserted += await deps.db.insertNewArticles(source.id, fresh);
      await deps.db.recordSourceError(source.id, null);
    } catch (e) {
      errors += 1;
      await deps.db.recordSourceError(source.id, e instanceof Error ? e.message : String(e));
    }
  }
  return { inserted, errors };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- run-fetch`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/pipeline/run-fetch.ts test/pipeline/run-fetch.test.ts
git commit -m "feat: fetch orchestration with per-source dedup and error isolation"
```

---

## Task 6: Summarize orchestration with retry state machine (TDD)

**Files:**
- Create: `src/pipeline/run-summarize.ts`
- Test: `test/pipeline/run-summarize.test.ts`

- [ ] **Step 1: Write the failing test — `test/pipeline/run-summarize.test.ts`**

```ts
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

const p = (articleId: string): PendingSummary => ({ articleId, title: 't', url: 'u', content: 'c' });

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
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run-summarize`
Expected: FAIL — cannot find module `run-summarize`.

- [ ] **Step 3: Implement — `src/pipeline/run-summarize.ts`**

```ts
import type { SummarizeDeps } from './types';

export async function runSummarize(deps: SummarizeDeps): Promise<{ done: number; failed: number }> {
  const pending = await deps.db.listPendingSummaries(deps.batchSize);
  let done = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      const result = await deps.summarize({ title: item.title, url: item.url, content: item.content });
      await deps.db.saveSummary(item.articleId, result);
      done += 1;
    } catch {
      await deps.db.markSummaryFailed(item.articleId);
      failed += 1;
    }
  }
  return { done, failed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- run-summarize`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the FULL suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all feed + pipeline tests pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/run-summarize.ts test/pipeline/run-summarize.test.ts
git commit -m "feat: summarize orchestration with batching and failed-state retry"
```

---

## Task 7: Supabase DbClient adapter (Deno; static-only here)

**Files:**
- Create: `supabase/functions/_shared/db.ts`

This implements `DbClient` against the real Postgres via supabase-js with the service-role key (which bypasses RLS). It cannot be unit-tested in Node and is verified live by the user (Task 9). Write it carefully; review statically.

- [ ] **Step 1: Implement — `supabase/functions/_shared/db.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedArticle } from '../../../src/feed/types.ts';
import type { DbClient, PendingSummary, SourceRow, SummaryResult } from '../../../src/pipeline/types.ts';

export function createSupabaseDbClient(url: string, serviceRoleKey: string): DbClient {
  const sb: SupabaseClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  return {
    async listActiveSources(): Promise<SourceRow[]> {
      const { data, error } = await sb.from('sources')
        .select('id, type, feed_url')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, type: r.type, feedUrl: r.feed_url }));
    },

    async existingGuids(sourceId: string): Promise<string[]> {
      const { data, error } = await sb.from('articles')
        .select('guid')
        .eq('source_id', sourceId);
      if (error) throw error;
      return (data ?? []).map((r) => r.guid);
    },

    async insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number> {
      if (articles.length === 0) return 0;
      const { data, error } = await sb.from('articles')
        .insert(articles.map((a) => ({
          source_id: sourceId,
          guid: a.guid,
          title: a.title,
          url: a.url,
          published_at: a.publishedAt,
        })))
        .select('id');
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.id);
      if (ids.length > 0) {
        const { error: sErr } = await sb.from('summaries')
          .insert(ids.map((articleId) => ({ article_id: articleId, status: 'pending' })));
        if (sErr) throw sErr;
      }
      return ids.length;
    },

    async recordSourceError(sourceId: string, errorText: string | null): Promise<void> {
      const { error } = await sb.from('sources').update({ last_error: errorText }).eq('id', sourceId);
      if (error) throw error;
    },

    async listPendingSummaries(limit: number): Promise<PendingSummary[]> {
      const { data, error } = await sb.from('summaries')
        .select('article_id, articles(title, url)')
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        articleId: r.article_id,
        title: r.articles?.title ?? '',
        url: r.articles?.url ?? '',
        content: null, // MVP: no full-text fetch yet; summarize from title/url
      }));
    },

    async saveSummary(articleId: string, result: SummaryResult): Promise<void> {
      const { error } = await sb.from('summaries')
        .update({ summary_text: result.text, model: result.model, status: 'done', updated_at: new Date().toISOString() })
        .eq('article_id', articleId);
      if (error) throw error;
    },

    async markSummaryFailed(articleId: string): Promise<void> {
      // Increment attempts via RPC-free read-modify-write is racy; use a SQL expression instead.
      const { error } = await sb.rpc('increment_summary_failure', { p_article_id: articleId });
      if (error) throw error;
    },
  };
}
```

- [ ] **Step 2: Add the failure-increment RPC — append to a new migration `supabase/migrations/0003_pipeline.sql`**

```sql
-- Atomically mark a summary failed and bump its attempt counter.
create or replace function increment_summary_failure(p_article_id uuid)
returns void language sql as $$
  update summaries
     set status = 'failed', attempts = attempts + 1, updated_at = now()
   where article_id = p_article_id;
$$;
```

- [ ] **Step 3: Static sanity check**

Read `db.ts` against `src/pipeline/types.ts` (`DbClient`) and the schema in `supabase/migrations/0001_init.sql`:
- Every `DbClient` method is implemented with the right signature.
- Column names match the schema (`feed_url`, `source_id`, `published_at`, `summary_text`, `article_id`, `is_active`, `last_error`).
- Deno-style imports use explicit `.ts` extensions for local files; bare specifiers (`@supabase/supabase-js`) resolve via `deno.json`.

Run: `npm run typecheck`
Expected: clean. (Node's `tsc` may flag the `.ts` import extensions; if so, the `_shared/db.ts` file is Deno-only — exclude `supabase/functions/**` from the Node tsconfig `include` so Node doesn't typecheck Deno files. The plan's tsconfig `include` is `["src","test"]`, so `supabase/**` is already excluded. Confirm this and do not add it.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/db.ts supabase/migrations/0003_pipeline.sql
git commit -m "feat: Supabase service-role DbClient adapter and failure-increment RPC"
```

---

## Task 8: Edge Function entry points (Deno; static-only here)

**Files:**
- Create: `supabase/functions/fetch/index.ts`, `supabase/functions/summarize/index.ts`

Thin Deno wrappers: read env, build real deps, call the pure orchestrators. Verified live in Task 9.

- [ ] **Step 1: Implement the fetch function — `supabase/functions/fetch/index.ts`**

```ts
import { createSupabaseDbClient } from '../_shared/db.ts';
import { runFetch } from '../../../src/pipeline/run-fetch.ts';
import type { HttpGet } from '../../../src/pipeline/types.ts';

const httpGet: HttpGet = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'ai-daily-digest/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

Deno.serve(async () => {
  const db = createSupabaseDbClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await runFetch({ db, httpGet });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
```

- [ ] **Step 2: Implement the summarize function — `supabase/functions/summarize/index.ts`**

```ts
import { createSupabaseDbClient } from '../_shared/db.ts';
import { runSummarize } from '../../../src/pipeline/run-summarize.ts';
import { createGeminiSummarizer } from '../../../src/pipeline/summarize.ts';

const BATCH_SIZE = 10;

Deno.serve(async () => {
  const db = createSupabaseDbClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const summarize = createGeminiSummarizer({
    apiKey: Deno.env.get('GEMINI_API_KEY')!,
    httpPostJson: async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    },
  });
  const result = await runSummarize({ db, summarize, batchSize: BATCH_SIZE });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
```

- [ ] **Step 3: Static sanity check**

- The imports resolve: `_shared/db.ts`, the `src/pipeline/*.ts` files (relative with `.ts`), and bare `@supabase/supabase-js` via `deno.json`.
- Env var names are consistent across both functions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`).
- `httpPostJson`'s returned shape matches `GeminiDeps.httpPostJson` from Task 3 (`{ ok, status, json }`).

Run: `npm run typecheck` (should remain clean; `supabase/**` is excluded from Node tsconfig).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/fetch/index.ts supabase/functions/summarize/index.ts
git commit -m "feat: Deno Edge Function entry points for fetch and summarize"
```

---

## Task 9: Schedule with pg_cron + live verification (deferred to user)

**Files:**
- Create: `supabase/migrations/0004_cron.sql`

- [ ] **Step 1: Create the cron migration — `supabase/migrations/0004_cron.sql`**

```sql
-- Requires the pg_cron and pg_net extensions (available on Supabase).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Run fetch at 07:00 UTC, then summarize at 07:05 UTC daily.
-- Replace <PROJECT_REF> and the service-role key via Supabase dashboard/secrets;
-- in local dev the functions are reachable at the kong gateway URL.
select cron.schedule(
  'daily-fetch', '0 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/fetch',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);

select cron.schedule(
  'daily-summarize', '5 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/summarize',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
```

Note: `app.functions_base_url` and `app.service_role_key` are set as database settings (or inlined per environment). Document this in the README during Task 10/Plan D; for now the migration encodes the schedule and invocation shape.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_cron.sql
git commit -m "feat: schedule daily fetch and summarize via pg_cron"
```

- [ ] **Step 3: Live verification (USER runs this; requires Docker + a Gemini API key)**

```bash
# 1. Start the local stack and apply all migrations
npx supabase start
npx supabase db reset

# 2. Serve the functions locally with secrets
echo "GEMINI_API_KEY=<your-key>" >> supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env

# 3. Seed a source (via SQL or the app once Plan C exists), then invoke:
curl -i -X POST http://localhost:54321/functions/v1/fetch \
  -H "Authorization: Bearer <local-service-role-key>"
curl -i -X POST http://localhost:54321/functions/v1/summarize \
  -H "Authorization: Bearer <local-service-role-key>"

# 4. Confirm: articles rows inserted, summaries transition pending -> done,
#    re-running fetch inserts nothing (idempotent).
```

Expected: fetch returns `{inserted: N, errors: 0}`; summarize returns `{done: N, failed: 0}`; a second fetch returns `{inserted: 0, ...}`.

---

## Definition of Done (Plan B)

- `npm test` passes: all `src/feed` + `src/pipeline` tests green (summarize, fetch-source, run-fetch, run-summarize).
- `npm run typecheck` clean; `supabase/**` (Deno) excluded from Node typecheck.
- Deno adapters (`_shared/db.ts`, both Edge Functions) and migrations (`0003_pipeline.sql`, `0004_cron.sql`) committed and statically reviewed.
- Pure orchestrators depend only on injected interfaces + the feed core — no direct `fetch`/supabase/Deno imports.
- Live DB + function + Gemini verification documented for the user (Docker-gated).

Hands off to **Plan C (mobile app)**: sign-in, source management UI, Today feed, article detail — reading the data this pipeline produces.
