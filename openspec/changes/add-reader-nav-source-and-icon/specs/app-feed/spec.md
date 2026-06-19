## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Paid section shows only the latest few posts
**Reason**: Replaced by per-source feed sections — paid (email) content is no longer a
single combined section but one section per newsletter.
**Migration**: The `MAX_PAID_ITEMS` cap now applies per email source (each newsletter
shows its own latest `MAX_PAID_ITEMS`), enforced by the new "Per-source feed sections"
requirement and a feed query that supplies enough rows per source.
