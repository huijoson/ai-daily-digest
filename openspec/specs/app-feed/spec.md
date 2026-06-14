# app-feed Specification

## Purpose
TBD - created by archiving change add-daily-digest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Today feed of summaries
The app SHALL show the signed-in user a feed of the day's completed summaries,
ordered by recency, with pull-to-refresh.

#### Scenario: View today's summaries
- **WHEN** a signed-in user opens the Today feed
- **THEN** the app shows articles with a `done` summary for today, each with title, summary, source, and time

#### Scenario: Pull to refresh
- **WHEN** the user pulls to refresh
- **THEN** the feed re-queries Supabase and shows any newly completed summaries

#### Scenario: Empty day
- **WHEN** there are no completed summaries for today
- **THEN** the app shows an empty state instead of an error

### Requirement: Article detail view
The app SHALL show a detail view with the full summary and a link to open the
original article.

#### Scenario: Open an article from the feed
- **WHEN** the user taps an item in the Today feed
- **THEN** the app shows the full summary and the article metadata

#### Scenario: Open the original source
- **WHEN** the user taps the "open original" action
- **THEN** the device opens the article URL in the system browser

### Requirement: App performs no fetching or summarization
The app SHALL act only as a Supabase read/write client and SHALL NOT fetch feeds
or call the LLM directly; all aggregation and summarization happens server-side.

#### Scenario: App reads precomputed data
- **WHEN** the app renders any screen
- **THEN** it reads already-fetched articles and already-computed summaries from Supabase rather than fetching feeds or calling an LLM

