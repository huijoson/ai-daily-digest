# Email Ingestion (Paid Substack) — Design

## Why

The user pays for Substack publications (e.g. `fomosoc@substack.com`) whose full
content sits behind a login and is not in the public RSS feed. Substack delivers
each paid post in full to the user's email. Reading those emails is the robust,
legitimate way to bring the user's own paid content into their daily digest —
no cookies, no scraping a logged-in web page.

## What changes

- A new source kind, **email**, whose articles come from a Gmail mailbox via IMAP
  rather than an HTTP feed.
- Articles can now carry their **full text content**, so paid posts are summarized
  from the whole article (not just the title). This adds a `content` column to
  `articles` and threads it through to the summarizer.
- The local pipeline runner gains an email-ingestion step that runs before the
  RSS/HN fetch and the Gemini summarize.

## Scope (and non-goals)

- In scope: ingest emails from one or more configured sender addresses, parse them
  into articles, dedup, store full content, summarize via the existing pipeline.
- Start with the single sender `fomosoc@substack.com`; adding more senders later
  is just another `email` source row (no code change).
- Non-goals: managing email sources from the mobile app UI (configured via DB /
  runner for now); OAuth (we use an IMAP App Password); deleting/marking emails.

## Architecture

```
Gmail (IMAP) --imapflow+mailparser--> EmailMessage[]
                                          │  (runner, thin adapter)
                                          ▼
   runEmailIngest(deps)  ── per email source ──> parseSubstackEmail(msg) -> ParsedArticle(+content)
        │  dedup by guid (Message-ID), insert articles + pending summaries
        ▼
   runFetch (skips type 'email')  ->  runSummarize (uses article content when present)
```

### Pure logic (framework-free, Vitest-tested) — `src/pipeline/email.ts`

- **`parseSubstackEmail(msg: EmailMessage): ParsedArticle`**
  - `guid` = `msg.messageId` (always unique → natural dedup)
  - `title` = `msg.subject` trimmed (Substack subject == post title)
  - `url` = first match of `https?://[a-z0-9-]+\.substack\.com/p/[a-z0-9-]+` in
    `msg.html`, else `''`
  - `publishedAt` = `msg.date` as ISO, or `null`
  - `content` = `msg.text` (plain-text body) trimmed, or `null`
- **`runEmailIngest(deps: EmailIngestDeps): Promise<{ inserted: number; errors: number }>`**
  - lists active sources, processes only `type === 'email'`
  - per source: `fetchEmails(senderAddress)` → `parseSubstackEmail` each →
    `filterNewArticles` vs `existingGuids(sourceId)` → `insertNewArticles` →
    clear `last_error`; on throw record `last_error` and continue (per-source isolation)

### New types — `src/pipeline/notify-types.ts` is unrelated; add to `src/pipeline/types.ts`

- `EmailMessage { subject: string; html: string; text: string; messageId: string; date: string | null }`
- `EmailFetcher = (sender: string) => Promise<EmailMessage[]>`
- `EmailIngestDeps { db: DbClient; fetchEmails: EmailFetcher }`
- `ParsedArticle` gains `content?: string | null` (optional; RSS/HN leave it unset).

### Data model

- Migration: `alter type source_type add value 'email';`
- Migration: `alter table articles add column content text;`
- Seed one source row: `type='email'`, `title='FOMO研究院'`,
  `feed_url='fomosoc@substack.com'` (feed_url reused to hold the sender address),
  owned by the user. Created via the SQL editor referencing the user's id.

### Pipeline wiring

- `runFetch`: add a guard `if (source.type === 'email') continue;` so HTTP fetch
  never runs against email sources.
- `DbClient.insertNewArticles`: persist `content` (`a.content ?? null`).
- `DbClient.listPendingSummaries`: return the article's `content` so
  `runSummarize` summarizes the full text when present (falls back to title/url
  via the existing `buildSummaryPrompt` when `content` is null).
- Runner order: `runEmailIngest` → `runFetch` → `runSummarize`.

### Thin adapter (runner only) — `scripts/run-pipeline.ts`

- Add an `EmailFetcher` built on `imapflow` + `mailparser`: connect to Gmail IMAP
  (`imap.gmail.com:993`, TLS) with `GMAIL_USER` / `GMAIL_APP_PASSWORD`, search the
  mailbox for messages `FROM <sender>` (recent window, e.g. last 7 days), parse each
  with `mailparser` into `EmailMessage`, return them.
- Extend the runner's `DbClient` (and the Deno `_shared/db.ts` for parity) for the
  `content` column.

## Secrets / config

- `.env` (gitignored): `GMAIL_USER=hlchimeilawrence@gmail.com`,
  `GMAIL_APP_PASSWORD=<16-char app password>`.
- App Password requires 2-Step Verification on the Google account.

## Error handling

- A failing email source (bad credentials, IMAP error) records `sources.last_error`
  and does not abort the rest of the run (same isolation as RSS sources).
- A single unparseable email is skipped without aborting the source (guard in the
  fetcher/parse loop).
- Summaries that fail still follow the existing `failed` retry path.

## Testing

- Unit (Vitest, with fakes — no network):
  - `parseSubstackEmail`: subject→title, substack `/p/` url extraction, text→content,
    messageId→guid, null date handling.
  - `runEmailIngest`: inserts deduped articles for email sources, skips non-email
    sources, records `last_error` and continues on a failing source.
  - `runFetch`: skips `type='email'` sources (no fetch attempted).
  - `runSummarize` / `buildSummaryPrompt`: uses `content` when present.
- Manual (deferred, needs the real account): run the runner, confirm paid posts
  from `fomosoc@substack.com` appear summarized in the feed.

## Definition of done

- New pure logic unit-tested and green; `npm run typecheck` clean.
- Migration + seed documented; runner ingests email → summarize end to end
  (manually verified against the live Gmail + Supabase).
