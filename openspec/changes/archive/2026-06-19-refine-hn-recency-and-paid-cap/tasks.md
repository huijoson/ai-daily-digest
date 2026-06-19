## 1. Constants

- [ ] 1.1 Add `HN_MAX_AGE_MS = 24 * 60 * 60 * 1000` to `src/pipeline/constants.ts` (shared: client + adapters import it)
- [ ] 1.2 Create `src/client/constants.ts` exporting `MAX_PAID_ITEMS = 3`

## 2. groupFeed: paid cap + HN 24h window (pure, TDD)

- [ ] 2.1 Write failing tests for `groupFeed(items, now)`: paid capped to `MAX_PAID_ITEMS` newest-first; Hacker News items (`sourceType==='hackernews'`) kept only when `publishedAt` is within `HN_MAX_AGE_MS` of `now`, newest-first; undated HN dropped; a non-email non-HN item (e.g. `rss`) is NOT recency-filtered; existing split preserved
- [ ] 2.2 Update `groupFeed` in `src/client/feed.ts` to take `now: number`; cap paid to `MAX_PAID_ITEMS`; for the HN bucket apply the 24h window only to `sourceType==='hackernews'`; keep sort desc; update existing `groupFeed` tests for the new signature
- [ ] 2.3 Run full suite + typecheck green

## 3. App passes now (RN; manual-verified)

- [ ] 3.1 In `app/index.tsx`, call `groupFeed(items, Date.now())`
- [ ] 3.2 Confirm gates stay green (app/ outside Node tsconfig)

## 4. Dedup — already satisfied (no change)

- [ ] 4.1 Verify `test/feed/dedup.test.ts` already covers no-duplicate-fetch (drops existing guid, within-batch dup, idempotent re-run). No new test, no code change — just confirm.

## 5. listDigest: HN publish-window + paid limit (adapter; live-verified)

- [ ] 5.1 In `src/client/data.ts` `listDigest`, change the non-email query gate from `.gte('updated_at', startOfToday)` to a publish window: `.gte('articles.published_at', new Date(Date.now() - HN_MAX_AGE_MS).toISOString())`, and order newest-first with `.order('published_at', { referencedTable: 'articles', ascending: false })` (keep the existing `articles!inner(...)`). Import `HN_MAX_AGE_MS`.
- [ ] 5.2 In the paid query, add `.limit(MAX_PAID_ITEMS)` (bounds the fetch; display already caps). Import `MAX_PAID_ITEMS`.

## 6. Recency-bounded, newest-first HN selection (adapters; live-verified)

- [ ] 6.1 Runner `scripts/run-pipeline.ts` `listPendingSummaries` non-email sub-query: add `.gte('articles.published_at', new Date(Date.now() - HN_MAX_AGE_MS).toISOString())` and `.order('published_at', { referencedTable: 'articles', ascending: false })`; ALSO add `.lt('attempts', MAX_SUMMARY_ATTEMPTS)` to BOTH sub-queries (parity with Deno); import the constants
- [ ] 6.2 Runner `markSummaryFailed`: increment attempts via the `increment_summary_failure` RPC (migration 0003) instead of a bare `status='failed'` update (parity; prevents a failing paid row re-running every time)
- [ ] 6.3 Runner `main()`: raise `runSummarize` `batchSize` 8→30 and update the log string `"(up to 8)"` → `"(up to 30)"`
- [ ] 6.4 Deno `supabase/functions/_shared/db.ts` `listPendingSummaries` non-email sub-query: add the SAME `.gte('articles.published_at', cutoff)` + `.order('published_at', { referencedTable: 'articles', ascending: false })`, PRESERVING the existing `.lt('attempts', MAX_SUMMARY_ATTEMPTS)`
- [ ] 6.5 Deno `supabase/functions/summarize/index.ts`: raise `BATCH_SIZE` 10→30 (parity; path is dormant but kept consistent)
- [ ] 6.6 Confirm `npm test` + `npm run typecheck` stay green (these adapter files are NOT gate-covered — correctness is verified live in Task 7)

## 7. Live verification (REQUIRED, user-run)

- [ ] 7.1 Re-run `npx tsx scripts/run-pipeline.ts`; confirm it does not error on the `referencedTable` ordering, fresh HN get summarized, stale backlog is skipped
- [ ] 7.2 Rebuild the iOS app (Xcode ▶︎ Run, Release); confirm the Hacker News section shows only last-24h items and the paid section shows the latest 3
