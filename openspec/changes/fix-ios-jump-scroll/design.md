## Context

`app/index.tsx` renders the feed with a `SectionList` and a chip bar. `jumpTo(i)` calls
`listRef.current?.scrollToLocation({ sectionIndex: i, itemIndex: 0, viewOffset: 8 })`, and
`onScrollToIndexFailed` retries via an estimated offset (`scrollFailureOffset(info) =
averageItemLength * index`). On iOS, `scrollToLocation` fails for unmeasured sections; the
estimate is ~0 when little is measured, so every off-screen jump ends at the top (FOMO).
The feed is built by the pure `buildFeedSections(items, now)` → `FeedSection[]`
(`{ key, title, data }`), already used for both the chip bar and the list, in the same
order. `setFeedOrder(sections.flatMap(...))` feeds the article prev/next.

## Goals / Non-Goals

**Goals:** tapping a source chip reliably scrolls to THAT source's section on iOS and web.

**Non-Goals:** no virtualization (the daily feed is bounded — each email source capped to
`MAX_PAID_ITEMS`, HN within 24h); no change to feed grouping, data, prev/next, or the icon.

## Decisions

### Deterministic scroll via a ScrollView + offsets keyed by section key (`app/index.tsx`)
Replace `SectionList` with a `ScrollView` (`scrollRef`) that renders the sections itself:

```
<ScrollView ref={scrollRef} refreshControl={…} contentContainerStyle={{ padding: lg }}>
  {sections.length === 0 ? <EmptyState/> :
    sections.map((s) => (
      <View key={s.key} onLayout={(e) => { offsets.current.set(s.key, e.nativeEvent.layout.y); }}>
        <Text style={[sectionPill, { marginTop: lg, marginBottom: sm }]}>{s.title}</Text>
        {s.data.map((item, idx) => (
          <View key={item.articleId} style={idx > 0 ? { marginTop: md } : null}>
            <ArticleCard item={item}/>
          </View>
        ))}
      </View>
    ))}
</ScrollView>
```

- `offsets = useRef<Map<string, number>>(new Map())`, **keyed by the stable `s.key`**
  (NOT by array index). In a `ScrollView`, a direct child's `onLayout` `y` is relative to
  the scroll content (the contentContainer's padding is included in that `y`), i.e.
  exactly the scroll offset to reach it.
- `jumpTo(i)`: `scrollRef.current?.scrollTo({ y: sectionScrollTarget(offsets.current, sections[i].key, JUMP_INSET), animated: true })`.
  `JUMP_INSET` (≈ 8) leaves a little breathing room above the header.
- **Do NOT clear `offsets` on refresh.** `load()` returns a fresh `items` array each time,
  so `sections` recomputes and the `[sections]` effect runs on every refresh — but section
  views keep stable `key`s, so React reuses them and RN's `onLayout` fires only on mount
  or an actual frame change. Wiping the map would leave unchanged sections with no offset
  (→ `0` → jump-to-top — the very bug we're fixing). Keyed-by-`s.key` offsets self-heal:
  a section whose `y` changes re-fires `onLayout` and overwrites its entry; unchanged
  sections retain a still-valid entry; removed sections leave a stale entry that is never
  read (we only look up keys of currently-visible sections).
- This removes `listRef`, `lastJump`, `retryCount`, `onScrollToIndexFailed`,
  `scrollFailureOffset`, and `scrollToLocation` entirely. No estimate, no retry, no flash.

### Pure helper — `sectionScrollTarget(offsets, key, inset)` (TDD; `src/client/feed.ts`)
```ts
export function sectionScrollTarget(offsets: Map<string, number>, key: string, inset: number): number {
  const y = offsets.get(key);
  return Math.max(0, (Number.isFinite(y) ? (y as number) : 0) - (Number.isFinite(inset) ? inset : 0));
}
```
Guards a missing/NaN offset (section not laid out yet → 0 = top, never `NaN`) and clamps
negative to 0 (the first section minus the inset must not scroll to a negative y). Replaces
the removed `scrollFailureOffset`.

### Preserve existing feed behavior
RefreshControl (now on the `ScrollView`), the empty state (when `sections.length === 0`),
the horizontal chip bar (`sections.length > 1`), section-header pills (📧/🟠), comic item
cards (each still a `<Link asChild><Pressable>` to `/article/[id]`), and the
`setFeedOrder(sections.flatMap(...))` effect are all kept. Spacing must match the current
SectionList rhythm: the header pill keeps `marginTop: spacing.lg` + `marginBottom:
spacing.sm`, and items are separated by `spacing.md` **between** items only (apply
`marginTop: md` to items after the first, not a trailing margin on every card). Only the
scroll container and the jump mechanism change.

**Sticky headers are intentionally dropped.** `SectionList` defaults to sticky section
headers on iOS; the `ScrollView` renders the pills inline (non-sticky). Acceptable for a
short, per-source-capped feed — called out so the iOS verification checks header behavior
rather than assuming parity.

## Risks / Trade-offs
- ScrollView renders all cards (no virtualization). The feed is bounded (capped email +
  24h HN), so this is a handful to a few dozen views — well within ScrollView's comfort.
- `onLayout` fires after first layout, so an extremely fast tap on the very first frame
  before layout could read a missing offset → scrolls to top; in practice layout completes
  before the user taps, and `sectionScrollTarget` degrades safely to the top, not a crash.
- Offsets are keyed by `s.key` and never wiped, so a refresh (even a no-op pull-to-refresh
  that re-fires no `onLayout`) keeps valid offsets; a section that moves re-fires
  `onLayout` and overwrites its own entry. A removed section leaves a stale map entry that
  is never read. (Earlier draft cleared the map on refresh — that reintroduced the
  jump-to-top bug and was removed per review.)

## Migration Plan
1. Pure `sectionScrollTarget` (TDD); remove `scrollFailureOffset` + its tests.
2. Refactor `app/index.tsx` to the ScrollView + measured-offset jump.
3. Verify: web — each chip scrolls to its own section (incl. off-screen). iOS rebuild —
   each chip scrolls to its own section (FOMO, 曼報, Hacker News all distinct), not always
   the first.
No rollback risk: localized to the feed screen + a pure helper swap.

## Open Questions
- None.
