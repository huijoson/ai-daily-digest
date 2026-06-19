## Why

Four reader-experience improvements requested by the user:
- Reading one article at a time means returning to the feed to read the next.
  Prev/next navigation in the detail view keeps the user in the reading flow.
- With more than one paid newsletter, the feed needs to be navigable by source —
  a quick way to jump straight to a given source's items.
- The user subscribes to a second newsletter (曼報 Pro, `manny@manny-li.com`) and
  wants it ingested alongside FOMO.
- The app has no icon yet; it should have one that fits its content and look.

## What Changes

- **Per-source feed sections.** The Today feed groups items into one section per
  source — each email newsletter (e.g. FOMO研究院, 曼報 Pro) as its own section and
  Hacker News as its own — replacing the single combined "paid" section. Each email
  section shows its latest few; Hacker News stays bounded to the last 24h. This
  requires a data-layer change: today `listDigest` caps email rows GLOBALLY to
  `MAX_PAID_ITEMS` (3) total, so with two newsletters one section is starved/empty —
  the query must supply enough rows per source.
- **Jump-to-source.** A row of source chips at the top of the feed scrolls directly
  to that source's section.
- **Prev/Next in the detail view.** The article screen gains Previous / Next
  controls that move through the feed's display order.
- **New email source 曼報 Pro.** Added as an `email` source (sender
  `manny@manny-li.com`). 曼報 Pro is delivered via **Mailchimp** (verified from a real
  email: `*.list-manage.com` links, `mcusercontent.com` images), NOT Substack. The
  generic fetch + subject/text parsing already produces a correct summary, but the
  Substack-specific image filter drops 曼報's charts and there is no per-article
  canonical URL (a weekly digest of 5–8 articles). So the email image parser is
  generalized to also accept Mailchimp content images; "Open original" is hidden when
  there's no canonical URL.
- **iOS app icon.** A comic-lite icon (1024×1024 PNG) wired into `app.json`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-feed`: the feed is organized into per-source sections with a jump-to-source
  control, and the article detail view supports previous/next navigation.
- `fetch-pipeline`: email ingestion parses newsletters from any delivery platform
  (Substack and Mailchimp), selecting content images from a host allow-list and
  allowing an empty canonical URL for multi-article digests.

## Impact

- **Pure logic (TDD):** new `buildFeedSections(items, now)` (replaces `groupFeed`)
  producing ordered per-source sections; new `neighbors(ids, currentId)` for prev/next.
- **Data layer (`src/client/data.ts`; tsconfig-excluded, manual-verified):**
  `listDigest` drops the global `.limit(MAX_PAID_ITEMS)` on the email query so every
  email source's recent rows reach the client (per-source cap is then applied in
  `buildFeedSections`). Also fix the stale `groupFeed` comment.
- **App:** `app/index.tsx` renders a `SectionList` of the new sections + a horizontal
  source chip bar (scrollToLocation); `app/article/[id].tsx` adds Prev/Next and resets
  loading state on `id` change (no stale-content flash); a tiny
  `src/client/feedOrder.ts` module store carries the feed's display order to the
  detail screen.
- **Assets / config:** `assets/icon.png` (new, authored with Python Pillow — the only
  rasterizer present on this machine) + `expo.icon` in `app.json`.
- **Email parser (`src/pipeline/email.ts`; TDD):** generalize the content-image filter
  to accept Mailchimp `mcusercontent.com` images (1×1 tracking-pixel + asset filters
  already exist); subject/text title+content are already generic. (FOMO/Substack
  behavior unchanged — covered by existing tests + a new 曼報-style fixture.)
- **Data (live):** seed a `sources` row for 曼報 Pro and back-fill its emails by
  re-running the pipeline (IMAP fetch window is the last 7 days; older issues are not
  backfilled). Verify 曼報 shows a summary + its chart images.
- **No DB migration.** No change to ingestion, summarization, dedup, or the data model.
- **No breaking changes:** `buildFeedSections` and the `listDigest` query shape are
  internal; ingestion and summary behavior are unchanged.
