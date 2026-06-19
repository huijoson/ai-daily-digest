## 1. buildFeedSections — per-source sections (pure, TDD)

- [x] 1.1 Write failing tests for `buildFeedSections(items, now)` in `test/client/feed.test.ts`: one section per email `sourceTitle` (capped to `MAX_PAID_ITEMS`, newest-first); a SECOND email source is NOT starved by the first (both sections populate from a mixed list); a single `hackernews` section bounded to `HN_MAX_AGE_MS` newest-first; non-email non-HN (rss) NOT recency-bounded; ordering = all non-HN sections by newest item desc, Hacker News last (assert the rss/email section positions); empty sections omitted; each section has `{ key, title, data }`
- [x] 1.2 Implement `buildFeedSections` in `src/client/feed.ts`; remove `groupFeed` and migrate its tests to `buildFeedSections`
- [x] 1.3 Full suite + typecheck green

## 2. neighbors + feedOrder store (pure + thin store, TDD)

- [x] 2.1 Write failing tests for `neighbors(ids, currentId)` in `test/client/feed.test.ts` (or a new `test/client/neighbors.test.ts`): returns adjacent ids; `prevId=null` at start, `nextId=null` at end; both `null` when id not found or list length < 2; with a duplicated id it uses the FIRST occurrence (`indexOf`) deterministically
- [x] 2.2 Implement `neighbors` in `src/client/feed.ts` (use `indexOf`)
- [x] 2.3 Create `src/client/feedOrder.ts`: module store `setFeedOrder(ids: string[])` / `getFeedOrder(): string[]` (default `[]`). (Pure-ish; add a tiny test that set→get round-trips.)
- [x] 2.4 Full suite + typecheck green

## 3. Data layer — listDigest supplies email rows per source (runtime-verified)

- [x] 3.1 `src/client/data.ts`: in `listDigest`, drop the global `.limit(MAX_PAID_ITEMS)` from the email (paid) query and order it by `published_at` (referencedTable `articles`, desc) so every email source's recent rows reach the client; the per-source cap is applied by `buildFeedSections`. Remove the stale comment referencing `groupFeed`.
- [x] 3.2 `npm run typecheck` (note: `data.ts` is outside the Node tsconfig — confirm no type regression elsewhere); runtime-verify in task 7.

## 4. Email parser — accept Mailchimp content images (TDD)

- [x] 4.1 Write a failing test in `test/pipeline/email.test.ts` with a 曼報-style Mailchimp fixture (HTML with `mcusercontent.com` content images + a 1×1 `us.list-manage.com` tracking pixel, no `*.substack.com/p/*` link): asserts title=subject, content=text, `imageUrls` keeps the `mcusercontent.com` images, drops the 1×1 pixel, and `url===''`. Keep/confirm existing Substack tests still assert `substackcdn.com` images + `…/p/…` url.
- [x] 4.2 In `src/pipeline/email.ts`, broaden `isContentImage`'s host check to accept `mcusercontent.com` content images in addition to `substackcdn.com/image/` (existing 1×1 + asset/logo/avatar filters unchanged). (Optionally rename `parseSubstackEmail` → `parseNewsletterEmail` and update the test import — low priority.)
- [x] 4.3 Full suite + typecheck green (existing Substack/FOMO behavior unchanged)

## 5. Today feed: per-source SectionList + jump bar (RN; manual)

- [x] 5.1 `app/index.tsx`: build sections via `buildFeedSections(items, Date.now())`; set `setFeedOrder(sections.flatMap(s => s.data.map(i => i.articleId)))` after load
- [x] 5.2 Render a horizontal chip bar above the list (one chip per section.title, comic-lite styled); tapping chip N calls `listRef.scrollToLocation({ sectionIndex: N, itemIndex: 0, viewOffset: 8 })`; add `onScrollToIndexFailed` that retries after ~300ms
- [x] 5.3 Keep existing header (Sources/Sign out), pull-to-refresh, empty state, comic-lite item cards
- [x] 5.4 Gates green

## 6. Article detail: Prev/Next (RN; manual)

- [x] 6.1 `app/article/[id].tsx`: `const { prevId, nextId } = neighbors(getFeedOrder(), String(id))`; render comic-lite Prev/Next buttons that `router.replace('/article/'+target)`; disable/hide the one that is null. On `id` change, reset state (`loading=true`, clear `item`) at the start of the load effect so navigating shows the loading state, not the previous article's content. Hide the "Open original" action when `item.url` is empty.
- [x] 6.2 Gates green

## 7. iOS app icon (asset + config)

- [x] 7.1 Author a comic-lite `assets/icon.png` 1024×1024 (paper bg, ink outline, red accent, a legible daily-digest motif) directly with **Python Pillow** (`PIL.ImageDraw`) via a small reproducible `scripts/make-icon.py`. Opaque (no transparency — iOS icons are opaque squares).
- [x] 7.2 Set `"icon": "./assets/icon.png"` under `expo` in `app.json`
- [x] 7.3 Gates green (asset/config only)

## 8. Verification & data (live, user/assistant-run)

- [x] 8.1 Seed 曼報 Pro: insert a `sources` row `type='email'`, `title='曼報 Pro'`, `feed_url='manny@manny-li.com'`, `is_active=true`, owned by the user
- [x] 8.2 Re-run `npx tsx scripts/run-pipeline.ts`; confirm 曼報 emails are fetched + summarized (analysis mode) and 曼報's `mcusercontent.com` chart images are stored. ("Open original" is expected to be hidden — Mailchimp digests have no canonical per-article URL.) Note: IMAP fetch is last-7-days only; older issues need a widened `since` to backfill.
- [x] 8.3 Confirm both FOMO研究院 and 曼報 Pro show as their own populated sections (validates the data-layer change — neither starves the other).
- [ ] 8.4 Rebuild the iOS app (Xcode ▶︎ Run, Release); verify: per-source sections + jump bar scrolls to each; article Prev/Next moves through the order, shows a loading state (no stale flash), and disables at the ends; 曼報 charts render; the new app icon shows on the home screen.
