# Digest Depth + Feed Sectioning + HN Recency — Design

## Why

The daily digest currently treats every source the same: a 2-3 sentence summary,
one flat undifferentiated feed, and Hacker News pulled regardless of age. The
user wants paid Substack content treated as the premium content it is — analyzed
and organized, visually separated from Hacker News, time-ordered — and HN limited
to the last day.

## What changes

1. **Two summary depths by source.** Paid email content gets an analytical summary
   (one-line core takeaway + 3-6 key bullets + a short analysis paragraph). HN and
   other sources keep the existing brief 2-3 sentence summary.
2. **Feed split into two sections.** The Today screen shows a "📧 付費訂閱" section
   above a "🟠 Hacker News" section, each sorted newest → oldest by article
   published time.
3. **Hacker News limited to the last 24 hours** at fetch time.
4. **No duplicate fetching** — already guaranteed by the `(source_id, guid)` unique
   key + `filterNewArticles`; documented here, no code change.

## Scope / non-goals

- In scope: summary-depth selection, feed sectioning + sort, HN recency filter.
- Non-goals: changing the "today's done summaries" feed window; configurable summary
  length per source; new source types.

## Architecture

### Summary depth (pure, TDD) — `src/pipeline/summarize.ts`

- `buildSummaryPrompt(input, mode?: 'brief' | 'analysis')`:
  - `'analysis'` (email): instruct one-line core takeaway, then 3-6 key bullets,
    then a short analysis/implications paragraph; same-language; no preamble.
  - `'brief'` (default, HN/other): the existing 2-3 sentence digest prompt.
- The `Summarizer` input gains `sourceType: SourceType`. `createGeminiSummarizer`
  maps `sourceType === 'email'` → `'analysis'`, else `'brief'`, and calls
  `buildSummaryPrompt(input, mode)`.
- `PendingSummary` gains `sourceType: SourceType`. `runSummarize` passes
  `item.sourceType` into the `summarize({...})` call.
- `DbClient.listPendingSummaries` returns `sourceType` (read from the joined
  `sources.type`). Runner + Deno adapter both updated.

### Feed sectioning + sort (pure grouping + RN UI)

- `FeedItem` gains `sourceType: SourceType`.
- `listTodaySummaries` selects `sources(title, type)` and maps `sourceType`.
- New pure helper `groupFeed(items: FeedItem[]): { paid: FeedItem[]; hackerNews: FeedItem[] }`
  in `src/client/feed.ts` (TDD): `paid` = items with `sourceType === 'email'`,
  `hackerNews` = the rest; each sorted by `publishedAt` descending (null dates sort
  last). Newest → oldest.
- `app/index.tsx` renders a `SectionList` with two sections ("付費訂閱",
  "Hacker News"), each from `groupFeed`. Empty sections are hidden. The article
  card and pull-to-refresh are unchanged.

### HN recency (pure, TDD) — `src/pipeline/fetch-source.ts`

- New pure helper `filterRecentArticles(articles, now, maxAgeMs)` (TDD): keep
  articles whose `publishedAt` is within `maxAgeMs` of `now`; **drop** articles with
  a null `publishedAt` (HN items always have a time, so this is safe and avoids
  keeping undated stragglers).
- `fetchSource(source, httpGet, now = Date.now())`: in the `hackernews` branch,
  after `parseHackerNewsStories`, apply `filterRecentArticles(items, now, 24h)`.
  RSS/YouTube/email are unaffected. `now` is injected for testability (default
  `Date.now()`).

### No duplicate fetching (no change)

`articles` has `unique (source_id, guid)`; `filterNewArticles` drops guids already
stored for that source and within-batch dups. Re-runs insert nothing. Confirmed,
no change.

## Error handling

- Unchanged isolation: a failing source records `last_error` and the run continues.
- `groupFeed` and `filterRecentArticles` are total functions (no throws); null/empty
  inputs yield empty groups / empty lists.

## Testing

- Unit (Vitest, no network):
  - `buildSummaryPrompt`: `'analysis'` mode contains bullet/analysis instructions;
    `'brief'`/default contains the 2-3 sentence instruction; both contain "same
    language".
  - `createGeminiSummarizer`: `sourceType:'email'` produces an analysis-mode prompt
    (URL/body still present); non-email produces brief.
  - `runSummarize`: passes `sourceType` from `PendingSummary` into `summarize`.
  - `groupFeed`: splits paid vs HN; sorts each newest→oldest; null dates last.
  - `filterRecentArticles`: keeps within window, drops older + null-dated.
  - `fetchSource` (hackernews): drops HN items older than 24h given an injected `now`.
- Manual (deferred): run the runner → FOMO posts get analytical summaries; the app
  shows two sorted sections; HN shows only last-day items.

## Definition of done

- New/changed pure logic unit-tested and green; `npm run typecheck` clean.
- Email summaries are analytical (bullets + analysis); feed shows two newest→oldest
  sections; HN fetch limited to 24h; dedup unchanged. Verified live by re-running
  the runner and refreshing the app.
