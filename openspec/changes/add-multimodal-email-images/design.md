## Context

Email-delivered paid posts (e.g. `fomosoc@substack.com`) store their full prose in
the plain-text body (already captured — ~18–20k chars per post), but their charts
are images on the Substack CDN. Text-only summarization drops the figures'
information. Gemini 2.5-flash supports multimodal (vision) input, so we can include
the images. The pipeline isolates pure logic (injected dependencies, Vitest) from
thin adapters; this change keeps that boundary.

**Two summarize paths exist** and BOTH must be made multimodal (or the feature
no-ops on whichever runs): the local runner `scripts/run-pipeline.ts` (the active
path in this deployment, run by launchd) and the Deno Edge Function
`supabase/functions/summarize/index.ts` (dormant — never deployed here, but kept at
parity so a future deploy is also multimodal).

## Goals / Non-Goals

**Goals:**
- Paid (email) summaries incorporate the article's content images via Gemini vision,
  on BOTH summarize paths (runner + Deno), so the feature never silently no-ops.
- Image extraction is pure, tested, bounded, deduplicated, and actually excludes
  logos/avatars/tracking pixels (not just "on the CDN").
- Robust: a failed/unsupported image is skipped; a failed multimodal request falls
  back to a text-only summary (no regression to "no summary at all").
- Text-only summarization (Hacker News / RSS) is byte-for-byte unchanged.

**Non-Goals:**
- Multimodal for non-email sources.
- Storing image bytes (store URLs; fetch at summarize time).
- OCR / per-image alt-text in the app UI.
- Re-architecting email ingestion beyond image extraction.

## Decisions

### Image extraction (pure) — `extractImageUrls(html)` in `src/pipeline/email.ts`
- Parse `<img>` tags; consider `src` (Substack puts the usable URL in `src`).
- **Keep** only Substack content images and **exclude** non-content with an explicit
  predicate (so the test is deterministic):
  - DROP tracking pixels / beacons: host `open.substack.com`, paths containing
    `/open`, or width/height `=1`.
  - DROP avatars/logos/badges: Cloudinary transform segments indicating small crops —
    `w_` value `< 400`, or any of `c_fill`, `g_face`, `g_auto`; and paths containing
    `/profile/`, `/pub/`, `logo`, `icon`, `button`, `favicon`, `avatars`.
  - KEEP the rest that are on `substackcdn.com/image/` (content charts use `c_limit`
    with large `w_`, e.g. `w_1456`).
- **Dedup** by exact URL string (documented as acceptable; near-dup resolutions are
  rare for charts and bounded by the cap).
- **Cap** at `MAX_ARTICLE_IMAGES = 12`, defined once in `src/pipeline/constants.ts`
  and imported by both the extractor and the summarizer.
- Validate against a REAL captured FOMO email HTML fixture (not only synthetic), so
  the heuristic is proven on production input before backfill.

### Multimodal gate (one canonical condition)
Send a multimodal request **iff `sourceType === 'email'` AND `imageUrls` is
non-empty**. This is checked in `createGeminiSummarizer`. HN/RSS stay text-only by
source type, not by accident of an empty list.

### Image fetcher contract — injected, never throws
`GeminiDeps.fetchImage?: (url) => Promise<{ mimeType: string; base64: string } | null>`.
- The real adapter (runner = Node, Deno = Edge) wraps fetch in try/catch and returns
  `null` on ANY failure (network, non-2xx).
- It sends `Accept: image/png,image/jpeg,image/webp` to steer Substack's Cloudinary
  `f_auto` away from AVIF.
- `mimeType` is derived from the response `Content-Type` header. If it is NOT in the
  supported allow-list **{`image/png`, `image/jpeg`, `image/webp`}**, return `null`
  (skip). `base64` is RAW base64 (no `data:` prefix).
- Deno base64: use `encodeBase64` from `jsr:@std/encoding/base64` on the `Uint8Array`
  — do NOT use `btoa(String.fromCharCode(...new Uint8Array(buf)))` (stack-overflows
  on large images). Node: `Buffer.from(arrayBuffer).toString('base64')`.

### Request assembly (pure) — `buildGeminiContents(promptText, images)`
- Returns the **`parts` array**: `[{ text: promptText }, ...images.map(i => ({ inline_data: { mime_type: i.mimeType, data: i.base64 } }))]`.
- The summarizer wraps it as `{ contents: [{ parts }] }`.
- Parameter name is `promptText` everywhere.

### Summarizer flow — `createGeminiSummarizer`
```
if (sourceType === 'email' && imageUrls?.length) {
  images = (await Promise.all(imageUrls.slice(0, MAX_ARTICLE_IMAGES).map(fetchImage)))
             .filter(Boolean)            // skip nulls (failed/unsupported)
  if (images.length) {
    try { return await postContents(buildGeminiContents(prompt(hasImages=true), images)) }
    catch { /* fall through to text-only so the paid article still gets a summary */ }
  }
}
return await postContents(buildGeminiContents(prompt(hasImages=false), []))  // text-only
```
- **Text-only fallback**: if the multimodal request throws (oversize / vision error),
  retry once text-only. A paid article therefore always gets at least a text summary
  (no regression vs. today).

### Prompt — `buildSummaryPrompt(input, mode, hasImages = false)`
- In `analysis` mode with `hasImages`, add a line: *"The article's charts/figures are
  attached as images; read the data they show and incorporate it into the takeaway,
  key points, and analysis."* When `hasImages` is false the prompt is unchanged
  (so HN/RSS and image-less paid posts are identical to today).

### Data flow
```
email HTML --parseSubstackEmail/extractImageUrls--> ParsedArticle{content, imageUrls[<=12]}
  --insertNewArticles--> articles.content + articles.image_urls
  --listPendingSummaries--> PendingSummary{content, imageUrls, sourceType}
  --runSummarize--> summarize({content, imageUrls, sourceType:'email'})
  --createGeminiSummarizer (BOTH runner + Deno)--> fetchImage(each, Accept png/jpeg/webp,
      skip null/unsupported) -> buildGeminiContents(prompt(hasImages), imgs)
      -> Gemini vision; on request failure -> text-only fallback
```

## Risks / Trade-offs

- **Production no-op** → resolved: BOTH summarize paths inject `fetchImage`.
- **Request too large / unsupported format** → mitigated: supported-mime allow-list +
  `Accept` steering + per-article cap + **text-only fallback** on request failure.
- **Noise images (logo/avatar)** → mitigated: explicit exclusion predicate + real-email
  fixture test; cap bounds worst case.
- **fetchImage throwing aborts the summary** → resolved: contract is "never throws,
  returns null"; a test injects a THROWING fake to prove the no-abort guarantee.
- **Backfill** → an explicit one-off script does `UPDATE articles SET image_urls
  WHERE guid` (bypassing `filterNewArticles`) then resets those summaries to `pending`.

## Migration Plan

1. Add migration `articles.image_urls text[]` (`add column if not exists`).
2. Ship pure logic + adapter changes (text-only path unchanged for HN/RSS).
3. Re-run the pipeline → new email posts get image URLs + multimodal summaries.
4. One-off backfill for the two existing FOMO articles (script in §7), then re-run.
Rollback: the column and optional field are additive; reverting the summarizer falls
back to text-only with no data loss.

## Open Questions

- Final image cap (start at 12; tune by cost/quality).
- Whether to later downscale large charts (rewrite `w_1456`→`w_1024`) if request size
  becomes a problem — deferred; the cap + fallback cover it for now.
