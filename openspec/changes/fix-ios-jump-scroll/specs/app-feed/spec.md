## MODIFIED Requirements

### Requirement: Jump to a source
The feed SHALL present a control listing the visible sources; selecting a source SHALL
scroll the feed to THAT source's section — to the tapped source's own position, on every
supported platform (web and iOS), regardless of whether the section was already on screen.
The control SHALL list exactly the visible sections, in the same order. Each control item
SHALL provide a comfortable touch target (size plus `hitSlop` ≥ the ~44pt platform
minimum), and adjacent items' touch areas SHALL NOT overlap.

#### Scenario: Tapping a source scrolls to that source
- **WHEN** the user taps a source in the jump control
- **THEN** the feed scrolls to the top of THAT source's section

#### Scenario: A later source does not land on the first section
- **WHEN** the user taps a source other than the first (e.g. the second or third source) on iOS
- **THEN** the feed scrolls to that source's section, NOT back to the first section

#### Scenario: Scrolling to an off-screen section
- **WHEN** the user taps a source whose section is below the fold
- **THEN** the feed still scrolls to that section

#### Scenario: Jump control matches the sections
- **WHEN** the feed renders its sections
- **THEN** the jump control lists exactly those visible sections in the same order

#### Scenario: Comfortable tap target
- **WHEN** the jump control is rendered
- **THEN** each source item's effective touch target (size plus `hitSlop`) is at least the ~44pt platform minimum, and adjacent items' touch areas do not overlap
