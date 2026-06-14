## Context

Greenfield project. The user wants a personal daily digest that aggregates
user-added sources (Substack/YouTube feeds, Hacker News), summarizes each new
item with an LLM, and delivers a daily push notification. It is a multi-week
learning project: the goal is to learn scheduling, serverless functions, LLM
integration, and mobile push, not just to ship features.

Constraints:
- Few-weeks scope; favor a managed platform over hand-rolled infrastructure.
- The user has a Claude *subscription*, which cannot be called as a programmatic
  API. Backend LLM calls must use a pay-per-token or free-tier API.
- The pipeline runs unattended daily, so it must self-recover and be idempotent.

### Architecture overview

```
Expo RN App  ──read──►  Supabase Postgres  ◄──write── Edge Functions
(Today feed,            (sources, articles,           (fetch, summarize)
 sources, detail,        summaries, push_tokens)            ▲
 push token reg)               ▲                      pg_cron (daily ~07:00)
       ▲                       │                            │
       └──── Expo Push ────────┘                   External: RSS / HN API / Gemini
```

Five components, each with one job:

| Component | Responsibility | Depends on |
|-----------|----------------|-----------|
| App (Expo RN) | Manage sources, view digest, receive push | Supabase JS client, Expo Push |
| Postgres | Store sources, articles, summaries, push tokens | — |
| Fetch Edge Function | Pull feeds, parse, dedup, insert new articles | RSS parser, HN API |
| Summarize Edge Function | Summarize `pending` articles via `summarize()` | Gemini API |
| pg_cron | Trigger the pipeline daily | — |

Fetch and Summarize are deliberately split so a fetch failure never loses
already-summarized content and summaries can be retried in isolation.

### Data model

Five tables (Supabase Auth provides `users`):

- `sources(id, user_id→users, type['rss'|'youtube'|'hackernews'], feed_url, title, is_active, last_error)`
- `articles(id, source_id→sources, guid UNIQUE, title, url, published_at, fetched_at)`
- `summaries(id, article_id→articles UNIQUE, summary_text, model, status['pending'|'done'|'failed'], created_at)`
- `push_tokens(id, user_id→users, expo_token, platform)`

`articles.guid` is unique → dedup; `summaries.status` is the retry state machine.
Row Level Security restricts every table to its owning `user_id`.

### Daily pipeline (data flow)

```
pg_cron(07:00) → Fetch: active sources → parse → dedup by guid → insert new
                        articles + summaries(status='pending')
              → Summarize: take pending (batch ~10) → summarize() → write
                        summary_text/model, status='done'|'failed'
              → Push: count today's new summaries → one Expo push
```

## Goals / Non-Goals

**Goals:**
- Idempotent, unattended fetch → summarize → push pipeline.
- Provider-agnostic LLM access behind a single `summarize()` module.
- Minimal mobile app: Today feed, source management, article detail, push.
- Per-user data isolation via RLS.

**Non-Goals (MVP):**
- Auto-importing real account subscriptions (OAuth/scraping).
- Article categorization/tagging, cross-source topic clustering.
- Read/saved state, full-text search, in-app long-form rendering.
- Whimsy/polish (empty-state copy, animations) — noted as later polish.

## Decisions

- **Supabase as the whole backend** (vs standalone Node worker on Railway/Fly, or
  Cloudflare Workers+D1). Rationale: Postgres + Auth + Edge Functions + `pg_cron`
  in one platform minimizes infra wiring for a few-weeks build, has a free tier,
  and teaches a complete modern BaaS. Trade-off: Edge Function execution-time
  limits, handled by batching (below).
- **Split Fetch and Summarize into two functions** (vs one). Rationale: decoupling
  makes each idempotent and independently retryable; a fetch failure doesn't block
  summaries and vice versa. The `summaries.status` table is the seam.
- **Gemini free tier via a `summarize()` abstraction** (vs Claude API, vs Groq).
  Rationale: the Claude subscription can't be used programmatically; Gemini's free
  tier covers a daily batch of tens of items at $0. The abstraction stores the
  actual `model` per summary and lets us swap to Claude/Groq by editing one module.
- **Manual source addition by feed URL** (vs OAuth subscription import). Rationale:
  most sources expose RSS/Atom (Substack `/feed`, YouTube `feeds/videos.xml`);
  manual add is stable and ships fast. OAuth import is an explicit later upgrade.
- **App is a thin Supabase client** (vs app-side fetching/AI). Rationale: all
  fetching/AI runs server-side on schedule; the app only reads, writes sources,
  and registers a push token. Simpler, battery-friendly, easier to test.
- **Expo (React Native) for the app** with Expo Push for notifications. Rationale:
  one codebase for iOS/Android, fastest path to a working push pipeline.
- **TDD on pure logic first** (RSS parsing, dedup, `summarize()` prompt/result
  handling) with Gemini mocked; integration test runs one fetch→summarize cycle
  against a local Supabase; manual real-device check for the push.

## Risks / Trade-offs

- Edge Function timeout on large batches → process pending in fixed-size batches
  (~10) so the next scheduled run resumes; the pipeline is naturally resumable.
- Gemini free-tier rate limits → batch size + spacing keep within limits; failures
  set status `failed` for next-run retry rather than crashing the batch.
- A broken/slow source feed → wrap per-source fetch in try/catch, record
  `sources.last_error`, skip and continue with other sources.
- Provider lock-in to Gemini → mitigated by the `summarize()` abstraction; model
  name persisted per summary for traceability.
- Duplicate or repeated push on rerun → idempotency via `guid` dedup and `status`
  state machine ensures reruns don't re-summarize or double-notify.
- Secret leakage → Gemini and Supabase service-role keys live only in Edge
  Function env, never in the shipped app bundle.

## Migration Plan

Greenfield deployment, no rollback of existing data:
1. Scaffold Expo app + Supabase project; commit baseline.
2. Apply Postgres schema + RLS via Supabase migrations.
3. Deploy Fetch and Summarize Edge Functions; configure secrets.
4. Schedule the pipeline with `pg_cron`; verify one manual run end to end.
5. Wire app screens + push registration; verify on a real device.
Rollback at any step = revert the migration/function deploy; no user data at risk
during the MVP build.

## Open Questions

- Content source for summarization: prefer RSS-provided summary/full text; for
  Hacker News use title + link, optionally fetch the linked article later. Final
  per-source extraction rules to be refined during implementation.
- Exact daily schedule time and time-zone handling (single-user MVP assumes one
  local timezone; multi-user tz is a later concern).
- Whether Fetch should directly invoke Summarize, or both run as separate
  sequential `pg_cron` steps (leaning sequential cron for simplicity).
