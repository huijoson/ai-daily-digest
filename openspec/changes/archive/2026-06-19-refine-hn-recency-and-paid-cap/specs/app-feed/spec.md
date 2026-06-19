## ADDED Requirements

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

### Requirement: Paid section shows only the latest few posts
The feed SHALL show at most the latest `MAX_PAID_ITEMS` (3) paid (email) summaries,
ordered newest first; older paid posts SHALL be omitted from the feed.

#### Scenario: At most three paid posts
- **WHEN** more than three paid (email) summaries exist
- **THEN** only the three most recent are shown in the paid section

#### Scenario: Fewer than three paid posts
- **WHEN** one or two paid summaries exist
- **THEN** all of them are shown, newest first
