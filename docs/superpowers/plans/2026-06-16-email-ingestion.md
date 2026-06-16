# Email Ingestion (Paid Substack) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the user's paid Substack content into the digest by reading the delivery emails over IMAP, parsing them into full-text articles, and summarizing them through the existing pipeline.

**Architecture:** Pure, injected-dependency logic in `src/pipeline/email.ts` (`parseSubstackEmail`, `runEmailIngest`) is Vitest-tested with fakes. Articles gain a `content` column so paid full text is summarized (not just the title). The local runner adds a thin IMAP adapter (`imapflow` + `mailparser`) that feeds the pure ingest step, which runs before `runFetch` and `runSummarize`.

**Tech Stack:** TypeScript, Vitest, `imapflow`, `mailparser` (runner only), Supabase (Postgres).

**Spec:** `docs/superpowers/specs/2026-06-16-email-ingestion-design.md`.

**Prereqs:** the existing pipeline (`src/pipeline/*`, `src/feed/dedup.ts`), the runner `scripts/run-pipeline.ts`, and a live Supabase project.

---

## File Structure

```
src/pipeline/types.ts          # MODIFY: ParsedArticle gains content?; add EmailMessage/EmailFetcher/EmailIngestDeps
src/pipeline/email.ts          # NEW: parseSubstackEmail + runEmailIngest (pure)   (TDD)
src/pipeline/run-fetch.ts      # MODIFY: skip type 'email' sources
src/pipeline/run-summarize.ts  # (unchanged — already passes content via PendingSummary)
test/pipeline/email.test.ts    # NEW
test/pipeline/run-fetch.test.ts# MODIFY: add "skips email sources" test
supabase/migrations/0006_email.sql   # NEW: enum value 'email' + articles.content column
scripts/run-pipeline.ts        # MODIFY: content in DbClient; IMAP EmailFetcher; run order
```

Tasks 1–4 are pure TDD. Task 5 is SQL (static). Task 6 wires the runner (manual-verified). The existing `PendingSummary` already has a `content` field, so `runSummarize`/`buildSummaryPrompt` need no change once the DB returns it.

---

## Task 1: ParsedArticle gains content; add email types (TDD via existing suite)

**Files:**
- Modify: `src/pipeline/types.ts`

- [ ] **Step 1: Add `content` to `ParsedArticle` and the email types**

In `src/pipeline/types.ts`, change the `ParsedArticle` import-and-use is in `src/feed/types.ts` — note `ParsedArticle` is defined in `src/feed/types.ts`, NOT here. So modify `src/feed/types.ts` for `content`, and add the email types to `src/pipeline/types.ts`.

First, in `src/feed/types.ts`, add an optional `content` field to `ParsedArticle`:
```ts
export interface ParsedArticle {
  guid: string;
  title: string;
  url: string;
  publishedAt: string | null; // ISO 8601, or null if the feed omits a date
  content?: string | null;     // full text when available (e.g. email body); else unset/null
}
```

Then, in `src/pipeline/types.ts`, append the email-ingestion types at the end of the file:
```ts
export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
  messageId: string;
  date: string | null; // ISO 8601 or null
}

export type EmailFetcher = (sender: string) => Promise<EmailMessage[]>;

export interface EmailIngestDeps {
  db: DbClient;
  fetchEmails: EmailFetcher;
}
```

- [ ] **Step 2: Run the full suite + typecheck to confirm nothing broke**

Run: `npm test && npm run typecheck`
Expected: all 65 tests still pass (adding an optional field + new types is backward-compatible); typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add src/feed/types.ts src/pipeline/types.ts
git commit -m "feat: add optional article content and email-ingestion types"
```

---

## Task 2: parseSubstackEmail (TDD)

**Files:**
- Create: `src/pipeline/email.ts`
- Test: `test/pipeline/email.test.ts`

- [ ] **Step 1: Write the failing test — `test/pipeline/email.test.ts`**

```ts
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
```

Note: the url test expects the query string (`?utm=1`) stripped — the regex matches only `https://<host>.substack.com/p/<slug>`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- email`
Expected: FAIL — cannot find module `../../src/pipeline/email`.

- [ ] **Step 3: Implement — `src/pipeline/email.ts`** (parser only for this task)

```ts
import type { EmailMessage } from './types';
import type { ParsedArticle } from '../feed/types';

const SUBSTACK_POST_RE = /https?:\/\/[a-z0-9-]+\.substack\.com\/p\/[a-z0-9-]+/i;

export function parseSubstackEmail(msg: EmailMessage): ParsedArticle {
  const url = msg.html.match(SUBSTACK_POST_RE)?.[0] ?? '';
  const content = msg.text.trim();
  return {
    guid: msg.messageId,
    title: msg.subject.trim(),
    url,
    publishedAt: msg.date,
    content: content.length > 0 ? content : null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- email`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/email.ts test/pipeline/email.test.ts
