## ADDED Requirements

### Requirement: Add a source by feed URL
The system SHALL let a signed-in user add a source by pasting a feed URL, and
SHALL validate that the URL resolves to a parseable feed before saving it.

#### Scenario: Add a valid RSS/Atom feed
- **WHEN** a user submits a URL that resolves to a parseable feed
- **THEN** the system saves a `sources` row with `type`, `feed_url`, derived `title`, and `is_active = true`, owned by that user

#### Scenario: Reject an unreachable or unparseable URL
- **WHEN** a user submits a URL that does not resolve or is not a parseable feed
- **THEN** the system does not save a source and returns a clear validation error

#### Scenario: Detect source type from the URL
- **WHEN** the submitted URL is a YouTube channel feed, a Substack feed, or a generic RSS feed
- **THEN** the saved source's `type` is set to `youtube`, `rss`, or `rss` accordingly

### Requirement: Enable Hacker News as a source
The system SHALL let a user enable Hacker News as a source without entering a URL.

#### Scenario: Toggle Hacker News on
- **WHEN** a user enables Hacker News
- **THEN** the system saves a source with `type = 'hackernews'` and `is_active = true`

### Requirement: Enable, disable, and remove sources
The system SHALL let a user toggle a source active/inactive and remove a source,
and inactive sources SHALL be skipped by the fetch pipeline.

#### Scenario: Disable a source
- **WHEN** a user disables an active source
- **THEN** `is_active` becomes false and the fetch pipeline skips it on the next run

#### Scenario: Remove a source
- **WHEN** a user removes a source
- **THEN** the source is deleted and no longer appears in the user's source list

### Requirement: Surface source fetch errors
The system SHALL record the most recent fetch error per source and surface it to
the user so they can fix or remove a broken source.

#### Scenario: A source repeatedly fails to fetch
- **WHEN** the fetch pipeline fails to fetch or parse a source
- **THEN** `sources.last_error` is updated and the app shows that source as having an error
