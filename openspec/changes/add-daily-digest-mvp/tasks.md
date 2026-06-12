## 1. Project scaffold & tooling

- [ ] 1.1 Initialize Expo (React Native + TypeScript) app with a navigation stack
- [ ] 1.2 Initialize Supabase local project (`supabase init`) and link config
- [ ] 1.3 Add a test runner (Jest/Vitest) and configure TypeScript + lint
- [ ] 1.4 Add the Supabase JS client and shared config (env-based, no secrets in app)
- [ ] 1.5 Commit a clean baseline scaffold

## 2. Database schema & RLS (capability: auth)

- [ ] 2.1 Write a migration for `sources`, `articles`, `summaries`, `push_tokens`
- [ ] 2.2 Add `articles.guid` unique constraint and `summaries.status` enum/check
- [ ] 2.3 Add Row Level Security policies scoping every table to `user_id`
- [ ] 2.4 Integration test: cross-user read/write is denied; owner access succeeds

## 3. Authentication (capability: auth)

- [ ] 3.1 Implement email magic-link sign-in screen via Supabase Auth
- [ ] 3.2 Persist and restore session across app launches; implement sign-out
- [ ] 3.3 Gate app routes on auth state (signed-out → sign-in, signed-in → feed)

## 4. Feed parsing core — pure logic, TDD first (capability: fetch-pipeline)

- [ ] 4.1 Write failing tests for RSS/Atom parsing into `{guid,title,url,published_at}`
- [ ] 4.2 Implement the RSS/Atom parser to pass the tests
- [ ] 4.3 Write failing tests + implement Hacker News parsing with stable `guid`
- [ ] 4.4 Write failing tests + implement dedup-by-`guid` and source-type detection
- [ ] 4.5 Write failing tests + implement URL feed validation used by source-add

## 5. Source management (capability: source-management)

- [ ] 5.1 Implement add-source (validate URL, detect type, save `is_active`)
- [ ] 5.2 Implement enable/disable, remove, and Hacker News toggle
- [ ] 5.3 Build the source-management screen and wire it to Supabase
- [ ] 5.4 Surface `sources.last_error` in the UI

## 6. Fetch Edge Function (capability: fetch-pipeline)

- [ ] 6.1 Implement the fetch function: load active sources, parse, dedup, insert
- [ ] 6.2 Create `summaries` rows with `status='pending'` for new articles
- [ ] 6.3 Isolate per-source failures (try/catch, record `last_error`, continue)
- [ ] 6.4 Integration test: one fetch cycle against local Supabase; rerun inserts nothing

## 7. Summarization (capability: summarization)

- [ ] 7.1 Write failing tests for the `summarize()` abstraction with Gemini mocked
- [ ] 7.2 Implement `summarize()` (Gemini free tier) returning text + model id
- [ ] 7.3 Implement the summarize function: batch pending → write text/model/status
- [ ] 7.4 Implement failure handling (`status='failed'`), bounded retry, skip `done`
- [ ] 7.5 Integration test: full fetch→summarize cycle; failures retried next run

## 8. Scheduling (capability: fetch-pipeline)

- [ ] 8.1 Configure `pg_cron` to trigger the daily pipeline (~07:00)
- [ ] 8.2 Verify a scheduled run end to end against local/staging Supabase

## 9. Push notifications (capability: push-notifications)

- [ ] 9.1 Register Expo push token on launch; upsert `push_tokens`; handle denial
- [ ] 9.2 Send one daily digest push per user with the new-summary count
- [ ] 9.3 Skip push when nothing is new; prune invalid tokens on send errors
- [ ] 9.4 Handle notification tap → open the Today feed

## 10. App feed & detail (capability: app-feed)

- [ ] 10.1 Build the Today feed (today's `done` summaries, ordered, pull-to-refresh)
- [ ] 10.2 Build the empty state for days with no summaries
- [ ] 10.3 Build the article detail view with "open original" in the system browser
- [ ] 10.4 Confirm the app only reads/writes Supabase (no client-side fetch/LLM)

## 11. Verification & archive

- [ ] 11.1 Run the full test suite; confirm unit + integration tests pass
- [ ] 11.2 Manual real-device check: receive push → open → see today's summaries → open original
- [ ] 11.3 Update README with setup/run/deploy steps and required secrets
- [ ] 11.4 Archive the OpenSpec change (`openspec archive add-daily-digest-mvp`)
