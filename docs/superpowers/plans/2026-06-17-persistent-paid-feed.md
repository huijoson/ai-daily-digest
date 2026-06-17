# Persistent Paid Section, Daily Hacker News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the paid (email/FOMO) section show ALL completed paid summaries (no time window), while Hacker News stays today-only, so paid content stops disappearing the next day.

**Architecture:** Replace the single today-windowed feed query with two merged queries — paid (email) with no time filter, non-email with the today filter — both mapped via the existing `mapFeedRow` and returned as one `FeedItem[]`. The screen's `groupFeed` already re-splits and sorts, so no UI logic changes beyond a function rename.

**Tech Stack:** TypeScript, Expo (React Native), Supabase.

**Spec:** `docs/superpowers/specs/2026-06-17-persistent-paid-feed-design.md`.

---

## File Structure

```
src/client/data.ts    # MODIFY: replace listTodaySummaries with listDigest (two merged queries)
app/index.tsx         # MODIFY: import + call listDigest instead of listTodaySummaries
```

`data.ts` is excluded from the Node tsconfig and `app/` is outside it, so this is verified by gates staying green + manual Expo check (per existing convention). The pure logic with tests (`mapFeedRow`, `groupFeed`) is untouched.

---

## Task 1: Two-window feed query (paid = all, HN = today)

**Files:**
- Modify: `src/client/data.ts`

- [ ] **Step 1: Replace `listTodaySummaries` with `listDigest` in `src/client/data.ts`**

Replace the whole `listTodaySummaries` function (the one documented "Today's completed summaries…") with:

```ts
/**
 * Feed items for the digest: ALL completed paid (email) summaries (no time window,
 * so weekly paid posts persist) plus today's completed non-email summaries.
 * RLS limits rows to the current user. The screen's groupFeed re-splits + sorts.
 */
export async function listDigest(): Promise<FeedItem[]> {
  const sel = 'article_id, summary_text, articles!inner(title, url, published_at, image_urls, sources!inner(title, type))';

  const paidQ = await supabase
    .from('summaries')
    .select(sel)
    .eq('status', 'done')
    .eq('articles.sources.type', 'email')
    .order('updated_at', { ascending: false });
  if (paidQ.error) throw paidQ.error;

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayQ = await supabase
    .from('summaries')
    .select(sel)
    .eq('status', 'done')
    .neq('articles.sources.type', 'email')
    .gte('updated_at', startOfToday.toISOString())
    .order('updated_at', { ascending: false });
  if (todayQ.error) throw todayQ.error;

  return [...(paidQ.data ?? []), ...(todayQ.data ?? [])].map(mapFeedRow);
}
```

(Keep `getFeedItem` and everything else in the file unchanged. Note the select uses `!inner` joins so the `.eq('articles.sources.type', ...)` filter applies — this matches the pattern already used in `scripts/run-pipeline.ts`/`supabase/functions/_shared/db.ts` `listPendingSummaries`.)

- [ ] **Step 2: Update the caller — `app/index.tsx`**

Change the import on the line that currently reads `import { listTodaySummaries } from '../src/client/data';` to:
```tsx
import { listDigest } from '../src/client/data';
```
And in the `load` callback, change `await listTodaySummaries()` to `await listDigest()`.

- [ ] **Step 3: Confirm no other references to the old name**

Run: `grep -rn "listTodaySummaries" src app test scripts supabase`
Expected: no matches (the rename is complete). If any remain, update them to `listDigest`.

- [ ] **Step 4: Confirm gates stay green**

Run: `npm test && npm run typecheck`
Expected: 112 tests pass; typecheck clean. (`data.ts` and `app/` are outside the Node tsconfig; the pure-logic tests are unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/client/data.ts app/index.tsx
git commit -m "feat: paid section shows all summaries; Hacker News stays today-only"
```

- [ ] **Step 6: Manual verification (USER, after merge)**

Refresh the app: the "📧 付費訂閱" section shows FOMO posts from previous days (not just today); the "🟠 Hacker News" section still shows only today's items. (No pipeline re-run needed — this is a read-side change; the data is already in the DB.)

---

## Definition of Done

- `listDigest` returns all `done` paid summaries plus today's non-email summaries; `app/index.tsx` calls it; no stale `listTodaySummaries` references remain.
- `npm test` green, `npm run typecheck` clean.
- Verified live: yesterday's FOMO is visible today in the paid section; Hacker News is still today-only.
