## ADDED Requirements

### Requirement: Email magic-link sign-in
The system SHALL let a user sign in with an email magic link via Supabase Auth,
and SHALL persist the session so the user stays signed in across app launches.

#### Scenario: Request a magic link
- **WHEN** a user enters a valid email and requests sign-in
- **THEN** Supabase Auth sends a magic-link email and the app shows a "check your email" state

#### Scenario: Complete sign-in from the link
- **WHEN** the user opens the magic link
- **THEN** the app establishes an authenticated session and routes to the Today feed

#### Scenario: Session persists across launches
- **WHEN** a previously signed-in user reopens the app
- **THEN** the app restores the session without requiring another sign-in

#### Scenario: Sign out
- **WHEN** a signed-in user signs out
- **THEN** the session is cleared and the app returns to the sign-in screen

### Requirement: Per-user data isolation
Every data table SHALL enforce Row Level Security so a user can read and write
only rows owned by their own `user_id`.

#### Scenario: User reads only their own data
- **WHEN** a signed-in user queries sources, articles, or summaries
- **THEN** only rows belonging to that user are returned

#### Scenario: Cross-user access is denied
- **WHEN** a request attempts to read or modify another user's row
- **THEN** the database rejects it under the Row Level Security policy
