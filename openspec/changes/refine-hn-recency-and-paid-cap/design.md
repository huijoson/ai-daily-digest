## Context

The Today screen renders two sections via the pure `groupFeed(items)` (paid =
`sourceType==='email'`, the rest bucketed as "Hacker News"), each newest-first.
Feed data comes from `listDigest()`: paid = all done email summaries; non-email =
done AND `updated_at >= startOfToday` (local midnight). Summaries are produced by
`runSummarize`, pulling `listPendingSummaries(batchSize)` — email-first, then
non-email, ordered `created_at` ascending. HN fetch already drops >24h articles at
fetch (`filterRecentArticles`). Dedup is enforced by `articles (source_id, guid)`
unique + `filterNewArticles` and is already covered by `test/feed/dedup.test.ts`.

**The only non-email source in use is Hacker News.** This design treats the
non-email/"Hacker News" bucket as Hacker News; `rss`/`youtube` source types are not
currently used and are explicitly out of scope (if added later they would need
their own section/recency handling — the 24h bound here keys on
`sourceType==='hackernews'` so it never silently hides other types).

Problem: a `pending` backlog (~39) processed oldest-first means today's batch
summarizes the OLDEST pending HN, which may be days old; and `listDigest` gates HN
on `updated_at` (when summarized), not publish time. So an HN published >24h ago can
appear, and a naive display-only filter could leave the section empty. The recency
requirement must be enforced on selection, the data query, AND display.

## Goals / Non-Goals

**Goals:** HN section shows only articles published in the last 24h; paid section
shows only the latest 3; fresh HN actually get summarized (not starved by stale
backlog); dedup unchanged.

**Non-Goals:** no DB migration; no change to email/paid ingestion or multimodal
summaries; no destructive deletion of stale `pending` rows (they are simply never
selected again); `rss`/`youtube` non-email sources are out of scope.

## Decisions

### Constants
- `HN_MAX_AGE_MS = 24*60*60*1000` lives in `src/pipeline/constants.ts` (next to
  `MAX_ARTICLE_IMAGES`) so BOTH the client and the Deno/runner adapters import the
  same value (the Deno `_shared/db.ts` and the runner already import from `src/`).
- `MAX_PAID_ITEMS = 3` lives in `src/client/constants.ts` (display-only).
- Note: `fetch-source.ts` keeps its own `ONE_DAY_MS` for the fetch bound; the design
  acknowledges the cutoff exists in fetch + selection + display and all use 24h.

### `groupFeed(items, now)` (pure, TDD)
- New `now: number` parameter (same pattern as `formatRelativeTime(iso, now)`).
- `paid` = `sourceType==='email'`, sorted by `publishedAt` desc, `slice(0, MAX_PAID_ITEMS)`.
- `hackerNews` = items NOT email; for items whose `sourceType==='hackernews'`, keep
  only those with `publishedAt` present AND `now - publishedAt <= HN_MAX_AGE_MS`;
  non-email items that are NOT hackernews (none today) pass through unfiltered.
  Sort the bucket desc.

### `app/index.tsx`
- Call `groupFeed(items, Date.now())`. No other UI change.

### `listDigest()` data query (`src/client/data.ts`, adapter — live-verified)
- Non-email (Hacker News) query: replace the `.gte('updated_at', startOfToday)` gate
  with a publish-time window so the data source matches the requirement and the
  spec's "recent HN is shown" scenario holds regardless of when it was summarized:
  - `.gte('articles.published_at', cutoff)` where
    `cutoff = new Date(Date.now() - HN_MAX_AGE_MS).toISOString()` (UTC ISO).
  - order newest-first by the embedded column using the referenced-table form:
    `.order('published_at', { referencedTable: 'articles', ascending: false })`.
    (The dotted FILTER `.gte('articles.published_at', ...)` is valid with the
    existing `articles!inner(...)`; only ORDER needs `referencedTable`.)
- Paid query: add `.limit(MAX_PAID_ITEMS)` so we do not fetch unbounded paid rows
  (display already caps to 3; this bounds the fetch too).

### Recency-bounded, newest-first HN selection (`listPendingSummaries`, adapters)
In BOTH `scripts/run-pipeline.ts` and `supabase/functions/_shared/db.ts`:
- The non-email pending query gains `.gte('articles.published_at', cutoff)` (UTC ISO,
  `Date.now() - HN_MAX_AGE_MS`) and orders newest-first via
  `.order('published_at', { referencedTable: 'articles', ascending: false })` — so
  the batch is spent on the freshest HN and the stale backlog is never selected.
- **Parity caveat (they are NOT identical today):** the Deno query already has
  `.lt('attempts', MAX_SUMMARY_ATTEMPTS)`; the runner does not. The recency bound
  must be ADDED while PRESERVING Deno's attempts filter. Additionally bring the
  runner to parity: add `.lt('attempts', MAX_SUMMARY_ATTEMPTS)` to its sub-queries
  and make its `markSummaryFailed` increment attempts via the existing
  `increment_summary_failure` RPC (migration 0003), so a permanently-failing paid
  row can't re-run every time and crowd out HN.
- Batch size: raise the runner `runSummarize` `batchSize` 8→30 in `main()` AND the
  Deno Edge Function `BATCH_SIZE` 10→30 (parity), and fix the runner log string
  `"(up to 8)"`. The Edge Function path is currently dormant in this deployment
  (the launchd local runner is the active summarizer) but is kept at parity.

### Dedup
- No production change. The behavior is already covered by
  `test/feed/dedup.test.ts` (drops existing guid + within-batch dup + idempotent
  re-run). No new test needed.

### Verification reality
- `tsconfig.json` `include` is `["src","test"]` and explicitly excludes
  `src/client/data.ts`; `scripts/` and `supabase/**` are outside it. So
  `npm test`/`npm run typecheck` do NOT cover `listDigest` or the adapter
  `listPendingSummaries` changes. Those are **manually verified via the live run**
  (a required step, not optional). Only `groupFeed` (pure) is gate-covered.

## Risks / Trade-offs
- Stale pending rows linger (never selected) — harmless; avoids a destructive migration.
- Bigger batch (30) = more Gemini calls/run — within free-tier for a daily run.
- HN section can legitimately be empty if nothing was published in 24h — intended.
- Adapter query changes aren't gate-covered — mitigated by the required live verify.
- 24h cutoff exists in fetch + selection + display; all reference 24h (shared
  `HN_MAX_AGE_MS` for selection/display; `fetch-source` keeps `ONE_DAY_MS`).

## Migration Plan
1. Add constants; ship pure `groupFeed(items, now)` (TDD).
2. Update `app/index.tsx` caller.
3. Update `listDigest` (publish-window + paid limit) and `listPendingSummaries`
   (recency + newest-first via referencedTable; runner attempts parity); raise
   batch sizes; fix log string.
4. Gates green (groupFeed covered); then REQUIRED live verify: re-run pipeline +
   rebuild iOS app; confirm HN = last 24h and paid = latest 3.
No rollback risk: changes are additive/bounded.

## Open Questions
- Paid cap (3) and HN window (24h) are fixed per the user; easy to tune via constants.
