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

### Requirement: Hacker News section is limited to the last 24 hours
The feed SHALL show in the Hacker News section only Hacker News articles
(`sourceType === 'hackernews'`) whose publish time is within the last 24 hours;
older or undated Hacker News items SHALL be excluded. Items SHALL be ordered newest
first. The recency bound SHALL be keyed on the Hacker News source type, not on
"non-email", so other source types are not silently hidden.

#### Scenario: Recent HN article is shown
- **WHEN** a Hacker News article published within the last 24 hours has a completed summary returned by the feed query
- **THEN** it appears in the Hacker News section

#### Scenario: Stale HN article is hidden
- **WHEN** a Hacker News article was published more than 24 hours ago (e.g. an old backlog item summarized today)
- **THEN** it does not appear in the Hacker News section

#### Scenario: Undated HN item is excluded
- **WHEN** a Hacker News item has no publish time
- **THEN** it is not shown in the Hacker News section

### Requirement: Per-source feed sections
The feed SHALL group items into one section per source: each email newsletter as its
own section (titled with its source) capped to `MAX_PAID_ITEMS` newest items, and
Hacker News as a single section. Non-HN source sections SHALL be ordered by their
newest item (descending) and the Hacker News section SHALL come last. Empty sections
SHALL be omitted. (The Hacker-News 24h bound is governed by the existing
"Hacker News section is limited to the last 24 hours" requirement, not restated here.)

#### Scenario: Each email newsletter is its own section
- **WHEN** items from two email newsletters (e.g. FOMO研究院 and 曼報 Pro) are present
- **THEN** the feed shows a separate section for each, titled by that source, each newest-first and capped to `MAX_PAID_ITEMS`

#### Scenario: A second newsletter is not starved by the first
- **WHEN** one newsletter has many recent items and another has fewer
- **THEN** each newsletter's section still shows its own latest items (the feed query supplies enough rows per source, not a single global cap)

#### Scenario: Hacker News is one section, ordered last
- **WHEN** Hacker News items are present alongside email sources
- **THEN** Hacker News appears as a single section after the email sections

#### Scenario: Empty sections are omitted
- **WHEN** a source has no items to show
- **THEN** no section is rendered for it

### Requirement: Jump to a source
The feed SHALL present a control listing the visible sources; selecting a source SHALL
scroll the feed to that source's section. The control SHALL list exactly the visible
sections, in the same order.

#### Scenario: Tapping a source scrolls to it
- **WHEN** the user taps a source in the jump control
- **THEN** the feed scrolls to the top of that source's section

#### Scenario: Jump control matches the sections
- **WHEN** the feed renders its sections
- **THEN** the jump control lists exactly those visible sections in the same order

### Requirement: Previous/next navigation in the article view
The article detail view SHALL let the user move to the previous and next article in the
feed's display order. At the ends of the order, or when the current article's position
is unknown, the unavailable direction SHALL be disabled or hidden rather than error.
Navigating to an adjacent article SHALL show a loading state for the new article rather
than leaving the previous article's content on screen.

#### Scenario: Next goes to the following article
- **WHEN** the user views an article with a following article in the feed order and taps Next
- **THEN** the detail view loads and shows that following article

#### Scenario: Previous goes to the preceding article
- **WHEN** the user views an article with a preceding article and taps Previous
- **THEN** the detail view loads and shows that preceding article

#### Scenario: Ends of the list
- **WHEN** the user views the first (or last) article in the order
- **THEN** Previous (or Next) is disabled/hidden and nothing errors

#### Scenario: Order unknown
- **WHEN** the feed order is unavailable (e.g. the detail was opened directly)
- **THEN** prev/next are disabled/hidden and the article still displays

