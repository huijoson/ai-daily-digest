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
