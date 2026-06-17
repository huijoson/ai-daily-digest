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

✅ MVP code-complete (all four plans built, reviewed, and merged):

- ✅ Plan A — feed-parsing core + Postgres schema/RLS
- ✅ Plan B — ingestion pipeline (fetch + Gemini summarize + pg_cron)
- ✅ Plan C — mobile app (auth, sources, Today feed, article detail)
- ✅ Plan D — push notifications + end-to-end verification + archive

The OpenSpec change is archived; the six capabilities now live in `openspec/specs/`. Live verification is manual: Docker for the DB/pipeline (`supabase start`), a real physical device for the app and push (simulators do not receive Expo push notifications).

Automated tests cover the pure logic; live DB/pipeline/app steps are verified manually (see below and the Plan B/C docs).

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

### Installing on iOS

The app is configured as an Expo managed iOS app with bundle identifier
`com.yuhan.aidailydigest` in `app.json`.

For quick testing, use Expo Go:

```bash
npm start
# then press i for the iOS simulator, or scan the QR code from Expo Go
```

To create an installable iOS build, use EAS:

```bash
npx eas-cli login
npx eas-cli init
npm run build:ios:simulator # install on an iOS simulator
npm run build:ios:preview   # install on registered physical devices
```

Physical-device installs require an Apple Developer account. EAS will guide you
through creating or selecting the Apple signing credentials and registering test
devices for the `preview` profile. For App Store/TestFlight distribution, run:

```bash
npm run build:ios:production
npx eas-cli submit --platform ios --profile production
```

If you change Apple teams or publish under a different organization, update
`expo.ios.bundleIdentifier` before creating credentials.

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

### Push notifications

The app registers an Expo push token with the backend immediately after sign-in (`src/client/push.ts`). If the user denies notification permission the registration is silently skipped — the rest of the app is unaffected. Push cannot be tested on a simulator; a physical device is required.

Server-side, the `notify` Edge Function sends one digest push per user that has new summaries since their last notification. It calls the Expo push API in batches and prunes any tokens that Expo reports as invalid. The function is scheduled by a `pg_cron` job named `daily-notify` at **07:10 UTC** (after `daily-fetch` at 07:00 and `daily-summarize` at 07:05).

The `notify` function requires the same database settings as the other cron-triggered functions — `app.functions_base_url` and `app.service_role_key` — which are documented in `supabase/migrations/0004_cron.sql`.

### Manual verification checklist

Run once Supabase and a device/simulator are ready.

1. **Sign in:** launch (`npm start`), enter an email on the sign-in screen, receive the magic link, open it, and confirm the app establishes a session and lands on the Today feed. Restart the app and confirm the session persists (no sign-in flash).
2. **Add a source:** open Sources (header link), paste a real RSS/YouTube/Substack feed URL and confirm it validates and appears; paste a bad URL and confirm a clear error; toggle a source off (pauses it) and delete one.
3. **Summaries:** run the Plan B pipeline (`supabase functions` fetch then summarize) to produce summaries, then pull-to-refresh the Today feed and confirm summaries appear; an empty day should show the empty state.
4. **Open article:** open an article from the feed, tap "Open original", and confirm the system browser opens the URL.
5. **Sign out:** tap sign-out from the Today header and confirm it returns to the sign-in screen.

**End-to-end push flow (physical device only — simulators will not receive Expo push):**

6. **Token registration:** on a physical device, sign in and grant notification permission when prompted. Open the Supabase dashboard (or run `psql`) and confirm a row exists in `push_tokens` for your user.
7. **Full pipeline:** invoke the three Edge Functions in order — `daily-fetch`, `daily-summarize`, `daily-notify` — either via `supabase functions invoke` or by waiting for the 07:00/07:05/07:10 UTC cron windows. Confirm each function returns a success response.
8. **Receive push:** confirm the daily digest notification arrives on the device.
9. **Deep link:** tap the notification and confirm the app opens and navigates to the Today feed.

> The DB/pipeline live steps (`supabase start`, `db reset`, `functions serve`, `GEMINI_API_KEY`, the `ALTER DATABASE` cron settings) are documented in the Plan B plan and migration comments.

## OpenSpec archive

Once all four plans are merged to `main` and the build is satisfactory, finalize the OpenSpec change:

```bash
openspec archive add-daily-digest-mvp
openspec validate --strict
```

This moves the validated capabilities into `openspec/specs/` as the permanent source of truth for the project.
