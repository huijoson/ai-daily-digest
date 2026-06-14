## ADDED Requirements

### Requirement: Scheduled daily fetch
The system SHALL run the fetch pipeline automatically once per day via `pg_cron`,
processing every active source across all users.

#### Scenario: Daily trigger
- **WHEN** the scheduled time (~07:00) is reached
- **THEN** the fetch Edge Function runs and processes all `is_active` sources

#### Scenario: Manual trigger for testing
- **WHEN** the fetch function is invoked manually
- **THEN** it performs the same fetch-and-store work as the scheduled run

### Requirement: Parse feed items into articles
The system SHALL fetch each active source and parse its items into article
records containing at least `guid`, `title`, `url`, and `published_at`.

#### Scenario: Parse an RSS/Atom feed
- **WHEN** a source feed is fetched successfully
- **THEN** each item is parsed into an article with `guid`, `title`, `url`, and `published_at`

#### Scenario: Parse the Hacker News source
- **WHEN** the Hacker News source is processed
- **THEN** top stories are parsed into articles with a stable `guid`, `title`, and `url`

### Requirement: Deduplicate new articles by guid
The system SHALL insert only articles whose `guid` is not already stored, so the
pipeline is idempotent and re-runs do not create duplicates.

#### Scenario: New article is inserted
- **WHEN** a parsed item has a `guid` not present in `articles`
- **THEN** the article is inserted and a `summaries` row is created with `status = 'pending'`

#### Scenario: Already-seen article is skipped
- **WHEN** a parsed item has a `guid` that already exists in `articles`
- **THEN** no new article or summary row is created for it

#### Scenario: Re-running the fetch is safe
- **WHEN** the fetch runs twice over the same feed contents
- **THEN** the second run inserts no additional articles

### Requirement: Isolate per-source failures
The system SHALL handle a failing source without aborting the whole run, recording
the error and continuing with the remaining sources.

#### Scenario: One source errors out
- **WHEN** fetching or parsing one source throws or times out
- **THEN** the system records `sources.last_error`, skips that source, and continues processing the others
