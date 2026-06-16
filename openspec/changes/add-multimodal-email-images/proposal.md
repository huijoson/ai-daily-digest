## Why

Paid Substack posts (delivered by email) are chart-heavy: the prose is captured
in full, but the **charts/diagrams are images**, so their data and visual
arguments never reach the summary. Readers of the digest lose the part of a paid
analysis that lives in the figures. We will pass those images to the LLM
(Gemini vision) so paid summaries reflect what the charts actually show.

## What Changes

- Email ingestion extracts the **content image URLs** from each delivery email
  (the Substack CDN content images, excluding logos/icons/tracking pixels),
  deduplicated and capped per article to bound cost.
- Articles persist those image URLs alongside their text content.
- The summarizer, when `sourceType === 'email'` AND the article has image URLs,
  fetches the images and sends them to Gemini as multimodal input together with the
  text prompt, so the analytical summary incorporates the charts. Hacker News (brief)
  and image-less summaries are unchanged (text-only).
- **Both summarize paths** (the active local runner and the dormant Deno Edge
  Function) inject an image fetcher, so the feature never silently no-ops on whichever
  path runs.
- Robustness: a failed or unsupported-format image is skipped; if the multimodal
  request itself fails, the summarizer falls back to a text-only summary (no
  regression to "no summary"). The per-article image cap bounds token cost.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `summarization`: add multimodal image understanding — paid-source summaries
  include the article's content images as vision input to the LLM.
- `fetch-pipeline`: ingestion captures and stores each article's content image
  URLs (for sources that deliver images, i.e. email), bounded and deduplicated.

## Impact

- **Data model**: `articles` gains an `image_urls text[]` column (migration).
- **Pipeline (pure logic)**: `parseSubstackEmail` also extracts image URLs;
  `ParsedArticle`, `PendingSummary`, and the `Summarizer` input gain `imageUrls`;
  a pure `extractImageUrls(html)` and `buildGeminiContents(prompt, images)`.
- **Adapters**: the runner + Deno `DbClient` store and return `image_urls`;
  `createGeminiSummarizer` gains an injected image fetcher and, for email content,
  builds a multimodal Gemini request (`inline_data` parts).
- **Cost**: bounded by a per-article image cap (~12) and email-only application.
- **Backfill**: the two existing FOMO articles have no stored image URLs; a one-off
  re-read of their emails populates `image_urls` so they too get multimodal
  summaries. New posts are covered automatically.
- **No breaking changes**: `imageUrls` is optional; text-only summarization
  (HN/RSS) is unaffected.
