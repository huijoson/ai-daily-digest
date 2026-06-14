# AI Personal Daily Digest

A personal daily digest app. It aggregates content from user-added sources
(Substack publications, YouTube channels, Hacker News), summarizes each new item
with an LLM, and pushes a single daily notification with the day's highlights.

A multi-week learning project covering scheduling, serverless functions, LLM
integration, and mobile push — end to end.

## Stack

- **App:** Expo (React Native, TypeScript) — a thin Supabase client
- **Backend:** Supabase (Postgres, Auth, Edge Functions, `pg_cron`)
- **LLM:** Gemini (free tier) behind a provider-agnostic `summarize()` module
- **Push:** Expo Push Notifications

## How it works

```
pg_cron (daily) → Fetch (parse feeds, dedup by guid) → Summarize (batch, LLM)
                → Push (one daily digest). The app only reads the results.
```

## Spec-driven development

Requirements and design live as an [OpenSpec](https://github.com/Fission-AI/OpenSpec)
change under `openspec/changes/`. Implementation is then carried out test-first.

```bash
openspec view                       # dashboard of specs & changes
openspec show add-daily-digest-mvp  # this change's proposal/design/specs/tasks
openspec validate --strict          # validate the spec
```

## Status

🚧 Spec approved; implementation not started.

## Mobile app

### Prerequisites

- Node.js
- Expo CLI (via `npx expo` — no separate global install needed)
- [Expo Go](https://expo.dev/go) on a physical device, or an iOS/Android simulator

### Environment

Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_SUPABASE_URL=<your Supabase project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
```

Use the **anon key** — not the service-role key.

### Running

```bash
npm start
# then press i (iOS simulator), a (Android simulator),
# or scan the QR code with Expo Go
```

### Architecture notes

- Pure client logic lives in `src/client/` and is Vitest-tested.
- React Native screens live in `app/` (expo-router).
- The Supabase client and data layer (`src/client/supabase.ts`, `src/client/data.ts`) import RN-only modules and are excluded from the Node typecheck — they are verified manually instead.
- `npm test` covers the pure logic; screens are exercised through the manual checklist below.

### Supabase Auth configuration (required for sign-in)

Magic-link sign-in requires one-time configuration in the Supabase dashboard:

1. Go to **Authentication → URL Configuration** and add the app's deep-link scheme to the allowed redirect URLs:
   ```
   aidailydigest://**
   ```
   (The app scheme is `aidailydigest`, defined in `app.json`.)

2. **Known consideration:** clicking a magic link must deep-link back into the app and establish a session. With `detectSessionInUrl: false` (required for React Native), the app needs a deep-link handler that exchanges the incoming URL's code/token for a session via `supabase.auth.exchangeCodeForSession(url)`. This is configuration- and flow-dependent (PKCE vs implicit) and was deferred from the automated build — **verify this first during live testing.**

### Manual verification checklist

Run once Supabase and a device/simulator are ready.

1. **Sign in:** launch (`npm start`), enter an email on the sign-in screen, receive the magic link, open it, and confirm the app establishes a session and lands on the Today feed. Restart the app and confirm the session persists (no sign-in flash).
2. **Add a source:** open Sources (header link), paste a real RSS/YouTube/Substack feed URL and confirm it validates and appears; paste a bad URL and confirm a clear error; toggle a source off (pauses it) and delete one.
3. **Summaries:** run the Plan B pipeline (`supabase functions` fetch then summarize) to produce summaries, then pull-to-refresh the Today feed and confirm summaries appear; an empty day should show the empty state.
4. **Open article:** open an article from the feed, tap "Open original", and confirm the system browser opens the URL.
5. **Sign out:** tap sign-out from the Today header and confirm it returns to the sign-in screen.

> The DB/pipeline live steps (`supabase start`, `db reset`, `functions serve`, `GEMINI_API_KEY`, the `ALTER DATABASE` cron settings) are documented in the Plan B plan and migration comments.
