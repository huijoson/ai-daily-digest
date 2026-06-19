## MODIFIED Requirements

### Requirement: Jump to a source
The feed SHALL present a control listing the visible sources; selecting a source SHALL
scroll the feed to that source's section, reliably on every supported platform (web and
iOS), recovering when the target section is not yet measured. The control SHALL list
exactly the visible sections, in the same order. Each control item SHALL provide a
comfortable touch target (large enough to tap accurately on touch and click on web).

#### Scenario: Tapping a source scrolls to it
- **WHEN** the user taps a source in the jump control
- **THEN** the feed scrolls to the top of that source's section

#### Scenario: Scrolling to an off-screen section that is not yet measured
- **WHEN** the user taps a source whose section is below the fold and not yet rendered/measured
- **THEN** the feed still scrolls to that section (the control recovers from the initial scroll failure rather than doing nothing)

#### Scenario: Jump control matches the sections
- **WHEN** the feed renders its sections
- **THEN** the jump control lists exactly those visible sections in the same order

#### Scenario: Comfortable tap target
- **WHEN** the jump control is rendered
- **THEN** each source item's effective touch target (size plus `hitSlop`) is at least the ~44pt platform minimum, and adjacent items' touch areas do not overlap
