## 1. sectionScrollTarget pure helper + remove scrollFailureOffset (TDD)

- [ ] 1.1 In `test/client/feed.test.ts`, add `describe('sectionScrollTarget', ...)` using a `Map<string, number>`: `new Map([['a',0],['b',300],['c',620]])` → key `'c'` inset 8 → 612; key `'a'` inset 8 → 0 (clamped, not -8); missing key `'z'` → 0; a key mapped to `NaN` → 0; `NaN` inset treated as 0 (key `'b'` → 300). Remove the `describe('scrollFailureOffset', ...)` block and the `scrollFailureOffset` import.
- [ ] 1.2 In `src/client/feed.ts`, add `sectionScrollTarget(offsets: Map<string, number>, key: string, inset: number): number` = `const y = offsets.get(key); return Math.max(0, (Number.isFinite(y) ? (y as number) : 0) - (Number.isFinite(inset) ? inset : 0));`. Remove `scrollFailureOffset`.
- [ ] 1.3 Full suite + typecheck green (~5 added, 5 removed).

## 2. ScrollView + key-based measured offsets jump (RN; manual-verified)

- [ ] 2.1 `app/index.tsx`: replace `SectionList` with a `ScrollView` (`scrollRef = useRef<ScrollView>(null)`); `offsets = useRef<Map<string, number>>(new Map())`. Render `sections.map((s) => <View key={s.key} onLayout={(e) => { offsets.current.set(s.key, e.nativeEvent.layout.y); }}>` containing the header pill (`[t.sectionPill, { marginTop: spacing.lg, marginBottom: spacing.sm }]`) and each item's comic `<Link asChild><Pressable>` card, with `marginTop: spacing.md` on items after the first (between-items spacing only).
- [ ] 2.2 `jumpTo(i)`: `scrollRef.current?.scrollTo({ y: sectionScrollTarget(offsets.current, sections[i].key, 8), animated: true })`. Remove `listRef`, `lastJump`, `retryCount`, `onScrollToIndexFailed`, and the `scrollFailureOffset` import. **Do NOT clear `offsets`** on `sections` change (keyed by `s.key`, self-healing — clearing would reintroduce the jump-to-top bug after a no-op refresh).
- [ ] 2.3 Keep RefreshControl (on the ScrollView), the empty state (when `sections.length === 0`), the chip bar (`sections.length > 1`), section pills, comic cards, and the `setFeedOrder` effect. (Sticky section headers are intentionally dropped — inline pills.)
- [ ] 2.4 Gates green (app/ gate-excluded; confirm no typecheck regression in src/test).

## 3. Verification (live, user/assistant-run)

- [ ] 3.1 Web (`npx expo start` → `w`): tapping each chip scrolls to its OWN section (FOMO, 曼報, Hacker News), including an off-screen one; then pull-to-refresh and tap again — still scrolls correctly (no jump-to-top regression).
- [ ] 3.2 iOS: rebuild in Xcode (▶︎ Run); tapping each chip scrolls to that source's section (not always FOMO), before and after a pull-to-refresh.
