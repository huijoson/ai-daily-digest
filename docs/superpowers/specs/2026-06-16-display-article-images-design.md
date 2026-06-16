# Display Article Images in the Detail View — Design

## Why

Paid articles' chart images are already stored (`articles.image_urls`) and fed to
Gemini vision for summarization, but the app never shows them. The reader sees the
chart-aware summary but not the charts. Display the stored images in the article
detail view so the user can see the figures the analysis refers to.

## What changes

- The article detail screen renders the article's content images (when present)
  below the summary. The Today feed list is unchanged (text-only, stays clean).

## Scope / non-goals

- In scope: surface `image_urls` through the feed data layer and render them in
  `app/article/[id].tsx`.
- Non-goals: thumbnails in the feed list; tap-to-zoom/lightbox; storing image bytes;
  any change to summarization or ingestion (image URLs are already captured).

## Architecture

### Data layer
- `FeedItem` (`src/client/types.ts`) gains `imageUrls: string[]`.
- `mapFeedRow` (`src/client/feed.ts`) returns `imageUrls: article?.image_urls ?? []`
  (the embed already normalizes via the `one()` helper). Pure, TDD.
- `listTodaySummaries` and `getFeedItem` (`src/client/data.ts`) add `image_urls` to
  the `articles(...)` embed in their select strings. No migration (column exists).

### Detail screen — `app/article/[id].tsx`
- After the summary, if `item.imageUrls.length > 0`, render each URL as
  `<Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 240,
  backgroundColor: '#f2f2f2', borderRadius: 8, marginTop: 12 }} />`.
- Articles without images (Hacker News) render exactly as today (no image block).
- Images are public Substack CDN URLs; React Native `<Image>` loads them directly on
  web and device (display does not require CORS).

## Error handling
- A broken/unreachable image URL fails to render that one `<Image>` (RN shows nothing
  for it); it does not affect the summary or other images. No app-level handling
  needed for the MVP.

## Testing
- Unit (Vitest): update the two `mapFeedRow` tests to include `image_urls` in the
  fixture and `imageUrls` in the expected object; add a case asserting `imageUrls`
  defaults to `[]` when the embed has none.
- Manual (Expo): open a FOMO article → its charts render under the summary; open a
  Hacker News article → no image block; broken URL degrades gracefully.

## Definition of done
- `npm test` green (mapFeedRow imageUrls covered); `npm run typecheck` clean.
- FOMO article detail shows its charts under the summary; HN detail unchanged.
