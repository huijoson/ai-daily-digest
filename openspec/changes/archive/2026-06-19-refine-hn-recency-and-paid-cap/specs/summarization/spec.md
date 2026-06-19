## ADDED Requirements

### Requirement: Recency-bounded selection of Hacker News articles
The system SHALL only summarize Hacker News articles whose publish time is within
the last 24 hours, selecting them newest-first, so that a backlog of older pending
items does not consume the summarization batch or starve fresh news. Paid (email)
selection SHALL remain unbounded by time and is selected first. Any existing
attempt-count cap SHALL be preserved when the recency bound is added.

#### Scenario: Fresh Hacker News articles are summarized first
- **WHEN** the summarize step runs and recent (last-24h) Hacker News articles are pending
- **THEN** those recent articles are selected newest-first for summarization

#### Scenario: Stale Hacker News backlog is not selected
- **WHEN** Hacker News pending articles were published more than 24 hours ago
- **THEN** they are not selected for summarization (they no longer consume the batch)

#### Scenario: Paid articles are unaffected by the recency bound
- **WHEN** a paid (email) article is pending regardless of age
- **THEN** it is still eligible for summarization and is selected before Hacker News articles
