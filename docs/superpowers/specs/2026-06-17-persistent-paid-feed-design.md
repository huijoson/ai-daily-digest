# Persistent Paid Section, Daily Hacker News — Design

## Why

The Today feed shows only summaries whose `updated_at` is today. Hacker News is
daily, so that is fine for it. But paid Substack (FOMO) is a roughly-weekly
newsletter: the day after a FOMO post is summarized it falls outside the "today"
window and disappears, and most days there is no new paid post — so the paid
section is empty almost every day. The user wants paid content to persist.

## What changes

- The paid (email) section shows ALL of the user's `done` paid summaries
  (no time window), newest first.
- The Hacker News section is unchanged: only today's `done` summaries.

## Scope / non-goals

- In scope: the feed data query (`src/client/data.ts`) — fetch paid summaries with
  no time filter and Hacker-News summaries with the existing today filter, merged.
- Non-goals: a new screen/tab (the existing "付費訂閱" section IS the dedicated paid
  area — it just needs to stop being cleared daily); changing `getFeedItem`, the
  grouping/sort logic (`groupFeed`), ingestion, or summarization; any pagination
  cap (the user chose "all").

## Architecture

### Data layer — `src/client/data.ts`
Replace the single-window `listTodaySummaries` query with two queries, merged:

- **Paid (email):** `summaries` where `status='done'` AND the joined
  `sources.type = 'email'`, no `updated_at` filter, ordered by article
  `published_at` desc. (Use the PostgREST inner-join filter
  `.eq('articles.sources.type', 'email')` with `articles!inner(...sources!inner(...))`.)
- **Today (non-email):** `summaries` where `status='done'` AND
  `sources.type != 'email'` AND `updated_at >= start of today`, as today.
- Map both result sets via the existing `mapFeedRow`, concatenate, and return one
  `FeedItem[]`. The screen's `groupFeed` re-splits paid vs Hacker News and sorts each
  newest-first, so the merge order does not matter.

Rename the function to `listDigest()` to reflect the new semantics; update its one
caller (`app/index.tsx`). (`getFeedItem` for the detail view is unchanged.)

### Screen — unchanged
`app/index.tsx` already renders two `groupFeed` sections ("📧 付費訂閱",
"🟠 Hacker News"). Only the import name changes (`listTodaySummaries` → `listDigest`).

## Error handling
- Each query surfaces its Supabase error as today (throw). If the paid query returns
  nothing, the paid section is simply empty (same empty-state behavior).
- RLS still scopes both queries to the signed-in user.

## Testing
- The two queries live in `data.ts` (excluded from the Node tsconfig, verified
  manually in Expo, per existing convention). The pure logic that has tests —
  `mapFeedRow` and `groupFeed` — is unchanged and must stay green.
- `npm test` + `npm run typecheck` stay green.
- Manual (Expo): a FOMO post summarized on a previous day still appears in the paid
  section today; the Hacker News section still shows only today's items.

## Definition of done
- The paid section shows all `done` paid summaries (newest first); Hacker News shows
  only today's. `npm test` green, `npm run typecheck` clean. Verified live: yesterday's
  FOMO is still visible today.
