## 1. Shared constant & types

- [ ] 1.1 Create `src/pipeline/constants.ts` exporting `MAX_ARTICLE_IMAGES = 12`
- [ ] 1.2 Add optional `imageUrls?: string[]` to `ParsedArticle` (`src/feed/types.ts`)
- [ ] 1.3 Add optional `imageUrls?: string[]` to `PendingSummary` and to the `Summarizer` input (`src/pipeline/types.ts`)

## 2. Image-URL extraction (pure, TDD)

- [ ] 2.1 Write failing tests for `extractImageUrls(html)`: keeps `substackcdn.com/image/` content charts; DROPS tracking pixels (`open.substack.com`, `/open`, 1×1), avatars/logos/badges (`w_<400`, `c_fill`, `g_face`, `g_auto`, paths with `/profile/`,`/pub/`,`logo`,`icon`,`button`,`favicon`,`avatars`); dedups by exact URL; caps at `MAX_ARTICLE_IMAGES`
- [ ] 2.2 Implement `extractImageUrls` in `src/pipeline/email.ts` to pass
- [ ] 2.3 Add a REAL captured FOMO email HTML as a test fixture and assert `extractImageUrls` returns exactly its content charts (no chrome). (Capture via a one-off read of the stored email or a saved sample.)

## 3. Email parsing captures images (pure, TDD)

- [ ] 3.1 Write failing test: `parseSubstackEmail` returns `imageUrls` from the email HTML
- [ ] 3.2 Implement: `parseSubstackEmail` sets `imageUrls: extractImageUrls(msg.html)`

## 4. Multimodal request assembly + prompt (pure, TDD)

- [ ] 4.1 Write failing tests for `buildGeminiContents(promptText, images)`: returns the `parts` array `[{text}, ...{inline_data:{mime_type,data}}]`; empty images → just the text part
- [ ] 4.2 Implement `buildGeminiContents` in `src/pipeline/summarize.ts`
- [ ] 4.3 Write failing test: `buildSummaryPrompt(input,'analysis',true)` (hasImages) contains an instruction that charts/figures are attached and must be incorporated; `hasImages=false` is unchanged
- [ ] 4.4 Implement the `hasImages` param on `buildSummaryPrompt`

## 5. Summarizer multimodal + fallback (TDD)

- [ ] 5.1 Write failing tests for `createGeminiSummarizer` with an injected `fetchImage`:
  (a) email + imageUrls → request body has inline_data parts;
  (b) a `fetchImage` returning `null` for one URL → that image skipped, others sent;
  (c) a `fetchImage` that THROWS → treated as skip (no summary abort);
  (d) non-email or empty imageUrls → text-only request;
  (e) multimodal post returns non-ok once → falls back to a text-only request that succeeds
- [ ] 5.2 Implement: `GeminiDeps.fetchImage?`; gate `sourceType==='email' && imageUrls?.length`; `slice(0, MAX_ARTICLE_IMAGES)`; `Promise.all(map(fetchImage)).filter(Boolean)`; build multimodal contents with `hasImages=true`; on multimodal request failure, retry text-only

## 6. Thread imageUrls through summarize (TDD)

- [ ] 6.1 Write failing test: `runSummarize` forwards `imageUrls` from `PendingSummary` into the `summarize()` input
- [ ] 6.2 Implement the forwarding in `src/pipeline/run-summarize.ts`

## 7. Database migration

- [ ] 7.1 Add migration `supabase/migrations/0007_article_images.sql`: `alter table articles add column if not exists image_urls text[]`
- [ ] 7.2 Static sanity check

## 8. Adapters: store/return image_urls + real image fetchers (static; gates green)

- [ ] 8.1 Runner (`scripts/run-pipeline.ts`): `insertNewArticles` stores `image_urls: a.imageUrls ?? null`
- [ ] 8.2 Runner: `listPendingSummaries` selects `image_urls` and returns `imageUrls` in `PendingSummary`
- [ ] 8.3 Runner: add a Node `fetchImage(url)` — `fetch(url,{headers:{Accept:'image/png,image/jpeg,image/webp'}})`, on non-ok/throw return null, read `content-type`, return null if not in {png,jpeg,webp}, `Buffer.from(await res.arrayBuffer()).toString('base64')` — and pass it into `createGeminiSummarizer`
- [ ] 8.4 Deno adapter parity: `supabase/functions/_shared/db.ts` store + return `image_urls`; AND `supabase/functions/summarize/index.ts` injects a Deno `fetchImage` using `encodeBase64` from `jsr:@std/encoding/base64` (NOT `btoa(String.fromCharCode(...))`), same Accept header + mime allow-list + null-on-failure contract
- [ ] 8.5 Confirm `npm test` + `npm run typecheck` stay green

## 9. Verification & backfill (live, user-run)

- [ ] 9.1 Apply migration 0007 in the Supabase SQL editor
- [ ] 9.2 One-off backfill script `scripts/_backfill-email-images.ts`: re-read the FOMO emails (IMAP), `extractImageUrls`, `UPDATE articles SET image_urls=... WHERE guid=...` (bypassing `filterNewArticles`), then reset those articles' summaries to `pending`
- [ ] 9.3 Re-run `npx tsx scripts/run-pipeline.ts`; confirm paid summaries reflect chart content and a logo/avatar/pixel never appears; HN unchanged
