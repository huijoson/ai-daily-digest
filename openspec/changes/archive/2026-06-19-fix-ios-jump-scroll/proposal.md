## Why

On iOS, tapping ANY jump-to-source chip scrolls back to the first section (FOMO研究院)
instead of the tapped source. Root cause: the feed uses `SectionList.scrollToLocation`,
which on iOS fails for a section whose frame isn't measured yet (native virtualization
renders lazily). The current `onScrollToIndexFailed` recovery scrolls to an *estimated*
offset (`averageItemLength * index`); when little is measured that estimate collapses
toward 0 (the top), and the retried `scrollToLocation` keeps failing for the same reason,
so after the retry cap it ends at the top = the first section. (On web the list renders
eagerly, so it works there.) The estimate-based recovery is inherently unreliable.

## What Changes

- **Deterministic jump-to-source.** Replace the `SectionList` + `scrollToLocation`
  recovery with a plain `ScrollView` that renders the sections directly; each section's
  real vertical offset is captured via `onLayout`, and a chip tap scrolls straight to
  that measured offset. This works identically on iOS and web, with no estimate, no
  retry loop, and no scroll-to-bottom flash. The daily feed is bounded (each email source
  capped, HN within 24h), so dropping virtualization is fine.
- Remove the now-dead `scrollFailureOffset` helper + tests and the
  `onScrollToIndexFailed`/`retryCount` machinery; add a small pure
  `sectionScrollTarget(offsets, index, inset)` helper (TDD) for the offset/clamp logic.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-feed`: the jump-to-source control scrolls to the TAPPED source's section on every
  platform (a later source no longer lands on the first section), via measured offsets.

## Impact

- **App (RN; manual-verified, app/ gate-excluded):** `app/index.tsx` — `SectionList` →
  `ScrollView`; per-section `onLayout` offset capture; chip tap → `scrollTo` measured
  offset; keep RefreshControl, empty state, chip bar, section headers, comic cards, and
  `setFeedOrder`.
- **Pure logic (TDD):** add `sectionScrollTarget(offsets, key, inset)` (offsets keyed by
  the stable section key, self-healing across refreshes) in `src/client/feed.ts`; remove
  `scrollFailureOffset` + its tests.
- **Minor UX:** sticky section headers (a SectionList iOS default) become inline pills —
  intentionally dropped for a short feed.
- **No DB / pipeline / summarization / icon change. No breaking changes** (feed order
  and article prev/next are unaffected).
