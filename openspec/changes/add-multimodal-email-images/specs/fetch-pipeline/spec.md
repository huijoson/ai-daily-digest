## ADDED Requirements

### Requirement: Capture content image URLs during ingestion
The system SHALL extract and store an email article's content image URLs, excluding
non-content images by an explicit rule, deduplicated, and bounded to
`MAX_ARTICLE_IMAGES` per article. Sources that do not deliver images (Hacker News,
RSS) SHALL store no image URLs.

The exclusion rule (so the behavior is deterministic and testable) SHALL drop:
tracking pixels/beacons (host `open.substack.com`, paths containing `/open`, or 1×1
images); and avatars/logos/badges identified by Cloudinary transform/path markers —
a `w_` width under 400, or any of `c_fill` / `g_face` / `g_auto`, or paths containing
`/profile/`, `/pub/`, `logo`, `icon`, `button`, `favicon`, `avatars`. It SHALL keep
the remaining `substackcdn.com/image/...` content images.

#### Scenario: Email content images are captured
- **WHEN** an email article is ingested and its body contains content charts
- **THEN** the article is stored with those content image URLs, deduplicated, up to `MAX_ARTICLE_IMAGES`

#### Scenario: Non-content images are excluded
- **WHEN** an email body also contains the publication logo, an author avatar, a subscribe button, and a tracking pixel
- **THEN** none of those are stored — only the content charts

#### Scenario: Bounded per article
- **WHEN** an email body contains more content images than `MAX_ARTICLE_IMAGES`
- **THEN** at most `MAX_ARTICLE_IMAGES` URLs are stored

#### Scenario: Image-less sources store nothing
- **WHEN** a Hacker News or RSS article is ingested
- **THEN** no image URLs are stored for it

#### Scenario: Heuristic verified against a real email
- **WHEN** the extractor is run on a captured real Substack delivery email fixture
- **THEN** it returns exactly that email's content chart URLs and none of its chrome images
