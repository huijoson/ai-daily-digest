## Why

People follow content across many platforms (Substack newsletters, YouTube
channels, Hacker News) but have no single place that pulls it together, and
skimming every source daily is slow. This change delivers an MVP that
aggregates user-chosen sources, summarizes each new item with an LLM, and pushes
one daily notification so the user can read the day's highlights in one place.

It is also a multi-week learning project: the core value (an idempotent,
unattended fetch → summarize → push pipeline) exercises scheduling, serverless
functions, LLM integration, and mobile push end to end.

## What Changes

- Users sign in (email magic link) and manage a personal list of sources by
  pasting RSS-style feed URLs (Substack publications, YouTube channels) plus a
  toggle for Hacker News.
- A scheduled backend pipeline runs daily (~07:00 via `pg_cron`):
  - **Fetch**: pull each active source, parse items, dedup by `guid`, insert only
    new articles and mark their summary row `pending`.
  - **Summarize**: process `pending` articles in batches, calling an LLM through
    a `summarize()` abstraction (Gemini free tier by default), write back the
    summary and set status `done`/`failed`.
  - **Push**: send one Expo push notification counting the day's new summaries.
- The Expo app shows a Today feed of completed summaries, a source-management
  screen, and an article detail view that links to the original.
- LLM access is provider-agnostic behind one module. **Note:** a Claude
  subscription cannot be used as a programmatic API, so the backend defaults to
  Gemini's free tier; swapping providers changes only the `summarize()` module.

## Capabilities

### New Capabilities
- `auth`: email magic-link sign-in and per-user data isolation via Row Level Security.
- `source-management`: add, validate, enable/disable, and remove personal feed sources.
- `fetch-pipeline`: scheduled fetch + parse + dedup of new articles into the database.
- `summarization`: provider-agnostic per-article LLM summaries with an idempotent status state machine.
- `push-notifications`: register Expo push tokens and send the daily digest notification.
- `app-feed`: mobile Today feed and article detail rendering of summaries.

### Modified Capabilities
<!-- None — this is a greenfield MVP; no existing specs to modify. -->

## Impact

- **New project scaffold**: Expo (React Native, TypeScript) app + Supabase project.
- **Supabase**: Postgres schema (`sources`, `articles`, `summaries`, `push_tokens`,
  Supabase Auth `users`), Row Level Security policies, Edge Functions (`fetch`,
  `summarize`), and `pg_cron` schedule.
- **External dependencies**: an RSS/Atom parser, the Hacker News API, the Gemini
  API (free tier), and Expo Push Notifications.
- **Secrets/config**: Gemini API key and Supabase service role key held server-side
  in Edge Function environment, never shipped in the app.
- **No breaking changes** (greenfield).
