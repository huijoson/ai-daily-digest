# Display Article Images in the Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a paid article's stored chart images in the article detail screen, below the summary.

**Architecture:** Surface the already-stored `articles.image_urls` through `FeedItem`/`mapFeedRow` and the feed queries (pure, Vitest-tested), then render them with React Native `<Image>` in `app/article/[id].tsx` (manual-verified). No migration — the column exists.

**Tech Stack:** TypeScript, Vitest, Expo (React Native), Supabase.

**Spec:** `docs/superpowers/specs/2026-06-16-display-article-images-design.md`.

---

## File Structure

```
src/client/types.ts     # MODIFY: FeedItem gains imageUrls: string[]
src/client/feed.ts      # MODIFY: mapFeedRow returns imageUrls
src/client/data.ts      # MODIFY: listTodaySummaries + getFeedItem select image_urls
test/client/feed.test.ts# MODIFY: mapFeedRow tests assert imageUrls
app/article/[id].tsx    # MODIFY: render images below the summary
```

Task 1 is pure TDD (types + mapFeedRow + data selects). Task 2 is the RN screen (gates stay green; manual-verified).

---

## Task 1: Surface imageUrls through the feed data layer (TDD)

**Files:**
- Modify: `src/client/types.ts`, `src/client/feed.ts`, `src/client/data.ts`
- Test: `test/client/feed.test.ts`

- [ ] **Step 1: Add `imageUrls` to `FeedItem` — `src/client/types.ts`**

In the `FeedItem` interface, add `imageUrls: string[];` (after `sourceType`).

- [ ] **Step 2: Update the failing tests — `test/client/feed.test.ts`**

The two existing `mapFeedRow` tests assert the full `FeedItem` via `toEqual`. Update both:
- Test 1 ("maps a joined summary row to a FeedItem"): in the fixture's `articles`, add `image_urls: ['https://cdn/img1.png']`; in the expected object add `imageUrls: ['https://cdn/img1.png']`.
- Test 2 ("handles the embed arriving as a one-element array and missing fields"): leave the fixture without `image_urls`; in the expected object add `imageUrls: []`.

(These now fail because `mapFeedRow` does not yet return `imageUrls`.)

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- client/feed`
Expected: FAIL — `mapFeedRow` output is missing `imageUrls`.

- [ ] **Step 4: Implement `mapFeedRow` — `src/client/feed.ts`**

In `mapFeedRow`, add `imageUrls` to the returned object (the `article` variable already exists via the `one()` helper):
```ts
  return {
    articleId: row.article_id,
    title: article?.title ?? '',
    url: article?.url ?? '',
    summary: row.summary_text ?? '',
    sourceTitle: source?.title ?? '',
    sourceType: source?.type ?? 'rss',
    imageUrls: article?.image_urls ?? [],
    publishedAt: article?.published_at ?? null,
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- client/feed`
Expected: PASS.

- [ ] **Step 6: Add `image_urls` to the feed queries — `src/client/data.ts`**

In BOTH `listTodaySummaries` and `getFeedItem`, change the select string from
`'article_id, summary_text, articles(title, url, published_at, sources(title, type))'`
to
`'article_id, summary_text, articles(title, url, published_at, image_urls, sources(title, type))'`.

- [ ] **Step 7: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass; typecheck clean. (`data.ts` is excluded from the Node tsconfig; `mapFeedRow` change is covered by the updated tests.)

- [ ] **Step 8: Commit**

```bash
git add src/client/types.ts src/client/feed.ts src/client/data.ts test/client/feed.test.ts
git commit -m "feat: surface article image_urls through FeedItem and feed queries"
```

---

## Task 2: Render images in the detail screen (RN; manual-verified)

**Files:**
- Modify: `app/article/[id].tsx`

- [ ] **Step 1: Render the images below the summary — replace `app/article/[id].tsx` with:**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, Linking, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFeedItem } from '../../src/client/data';
import type { FeedItem } from '../../src/client/types';

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedItem(String(id)).then(setItem).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!item) return <Text style={{ padding: 16 }}>Not found.</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: '#888' }}>{item.sourceTitle}</Text>
      <Text style={{ fontSize: 16, lineHeight: 24 }}>{item.summary}</Text>
      {item.imageUrls.map((uri) => (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="contain"
          style={{ width: '100%', height: 240, backgroundColor: '#f2f2f2', borderRadius: 8 }}
        />
      ))}
      <Button title="Open original" onPress={() => Linking.openURL(item.url)} />
    </ScrollView>
  );
}
```

(`item.imageUrls` is always an array — `mapFeedRow` defaults it to `[]` — so HN/RSS articles render no images, exactly as today.)

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
Expected: unchanged (the screen is outside the Node tsconfig).

```bash
git add app/article/[id].tsx
git commit -m "feat: show article chart images below the summary in the detail view"
```

- [ ] **Step 3: Manual verification (USER, after merge)**

Refresh the app, open a FOMO article → its charts appear under the summary; open a Hacker News article → no image block (unchanged); a broken image URL simply renders nothing for that one image.

---

## Definition of Done

- `npm test` green (mapFeedRow `imageUrls` covered, present + empty cases); `npm run typecheck` clean.
- `FeedItem` carries `imageUrls`; the feed queries select `image_urls`; the detail screen renders the charts below the summary for image-bearing articles and nothing extra for text-only ones.
- Verified live: a FOMO article shows its charts; HN unchanged.
