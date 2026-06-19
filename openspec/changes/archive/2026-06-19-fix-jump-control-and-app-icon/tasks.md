## 1. scrollFailureOffset — pure recovery-offset helper (TDD)

- [x] 1.1 Write failing tests in `test/client/feed.test.ts` for `scrollFailureOffset(info)` (param type `{ averageItemLength?: number; index?: number }`): `{ averageItemLength: 80, index: 5 }` → 400; `{ averageItemLength: 80, index: 0 }` → 0; `{ averageItemLength: NaN, index: 3 }` → 0; `{ index: 3 }` (missing averageItemLength) → 0; `{ averageItemLength: 80 }` (missing index) → 0. (Drop the unreachable "negative result" case — RN never passes negative index/length.)
- [x] 1.2 Implement `scrollFailureOffset` in `src/client/feed.ts` guarding BOTH fields so NaN/missing → 0 (never NaN): `const len = Number.isFinite(info.averageItemLength) ? info.averageItemLength! : 0; const idx = Number.isFinite(info.index) ? info.index! : 0; return Math.max(0, len * idx);`
- [x] 1.3 Full suite + typecheck green.

## 2. Jump control: reliable scroll + bigger tap target (RN; manual-verified)

- [x] 2.1 `app/index.tsx`: add a `retryCount` ref; in `jumpTo` reset `retryCount.current = 0` before `scrollToLocation`. In `onScrollToIndexFailed(info)`: if `retryCount.current >= 3` return (no-op); else `retryCount.current += 1`, call `listRef.current?.getScrollResponder()?.scrollTo({ y: scrollFailureOffset(info), animated: false })` (guard null responder), then after ~250ms re-issue `listRef.current?.scrollToLocation({ sectionIndex: lastJump.current, itemIndex: 0, viewOffset: 8, animated: true })`. Import `scrollFailureOffset`.
- [x] 2.2 Enlarge the chip: `paddingVertical: 8`, `paddingHorizontal: 14`, `minHeight: 36`; add `hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}` to each chip `Pressable` (left+right ≤ the 8px inter-chip gap so hit areas don't overlap). Keep the comic-lite look (ink border, paper fill, bold text).
- [x] 2.3 Gates green (app/ is gate-excluded; confirm no typecheck regression in src/test).

## 3. Bold app icon — author, render, propagate (asset + native catalog)

- [x] 3.1 Rewrite `scripts/make-icon.py` (Pillow) for the BOLD high-contrast comic-lite design (red ground, thick ink border + hard highlight, bold ink digest glyph on a paper panel, minimal whitespace). 1024×1024 opaque RGB. The script writes `assets/icon.png` AND copies the same file to `ios/AIDailyDigest/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`.
- [x] 3.2 Render it; (checkpoint already approved the direction) confirm it reads at small size; ensure `app.json` still has `"icon": "./assets/icon.png"` and `Contents.json` is unchanged (single 1024).
- [x] 3.3 Gates green (asset/script only).

## 4. Verification (live, user/assistant-run)

- [ ] 4.1 Web (`npx expo start`, press `w`): jump chips are easy to click and scroll to each section (incl. an off-screen one).
- [ ] 4.2 iOS: **bust the icon cache first** — delete the app from the device/simulator (or Erase All Content & Settings on a simulator), Clean Build Folder (⇧⌘K) / clear DerivedData — then rebuild in Xcode (▶︎ Run) and reinstall. Verify tapping each jump chip scrolls to its section (incl. an off-screen one), and the new app icon appears on the home screen (not the old blank one).
