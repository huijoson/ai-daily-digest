## Context

The Today screen (`app/index.tsx`) renders a horizontal chip bar above a `SectionList`.
A chip's `onPress` calls `jumpTo(i)` → `listRef.current?.scrollToLocation({ sectionIndex,
itemIndex: 0, viewOffset: 8, animated: true })`, with `onScrollToIndexFailed` retrying
the same call after 300ms. Chips are `paddingVertical: 4` + 12px text (~24px tall). The
iOS app is a prebuilt `ios/` (gitignored, with native customizations) whose AppIcon
catalog is a single 1024 file; `assets/icon.png` exists and `app.json` has `expo.icon`,
but the native catalog was generated before that and holds the blank default.

## Goals / Non-Goals

**Goals:** the jump control reliably scrolls on iOS + web and is comfortably tappable;
a bold icon that actually appears on the home screen.

**Non-Goals:** no change to feed grouping/data/prev-next; no `expo prebuild --clean`
(would wipe native tweaks); no per-size iOS icon set (single 1024 is sufficient — Xcode
derives the rest); no Android adaptive icon work.

## Decisions

### Reliable jump-to-source — robust `scrollToLocation` recovery (`app/index.tsx`)
`scrollToLocation` throws/no-ops on iOS when the target section's frame isn't measured
yet (native virtualization renders lazily). The fix recovers in `onScrollToIndexFailed`:

- Keep `lastJump` (the requested `sectionIndex`) as today, plus a `retryCount` ref.
- `onScrollToIndexFailed(info)`: **bounded** recovery to avoid an unterminated
  `setTimeout` loop. If `retryCount.current >= 3`, stop (degrade to a no-op). Otherwise
  increment it, scroll the underlying scroll view toward an estimated offset first —
  `listRef.current?.getScrollResponder()?.scrollTo({ y: scrollFailureOffset(info), animated: false })`
  (guard the responder being `null`) — which forces the list to render/measure that
  region, THEN re-issue
  `scrollToLocation({ sectionIndex: lastJump.current, itemIndex: 0, viewOffset: 8 })`
  after ~250ms. `retryCount` resets to 0 at the start of each `jumpTo` (a fresh tap).
  `info` is `{ index, highestMeasuredFrameIndex, averageItemLength }` (SectionList passes
  a flat index).
- Pure helper (TDD): `scrollFailureOffset(info: { averageItemLength?: number; index?: number }): number`
  → guard BOTH fields with `Number.isFinite` (default 0), then `Math.max(0, len * idx)`,
  so any NaN/missing input yields 0 — never a `NaN` `scrollTo` target. Optional fields so
  the missing-field cases compile under the gate. Isolates the one bit of logic and pins
  the input-guarding contract that actually matters.

Why this works: the first `scrollToLocation` fails because the section isn't measured;
scrolling to an approximate offset renders the intervening rows; the retried
`scrollToLocation` then lands precisely. This is the standard RN workaround and is
platform-safe (web already succeeds on the first call; the recovery path simply won't
fire there).

### Tap target — larger chips + `hitSlop` (`app/index.tsx`)
Increase the chip to a comfortable size: `paddingVertical: 8`, `paddingHorizontal: 14`,
`minHeight: 36`, and add `hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}` to each
chip `Pressable` — effective touch height ≈ 36 + 20 = 56px (≥ the ~44pt iOS guideline),
and left+right slop (4+4=8) does NOT exceed the 8px inter-chip gap, so adjacent hit areas
abut rather than overlap. This fixes the web "too small to click" complaint and removes
any near-miss on touch. The comic-lite look (ink border, paper fill, bold text) is
preserved; only sizing changes.

### Bold app icon — author + propagate to the native catalog
**Chosen design (approved at checkpoint): "newspaper on red".** A bold, high-contrast
comic-lite mark on a RED (`#e63946`) rounded-square ground: a cream (`#fdf6ec`) page with
a thick ink (`#1a1a1a`) border + hard offset shadow, a red masthead bar, two bold ink
headline bars, and a rising bar-chart (ink/ink/red) — minimal whitespace so it never
reads as "blank", and clearly communicates "daily news digest". Output 1024×1024 opaque
RGB. Rewrite `scripts/make-icon.py` (Pillow) to render this, writing `assets/icon.png`
AND copying the same bytes to
`ios/AIDailyDigest/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
(the catalog's single referenced file, per its `Contents.json`). No `Contents.json`
change. (Prototype validated as `/tmp/icon_a_newspaper_red.png`; the scratch
`scripts/icon_candidates.py` is removed once finalized.)

## Risks / Trade-offs
- `scrollFailureOffset` uses `averageItemLength`, an estimate → the retry corrects the
  final position; acceptable for a short feed. If a section is far down, one recovery
  hop may still be slightly off; the retried `scrollToLocation` is exact.
- Editing the gitignored `ios/` catalog directly means a future `expo prebuild --clean`
  would reset it — documented; the icon also lives in `assets/icon.png`, so a future
  clean prebuild regenerates it from `app.json` anyway.
- iOS/SpringBoard caches the home-screen icon, so a plain incremental rebuild over an
  existing install can keep showing the old blank icon → the verification step requires a
  delete-app + clean-build to bust the cache.
- Icon legibility at small size → mitigated by the bold/high-contrast direction and a
  checkpoint visual review.

## Migration Plan
1. Pure `scrollFailureOffset` (TDD) in `src/client/feed.ts`.
2. Wire robust recovery + larger/`hitSlop` chips in `app/index.tsx`.
3. Author the bold icon (Pillow), render, show at checkpoint, then write to
   `assets/icon.png` + the iOS AppIcon catalog.
4. Verify: web chips easy to tap + scroll. For iOS, **bust the icon cache** — delete the
   app from the device/simulator (or Erase All Content & Settings on a simulator), Clean
   Build Folder (⇧⌘K) / clear DerivedData, then rebuild & reinstall — otherwise
   SpringBoard often keeps showing the cached blank icon and the change looks done while
   it isn't. Then confirm: iOS chips scroll to each section and the new icon shows.
No rollback risk: a localized RN fix + a pure helper + an asset swap.

## Open Questions
- Final icon glyph — RESOLVED: "newspaper on red" (candidate A) chosen.
