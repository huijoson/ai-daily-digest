## Why

Two feed-quality problems the user hit in daily use:
- The Hacker News section can show stale items. Because a backlog of `pending`
  summaries is processed oldest-first, an HN article published days ago can be
  summarized today and appear as if it were today's news. The user wants HN to
  show only genuinely recent (last 24h) stories.
- The paid (FOMO) section now persists all past posts, which grows unbounded. The
  user wants just the latest 3.

Duplicate fetching is already prevented (the `articles` `(source_id, guid)` unique
constraint + `filterNewArticles`); this change verifies that and adds no new fetch.

## What Changes

- **Hacker News shows only last-24h articles** (by publish time) in the feed, and —
  so that requirement is actually satisfiable — the summarizer only spends effort on
  recent non-email articles (stale backlog HN are no longer selected), newest-first,
  with a batch large enough to cover a day's fresh HN.
- **Paid (FOMO) section is capped to the latest 3** posts.
- **No duplicate fetching** — confirmed already satisfied; covered by a verification
  note/test, no new code path.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-feed`: the feed limits Hacker News to last-24h items and the paid section to
  the latest 3.
- `summarization`: the pending-selection only summarizes recent (last-24h) non-email
  articles, newest-first, so fresh HN are not starved by an old backlog.

## Impact

- **Pure logic (TDD):** `groupFeed(items, now)` gains a `now` argument; paid is
  capped to 3, Hacker News is filtered to `publishedAt` within 24h of `now`; both
  newest-first.
- **App:** `app/index.tsx` passes `Date.now()` to `groupFeed` (no other UI change).
- **Data layer (adapters, static-verified):** `listPendingSummaries` (runner +
  Deno) selects non-email pending only when the article was published within 24h,
  newest-first; the daily runner batch size is raised so a day's fresh HN are all
  summarized. The existing stale `pending` rows are simply never selected again (no
  destructive cleanup needed).
- **No DB migration.** No change to ingestion, dedup, or the paid (email) flow other
  than the display cap.
- **No breaking changes:** `groupFeed`'s new `now` parameter is internal; behavior
  for paid vs HN sectioning is preserved, only bounded.
