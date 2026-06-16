## ADDED Requirements

### Requirement: Multimodal summaries for image-rich paid content
The system SHALL include a paid (email) article's content images as vision input to
the LLM when, and only when, `sourceType` is `email` AND the article has at least one
content image URL. Text-only sources (Hacker News, RSS) and image-less paid articles
SHALL be summarized text-only, exactly as before. At most `MAX_ARTICLE_IMAGES` images
SHALL be included in a request.

#### Scenario: Paid article with images sends a multimodal request
- **WHEN** a paid (email) article with one or more content image URLs is summarized
- **THEN** the request sent to the LLM contains the text prompt part plus one inline image part per successfully fetched image

#### Scenario: Prompt tells the model figures are attached
- **WHEN** the request includes image parts
- **THEN** the text prompt instructs the model that the article's charts/figures are attached and must be incorporated into the summary

#### Scenario: Text-only sources are unaffected
- **WHEN** a Hacker News or RSS article, or a paid article with no image URLs, is summarized
- **THEN** a text-only request is sent, byte-for-byte as before this change

#### Scenario: A failed or unsupported image is skipped
- **WHEN** an image cannot be fetched, or is fetched with a MIME type outside the supported set (image/png, image/jpeg, image/webp)
- **THEN** that image is omitted and the summary proceeds with the remaining images

#### Scenario: A failed multimodal request falls back to text-only
- **WHEN** the assembled multimodal request is rejected by the LLM (e.g. too large or a vision error)
- **THEN** the system retries the same article with a text-only request so the paid article still receives a summary

#### Scenario: Image count is bounded
- **WHEN** an article carries more image URLs than `MAX_ARTICLE_IMAGES`
- **THEN** the request includes at most `MAX_ARTICLE_IMAGES` image parts

### Requirement: Both summarize paths are multimodal
The system SHALL apply multimodal summarization on every summarize path so paid
summaries are never silently produced text-only. Both the local runner and the Deno
Edge Function SHALL inject an image fetcher into the summarizer.

#### Scenario: Runner path is multimodal
- **WHEN** the local runner summarizes a paid article with images
- **THEN** it injects an image fetcher and sends a multimodal request

#### Scenario: Deno edge path is multimodal
- **WHEN** the Deno Edge Function summarizes a paid article with images
- **THEN** it injects a Deno-compatible image fetcher and sends a multimodal request (kept at parity even though the Edge path is not deployed in the current environment)
