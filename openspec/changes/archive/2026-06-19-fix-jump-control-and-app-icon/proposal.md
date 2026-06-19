## Why

Two defects in the shipped reader, found on-device:

- **App icon shows blank.** The iOS home-screen icon is the blank white Expo default.
  `app.json` has `expo.icon`, but the app's `ios/` was prebuilt BEFORE that was set, so
  the native asset catalog
  (`ios/AIDailyDigest/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`)
  still holds the placeholder. A plain Xcode rebuild does not regenerate it from
  `app.json`. (The user also wants a bolder icon design than the first attempt.)
- **Jump-to-source control is broken/awkward.** On web the chips are too small to tap
  reliably (≈24px tall target) though they work. On iOS the chips render but tapping
  does nothing: the press fires, but `SectionList.scrollToLocation` silently fails for a
  section not yet measured (native virtualization), and `onScrollToIndexFailed` only
  retries the same failing call. Web's SectionList renders eagerly, so it works there.

## What Changes

- **Reliable jump-to-source.** Tapping a source chip reliably scrolls to that section on
  iOS as well as web, by recovering from `scrollToLocation` measurement failures (scroll
  toward an estimated offset to force measurement, then re-issue the jump). Chips get a
  larger, comfortable tap target (and `hitSlop`) so they are easy to hit on web and
  touch.
- **App icon that actually appears.** A bold, high-contrast comic-lite icon is authored
  and written into BOTH `assets/icon.png` (for `expo.icon`) and the iOS AppIcon catalog
  (`App-Icon-1024x1024@1x.png`), so it shows after an Xcode rebuild without a destructive
  `expo prebuild --clean` (which would wipe native tweaks like the removed push
  entitlement).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-feed`: the jump-to-source control's reliability and tap target are specified —
  selecting a source scrolls to its section on all platforms, with comfortable hit areas.

## Impact

- **App (RN; manual-verified, app/ is gate-excluded):** `app/index.tsx` — robust
  `scrollToLocation` recovery in `onScrollToIndexFailed`; larger chip style + `hitSlop`.
- **Pure logic (TDD):** a small pure `scrollFailureOffset(info)` helper (estimate the
  recovery offset from the failure info) in `src/client/feed.ts`, unit-tested.
- **Icon asset + native catalog:** rewrite `scripts/make-icon.py` for the bold design;
  regenerate `assets/icon.png`; copy it to
  `ios/AIDailyDigest/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`.
- **No DB / no pipeline / no summarization change. No breaking changes.**
