## ADDED Requirements

### Requirement: Email newsletters are parsed regardless of delivery platform
Email ingestion SHALL parse a newsletter email into an article using
platform-independent fields — the subject as the title and the plain-text body as the
content — so the summary is produced for any newsletter, not only Substack-delivered
ones. Content images SHALL be selected from an allow-list of known content-image hosts
(Substack `substackcdn.com` and Mailchimp `mcusercontent.com`), excluding tracking
pixels (1×1) and non-content assets (logos, avatars, icons). A canonical article URL
SHALL be extracted when the email contains one (e.g. a Substack `…/p/…` post link);
when no per-article canonical URL exists (e.g. a Mailchimp multi-article digest), the
URL SHALL be empty and the reader SHALL omit the "Open original" action.

#### Scenario: Substack-delivered newsletter (FOMO研究院)
- **WHEN** a Substack email is ingested
- **THEN** its title, content, `substackcdn.com` content images, and `…/p/…` canonical URL are extracted (unchanged from today)

#### Scenario: Mailchimp-delivered newsletter (曼報 Pro)
- **WHEN** a Mailchimp email (`*.list-manage.com` sender, `mcusercontent.com` images) is ingested
- **THEN** its title (subject) and content (text body) are extracted and a summary is produced

#### Scenario: Mailchimp content images are kept, tracking pixels dropped
- **WHEN** a Mailchimp email has content images on `mcusercontent.com` plus a 1×1 `list-manage.com` tracking pixel
- **THEN** the `mcusercontent.com` content images are kept and the 1×1 pixel is excluded

#### Scenario: No canonical URL in a digest email
- **WHEN** a newsletter email contains no per-article canonical URL
- **THEN** the article's URL is empty and the article still ingests and summarizes
