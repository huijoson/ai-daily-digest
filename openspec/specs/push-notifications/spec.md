# push-notifications Specification

## Purpose
TBD - created by archiving change add-daily-digest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Register a device push token
The system SHALL obtain an Expo push token on app start for a signed-in user and
store it, keyed to the user and device platform.

#### Scenario: Store a push token on launch
- **WHEN** a signed-in user opens the app and grants notification permission
- **THEN** the app obtains an Expo push token and upserts a `push_tokens` row with the user and platform

#### Scenario: Permission denied
- **WHEN** the user denies notification permission
- **THEN** no token is stored and the app continues to function without push

### Requirement: Send the daily digest notification
The system SHALL send one push notification per user per day after the pipeline
completes, summarizing how many new summaries are ready.

#### Scenario: Notify when new summaries exist
- **WHEN** the daily pipeline finishes and a user has new `done` summaries
- **THEN** the system sends one Expo push to that user's tokens stating the count of new summaries

#### Scenario: No notification when nothing is new
- **WHEN** the daily pipeline finishes and a user has no new summaries
- **THEN** no push notification is sent to that user

#### Scenario: Opening the notification lands on the feed
- **WHEN** the user taps the digest notification
- **THEN** the app opens to the Today feed

### Requirement: Prune invalid push tokens
The system SHALL remove push tokens that Expo reports as invalid so future sends
do not repeatedly fail.

#### Scenario: Expo reports an invalid token
- **WHEN** a send returns a device-not-registered error for a token
- **THEN** the system deletes that token from `push_tokens`