git commit -m "feat: parse a Substack delivery email into an article with full content"
```

---

## Task 3: runEmailIngest (TDD)

**Files:**
- Modify: `src/pipeline/email.ts` (add `runEmailIngest`)
- Test: `test/pipeline/email.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `test/pipeline/email.test.ts`**

Add `runEmailIngest` to the import from `'../../src/pipeline/email'`, and add type imports + cases:
```ts
import { runEmailIngest } from '../../src/pipeline/email';
import type { DbClient, SourceRow } from '../../src/pipeline/types';
import type { ParsedArticle } from '../../src/feed/types';

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
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- email`
Expected: FAIL — `runEmailIngest` is not exported.

- [ ] **Step 3: Add `runEmailIngest` to `src/pipeline/email.ts`**

```ts
import { filterNewArticles } from '../feed/dedup';
import type { EmailIngestDeps } from './types';

export async function runEmailIngest(deps: EmailIngestDeps): Promise<{ inserted: number; errors: number }> {
  const sources = (await deps.db.listActiveSources()).filter((s) => s.type === 'email');
  let inserted = 0;
  let errors = 0;
  for (const source of sources) {
    try {
      if (!source.feedUrl) throw new Error(`email source ${source.id} has no sender address`);
      const messages = await deps.fetchEmails(source.feedUrl);
      const parsed = messages.map(parseSubstackEmail);
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

Run: `npm test -- email`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/pipeline/email.ts test/pipeline/email.test.ts
git commit -m "feat: email ingestion orchestration (dedup, per-source isolation)"
```

---

## Task 4: runFetch skips email sources (TDD)

**Files:**
- Modify: `src/pipeline/run-fetch.ts`
- Test: `test/pipeline/run-fetch.test.ts`

- [ ] **Step 1: Add a failing test to `test/pipeline/run-fetch.test.ts`**

