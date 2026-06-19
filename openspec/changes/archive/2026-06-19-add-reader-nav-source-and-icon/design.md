## Context

The Today screen renders two sections via the pure `groupFeed(items, now)` →
`{ paid, hackerNews }` (paid = all email, capped to `MAX_PAID_ITEMS`; hackerNews =
last-24h). `FeedItem` carries `sourceTitle` (e.g. "FOMO研究院", "Hacker News") and
`sourceType`. The article detail (`app/article/[id].tsx`) loads one item by id via
`getFeedItem`. Email ingestion *fetches* any number of `email` sources generically
(`runEmailIngest` iterates active email sources by sender), but *parsing* is
Substack-specific (`parseSubstackEmail`). There is no app icon configured (no
`expo.icon`, no `assets/`).

The data layer (`src/client/data.ts`, excluded from the Node tsconfig — manually
verified) currently caps email summaries GLOBALLY: `listDigest`'s paid query is
`.eq('articles.sources.type','email').order('updated_at',desc).limit(MAX_PAID_ITEMS)`.
With one newsletter this happens to fill the paid section; with two it returns only 3
email rows TOTAL across both, so a second newsletter's section is routinely
starved/empty. The per-source feature therefore requires a data-layer change, not just
UI grouping.

## Goals / Non-Goals

**Goals:** per-source feed sections + jump-to-source; prev/next in the detail view;
ingest 曼報 Pro; a fitting iOS icon.

**Non-Goals:** no DB migration; no change to summarization/dedup logic or the fetch/IMAP
flow (only the email content-image filter is broadened); no title translation; no
Android-specific icon work beyond what `expo.icon` covers.

## Decisions

### Data layer — `listDigest` supplies email rows per source (`src/client/data.ts`)
Remove the global `.limit(MAX_PAID_ITEMS)` from the email (paid) query so every active
email source's recent rows reach the client; the per-source cap is then enforced in
`buildFeedSections`. Order by `articles.published_at` desc (referencedTable form, like
the HN query) for determinism. Email volume is low (weekly newsletters, a handful per
source), so fetching all `done` email rows and capping client-side is cheap and
correct — it cannot starve a second newsletter the way a single global limit does.
Also fix the stale comment that references the removed `groupFeed`. `data.ts` is
outside the Node tsconfig, so this is verified at runtime, not by Vitest.

### Per-source sections — `buildFeedSections(items, now)` (pure, TDD; replaces groupFeed)
Returns an ordered `FeedSection[]`, `FeedSection = { key: string; title: string; data: FeedItem[] }`:
- **Email sources:** group items with `sourceType === 'email'` by `sourceTitle`; each
  group is one section titled `📧 ${sourceTitle}`, its items newest-first, capped to
  `MAX_PAID_ITEMS`. `key` = `email:${sourceTitle}`.
- **Hacker News:** items with `sourceType === 'hackernews'` published within
  `HN_MAX_AGE_MS`, newest-first, as one section `key:'hackernews'`, title `🟠 Hacker News`.
- **Other non-email types (rss/youtube — none today):** each `sourceTitle` forms a
  section, not recency-bounded.
- **Section ordering (deterministic contract):** all non-Hacker-News sections (email +
  any rss/youtube) ordered by their newest item descending; the Hacker News section
  always last. **Empty sections omitted.** (This gives the required rss test a concrete
  expected position.)

This replaces `groupFeed`; the screen and tests migrate to `buildFeedSections`.
(`MAX_PAID_ITEMS`, `HN_MAX_AGE_MS` reused unchanged.)

### Jump-to-source — `app/index.tsx`
A horizontal chip bar (one chip per section, label = section title) above the
`SectionList`. Tapping a chip calls `ref.scrollToLocation({ sectionIndex, itemIndex: 0,
viewOffset })`. Provide `onScrollToIndexFailed` (retry after a short delay) so a
not-yet-measured section doesn't throw. The bar is built from the same
`buildFeedSections` result, so chips and sections always match.

### Prev/Next in detail — `neighbors` + a tiny order store
- Pure `neighbors(ids: string[], currentId: string): { prevId: string | null; nextId: string | null }`
  (TDD): returns the adjacent ids in the flattened display order, `null` at the ends or
  when `currentId` isn't found. Uses the **first occurrence** (`indexOf`) if an id
  appears more than once, so behavior is deterministic.
- `src/client/feedOrder.ts`: a module-level store — `setFeedOrder(ids: string[])` /
  `getFeedOrder(): string[]`. The Today screen sets it to the flattened section order
  (`sections.flatMap(s => s.data.map(i => i.articleId))`) on each load; the detail
  screen reads it. If empty (e.g. detail opened cold via deep link), Prev/Next render
  disabled/hidden — graceful, no crash.
