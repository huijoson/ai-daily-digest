# summarization Specification

## Purpose
TBD - created by archiving change add-daily-digest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Provider-agnostic summarize abstraction
The system SHALL summarize article content through a single `summarize()` module
that hides the LLM provider, defaulting to the Gemini free tier, so the provider
can be changed by editing only that module.

#### Scenario: Summarize via the default provider
- **WHEN** `summarize()` is called with article content
- **THEN** it returns a short summary and the model identifier used (e.g. `gemini-2.0-flash`)

#### Scenario: Provider is swappable
- **WHEN** the provider module is changed to another LLM
- **THEN** the rest of the pipeline calls `summarize()` unchanged and stores the new `model` value

### Requirement: Summarize pending articles in batches
The system SHALL process articles with `status = 'pending'` in fixed-size batches
so a single function invocation stays within execution-time and rate limits.

#### Scenario: Process a batch of pending articles
- **WHEN** the summarize function runs and pending articles exist
- **THEN** it summarizes up to the batch size, writing `summary_text`, `model`, and `status = 'done'` for each

#### Scenario: Remaining work resumes next run
- **WHEN** more pending articles exist than the batch size
- **THEN** the excess stays `pending` and is processed on the next scheduled run

### Requirement: Idempotent retry on failure
The system SHALL mark a failed summary `failed` without aborting the batch, and
SHALL retry it on a later run up to a bounded number of attempts.

#### Scenario: A single summary call fails
- **WHEN** the LLM call for one article errors or is rate-limited
- **THEN** that article's summary is set to `status = 'failed'` and the batch continues with the others

#### Scenario: Failed summaries are retried
- **WHEN** the summarize function runs again
- **THEN** previously `failed` articles are retried until they succeed or reach the attempt limit

#### Scenario: Completed summaries are not redone
- **WHEN** the summarize function runs again
- **THEN** articles already `done` are not re-summarized

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