Append this test inside the existing `describe('runFetch', ...)` block (the `makeDb`, `RSS`, and imports already exist in that file):
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- run-fetch`
Expected: FAIL — currently runFetch calls `fetchSource` for the email source, which throws (no feed handling), so `errors` would be 1 and/or `httpGet`/parse path differs from the expected `{inserted:0,errors:0}` with `called === false`.

- [ ] **Step 3: Add the skip guard in `src/pipeline/run-fetch.ts`**

Inside the `for (const source of sources)` loop, add the guard as the first line of the loop body (before the `try`):
```ts
  for (const source of sources) {
    if (source.type === 'email') continue; // email sources are handled by runEmailIngest
    try {
      const parsed = await fetchSource(source, deps.httpGet);
      const existing = await deps.db.existingGuids(source.id);
      const fresh = filterNewArticles(parsed, existing);
      inserted += await deps.db.insertNewArticles(source.id, fresh);
      await deps.db.recordSourceError(source.id, null);
    } catch (e) {
      errors += 1;
      await deps.db.recordSourceError(source.id, e instanceof Error ? e.message : String(e));
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- run-fetch`
Expected: PASS (4 tests in the file).

- [ ] **Step 5: Run FULL suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (email + run-fetch + everything); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/run-fetch.ts test/pipeline/run-fetch.test.ts
git commit -m "feat: runFetch skips email sources (handled by runEmailIngest)"
```

---

## Task 5: DB migration — email enum + content column (static)

**Files:**
- Create: `supabase/migrations/0006_email.sql`

Docker is down, so this is committed and applied by the user in the Supabase SQL editor (Task 6 step covers it). Write it correctly; static review.

- [ ] **Step 1: Create `supabase/migrations/0006_email.sql`**

```sql
-- Add the 'email' source kind and a full-text content column for articles.
alter type source_type add value if not exists 'email';
alter table articles add column if not exists content text;
```

- [ ] **Step 2: Static sanity check + commit**

Confirm: `source_type` is the enum from `0001_init.sql`; `articles` exists; both statements are idempotent (`if not exists`). `npm test && npm run typecheck` unaffected (no app code changed).

```bash
git add supabase/migrations/0006_email.sql
git commit -m "feat: add 'email' source type and articles.content column"
```

---

## Task 6: Wire the runner — content + IMAP fetcher + run order (manual-verified)

**Files:**
- Modify: `scripts/run-pipeline.ts`
- Modify: `supabase/functions/_shared/db.ts` (parity: persist/return content)
- Modify: `package.json` (add `imapflow`, `mailparser`)

The runner is not Node-typechecked by the suite; verify by reading + a real run. The gates (`npm test`, `npm run typecheck`) must stay green.

- [ ] **Step 1: Install IMAP deps**

Run: `npm install imapflow mailparser`
(They are used only by the runner. `npm test`/`typecheck` cover `src/`+`test/`, not `scripts/`, so these don't affect the gates.)

- [ ] **Step 2: Thread `content` through the runner's DbClient — `scripts/run-pipeline.ts`**

In `insertNewArticles`, include `content`:
```ts
  async insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number> {
    if (articles.length === 0) return 0;
    const { data, error } = await sb.from('articles').insert(
      articles.map((a) => ({
        source_id: sourceId, guid: a.guid, title: a.title, url: a.url,
        published_at: a.publishedAt, content: a.content ?? null,
      })),
    ).select('id');
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { error: sErr } = await sb.from('summaries').insert(ids.map((id) => ({ article_id: id, status: 'pending' })));
      if (sErr) throw sErr;
    }
    return ids.length;
  },
```

In `listPendingSummaries`, return the article's `content`:
```ts
  async listPendingSummaries(limit: number): Promise<PendingSummary[]> {
    const { data, error } = await sb.from('summaries')
      .select('article_id, articles(title, url, content)')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => {
      const article = one<any>(r.articles);
      return {
        articleId: r.article_id,
        title: article?.title ?? '',
        url: article?.url ?? '',
        content: article?.content ?? null,
      };
    });
  },
```

- [ ] **Step 3: Add the IMAP email fetcher + run it — `scripts/run-pipeline.ts`**

Add imports near the top:
```ts
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { runEmailIngest } from '../src/pipeline/email';
import type { EmailFetcher } from '../src/pipeline/types';
```

After the `summarize` const is defined (before the `main()` run block), add the fetcher:
```ts
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

const fetchEmails: EmailFetcher = async (sender) => {
  if (!gmailUser || !gmailPass) {
    console.log('     (skipping email: GMAIL_USER / GMAIL_APP_PASSWORD not set)');
    return [];
  }
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: gmailUser, pass: gmailPass }, logger: false,
  });
  await client.connect();
  const out: import('../src/pipeline/types').EmailMessage[] = [];
  try {
    await client.mailboxOpen('INBOX');
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days
    for await (const msg of client.fetch({ from: sender, since }, { source: true })) {
      const parsed = await simpleParser(msg.source as Buffer);
      out.push({
        subject: parsed.subject ?? '',
        html: typeof parsed.html === 'string' ? parsed.html : '',
        text: parsed.text ?? '',
        messageId: parsed.messageId ?? `imap:${msg.uid}`,
        date: parsed.date ? parsed.date.toISOString() : null,
      });
    }
  } finally {
    await client.logout();
  }
  return out;
};
```

- [ ] **Step 4: Update `main()` to run email ingest first — `scripts/run-pipeline.ts`**

```ts
async function main() {
  console.log('1/3  Ingesting emails…');
  console.log('     ', await runEmailIngest({ db, fetchEmails }));
  console.log('2/3  Fetching feeds…');
  console.log('     ', await runFetch({ db, httpGet }));
  console.log('3/3  Summarizing with Gemini (up to 8)…');
  console.log('     ', await runSummarize({ db, summarize, batchSize: 8 }));
  console.log('Done. Refresh the app to see today\'s summaries.');
}
```

- [ ] **Step 5: Parity — persist/return content in the Deno adapter `supabase/functions/_shared/db.ts`**

So a future deployed pipeline behaves the same. In `insertNewArticles`, add `content: a.content ?? null` to the inserted object. In `listPendingSummaries`, change the select to `'article_id, articles(title, url, content)'` and add `content: article?.content ?? null` to the returned object (the file already has the `Array.isArray(...)` normalization — reuse it). Do not change other methods.

- [ ] **Step 6: Confirm gates, then commit**

Run: `npm test && npm run typecheck`
Expected: 73 tests pass (65 baseline + 7 email + 1 run-fetch); typecheck clean. (`scripts/` and `supabase/**` are outside the Node tsconfig.)

```bash
git add scripts/run-pipeline.ts supabase/functions/_shared/db.ts package.json package-lock.json
git commit -m "feat: runner ingests Substack emails over IMAP and summarizes full content"
```

- [ ] **Step 7: Live setup (USER does this)**

1. **Gmail App Password:** Google Account → Security → 2-Step Verification (enable if off) → App passwords → create one → copy the 16-char code.
2. Add to `.env`:
   ```
   GMAIL_USER=hlchimeilawrence@gmail.com
   GMAIL_APP_PASSWORD=<16-char code, spaces removed>
   ```
3. **Apply the migration** in the Supabase SQL editor (paste and Run):
   ```sql
   alter type source_type add value if not exists 'email';
   alter table articles add column if not exists content text;
   ```
4. **Seed the email source** in the SQL editor:
   ```sql
   insert into sources (user_id, type, title, feed_url, is_active)
   select id, 'email', 'FOMO研究院', 'fomosoc@substack.com', true
     from auth.users where email = 'hlchimeilawrence@gmail.com';
   ```
5. **Run it:** `npx tsx scripts/run-pipeline.ts` → confirm `Ingesting emails…` reports `inserted > 0`, then refresh the app and confirm the FOMO posts appear summarized.

---

## Definition of Done

- `npm test` passes including the new `email` tests and the runFetch skip test; `npm run typecheck` clean.
- `parseSubstackEmail` and `runEmailIngest` are pure and unit-tested; `runFetch` skips email sources.
- Migration `0006_email.sql` committed; runner ingests emails over IMAP and stores full content; `summarize` uses that content.
- Live: a paid post from `fomosoc@substack.com` shows up summarized in the feed (manual, user-run).