- `app/article/[id].tsx`: compute `{ prevId, nextId } = neighbors(getFeedOrder(), id)`;
  render Prev/Next buttons (comic-lite styled) that `router.replace('/article/'+target)`
  when present; hide/disable the one that is `null`. **Reset on id change:** the load
  effect sets `loading=true` (and clears `item`) at the start when `id` changes, so
  Prev/Next shows the loading state for the new article rather than leaving the previous
  article's title/summary/images on screen until the refetch resolves.

### 曼報 Pro source — Mailchimp newsletter (parser + data)
`runEmailIngest` already *fetches* every active `email` source by sender, so no fetch
code changes. Parsing, however, is Substack-specific. **Verified from a real 曼報 email**
(`scripts/inspect-manny-email.ts`): 曼報 Pro is a **Mailchimp** newsletter —
`*.list-manage.com` links, images on `mcusercontent.com` (4 real charts at 459/288px) +
one 1×1 `us.list-manage.com` tracking pixel, and **no per-article canonical URL** (a
weekly digest of 5–8 articles; only tracking redirects + `pro.manny-li.com/`).
Consequences for `parseSubstackEmail`:
- **Title + content (the summary): already generic and correct** — subject → title,
  text body (6.5k chars) → content. 曼報 summarizes with zero parser changes.
- **Images: needs a small generalization.** `isContentImage` already drops 1×1 tracking
  pixels and asset/logo/avatar images; it just requires the host to be
  `substackcdn.com/image/`. Add `mcusercontent.com` to the content-image host allow-list
  so 曼報's charts render (FOMO/Substack path unchanged).
- **URL: stays empty for 曼報** — there is no per-article canonical link in a Mailchimp
  digest. The detail screen hides "Open original" when `url` is empty (no
  `Linking.openURL('')`). (The function name `parseSubstackEmail` is now a slight
  misnomer; optionally rename to `parseNewsletterEmail` — low priority.)

This is a `src/pipeline/email.ts` change, which IS gate-covered, so it's a proper TDD
task (a 曼報-style Mailchimp fixture asserting `mcusercontent.com` images kept, 1×1
dropped, empty url; plus the existing Substack tests still green).
Backfill is bounded by the IMAP fetch window (last 7 days) — older 曼報 issues are not
backfilled unless the `since` window is temporarily widened.

### iOS app icon (asset; free-rein, on-brand comic-lite)
Author a 1024×1024 opaque PNG `assets/icon.png` directly with **Python Pillow**
(`PIL.ImageDraw`) — the only rasterizer present on this machine (no rsvg/cairosvg/sharp/
inkscape/convert). Comic-lite aesthetic: paper `#fdf6ec` ground, bold ink `#1a1a1a`
outline, red `#e63946` accent; a simple, legible daily-news-digest motif (e.g. a bold
"D"/newspaper/lightning mark with a comic border and hard shadow). No transparency
(iOS icons are opaque squares). Wire `"icon": "./assets/icon.png"` under `expo` in
`app.json`; commit the PNG. (A script under `scripts/` authors it so it's reproducible;
`scripts/` is outside the gates.)

## Risks / Trade-offs
- `SectionList.scrollToLocation` can throw if a target section isn't measured →
  mitigated by `onScrollToIndexFailed` + a retry; acceptable for a short feed.
- The order store is in-memory (lost on cold deep-link to a detail) → Prev/Next then
  hide; not a crash. Acceptable for a single-user reader.
- Dropping the global email limit fetches all `done` email rows → fine given low email
  volume; the per-source cap keeps the rendered feed small.
- 曼報 is Mailchimp (confirmed), so its url stays empty (no canonical) → the empty-url
  guard hides "Open original"; its images render via the `mcusercontent.com` allow-list
  addition. A future newsletter on yet another platform may need another host added.

## Migration Plan
1. Ship the `listDigest` data-layer change + pure `buildFeedSections` + `neighbors` +
   `feedOrder` (TDD for the pure parts); migrate the screen.
2. Generalize the email content-image filter for Mailchimp (TDD, `src/pipeline/email.ts`).
3. Add Prev/Next (+ id-change reset) to the detail; add the jump bar to the feed.
4. Add the icon asset (Pillow) + `app.json` wiring.
5. Live: seed 曼報 Pro, re-run the pipeline (backfill), rebuild the app; verify
   per-source sections, jump, prev/next, 曼報 summary+charts, and the new icon.
No rollback risk: a query-shape change + a widened image allow-list + additive UI + an
asset; the fetch/IMAP flow and summarization are unchanged.

## Open Questions
- Email-section ordering when several newsletters exist (chosen: newest-item-first).
- Whether to also set a distinct Android adaptive icon later (out of scope now).
