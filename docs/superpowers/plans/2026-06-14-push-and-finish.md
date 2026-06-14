# Push Notifications + Finish (Verify + Archive) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the daily digest push notification end to end — register Expo push tokens in the app, send one daily push per user with the new-summary count, prune invalid tokens — plus the deferred magic-link deep-link handler, and finish the MVP (README + manual verification checklist + OpenSpec archive).

**Architecture:** Pure, injected-dependency notify logic in `src/pipeline/notify.ts` (message text, token pruning, send orchestration, chunking) is Vitest-tested with fakes. A thin Deno `notify` Edge Function wires the real Supabase service-role adapter + an Expo push sender and is scheduled by `pg_cron` after the summarize step. App-side push registration (expo-notifications) and the magic-link deep-link handler are RN, verified manually. This is Plan D of 4 (A/B/C done).

**Tech Stack:** TypeScript, Vitest, Deno (Supabase Edge Function), Expo Push API, expo-notifications, expo-linking, pg_cron.

**Spec:** `openspec/changes/add-daily-digest-mvp/specs/push-notifications/spec.md` (+ the `auth` magic-link completion).

**Prereqs from A/B/C:** the pipeline (`src/pipeline/`), the `push_tokens` table + RLS, the Supabase service-role adapter (`supabase/functions/_shared/db.ts`), and the Expo app (`app/`, `src/client/`).

---

## File Structure

```
src/pipeline/notify.ts            # buildDigestMessage, chunk, tokensToPrune, runNotify   (TDD)
src/pipeline/notify-types.ts      # UserDigest, PushTokenRow, ExpoPushMessage/Ticket, NotifyDb, PushSender, NotifyDeps
test/pipeline/notify.test.ts
supabase/migrations/0005_notify.sql   # user_digests_today() RPC + notify cron schedule
supabase/functions/_shared/notify-db.ts  # NotifyDb adapter (service-role) + createExpoPushSender
supabase/functions/notify/index.ts       # Deno entry: build deps -> runNotify
src/client/push.ts                # registerPushToken() (RN; expo-notifications) — excluded from Node tsconfig
app/_layout.tsx                   # MODIFY: register push on session; magic-link deep-link handler; notification-tap routing
```

Tasks 1–3 are pure TDD. Tasks 4–5 are Deno/SQL (static review; live-verified by the user). Tasks 6–7 are RN (manual). Task 8 finishes the project.

---

## Task 1: Notify message + chunk helpers (TDD)

**Files:**
- Create: `src/pipeline/notify-types.ts`, `src/pipeline/notify.ts`
- Test: `test/pipeline/notify.test.ts`

- [ ] **Step 1: Create the types — `src/pipeline/notify-types.ts`**

```ts
export interface UserDigest {
  userId: string;
  newCount: number;
}

export interface PushTokenRow {
  id: string;
  expoToken: string;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  details?: { error?: string };
}

export type PushSender = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

export interface NotifyDb {
  /** Users with at least one summary that became 'done' today, with the count. */
  listUserDigests(): Promise<UserDigest[]>;
  listPushTokens(userId: string): Promise<PushTokenRow[]>;
  deletePushTokens(ids: string[]): Promise<void>;
}

export interface NotifyDeps {
  db: NotifyDb;
  send: PushSender;
}
```

- [ ] **Step 2: Write the failing test — `test/pipeline/notify.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildDigestMessage, chunk } from '../../src/pipeline/notify';

describe('buildDigestMessage', () => {
  it('uses the singular for one summary', () => {
    expect(buildDigestMessage(1)).toEqual({ title: 'AI Daily Digest', body: '1 new summary ready' });
  });
  it('uses the plural for many', () => {
    expect(buildDigestMessage(12)).toEqual({ title: 'AI Daily Digest', body: '12 new summaries ready' });
  });
});

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns an empty array for empty input', () => {
    expect(chunk([], 100)).toEqual([]);
  });
  it('keeps everything in one group when smaller than the size', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- notify`
Expected: FAIL — cannot find module `../../src/pipeline/notify`.

- [ ] **Step 4: Implement — `src/pipeline/notify.ts`** (helpers only for this task)

```ts
export function buildDigestMessage(count: number): { title: string; body: string } {
  const noun = count === 1 ? 'summary' : 'summaries';
  return { title: 'AI Daily Digest', body: `${count} new ${noun} ready` };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- notify`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/notify-types.ts src/pipeline/notify.ts test/pipeline/notify.test.ts
git commit -m "feat: digest notification message and chunk helper"
```

---

## Task 2: Token pruning from push tickets (TDD)

**Files:**
- Modify: `src/pipeline/notify.ts` (add `tokensToPrune`)
- Test: `test/pipeline/notify.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `test/pipeline/notify.test.ts`**

Add `tokensToPrune` to the import line, then append:
```ts
import type { ExpoPushTicket, PushTokenRow } from '../../src/pipeline/notify-types';

describe('tokensToPrune', () => {
  const tokens: PushTokenRow[] = [
    { id: 't1', expoToken: 'a' },
    { id: 't2', expoToken: 'b' },
    { id: 't3', expoToken: 'c' },
  ];

  it('returns ids of tokens whose ticket reports DeviceNotRegistered', () => {
    const tickets: ExpoPushTicket[] = [
      { status: 'ok', id: 'x' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ];
    expect(tokensToPrune(tickets, tokens)).toEqual(['t2']);
  });

  it('returns nothing when all succeed', () => {
    const tickets: ExpoPushTicket[] = [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }];
    expect(tokensToPrune(tickets, tokens)).toEqual([]);
  });

  it('ignores tickets beyond the token list length', () => {
    const tickets: ExpoPushTicket[] = [{ status: 'error', details: { error: 'DeviceNotRegistered' } }];
    expect(tokensToPrune(tickets, tokens)).toEqual(['t1']);
  });
});
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- notify`
Expected: FAIL — `tokensToPrune` is not exported.

- [ ] **Step 3: Implement `tokensToPrune` in `src/pipeline/notify.ts`**

Add the import at the top and the function:
```ts
import type { ExpoPushTicket, PushTokenRow } from './notify-types';

export function tokensToPrune(tickets: ExpoPushTicket[], tokens: PushTokenRow[]): string[] {
  const n = Math.min(tickets.length, tokens.length);
  const prune: string[] = [];
  for (let i = 0; i < n; i++) {
    if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered') {
      prune.push(tokens[i].id);
    }
  }
  return prune;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- notify`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/notify.ts test/pipeline/notify.test.ts
git commit -m "feat: identify invalid push tokens to prune from Expo tickets"
```

---

## Task 3: Notify orchestration (TDD)

**Files:**
- Modify: `src/pipeline/notify.ts` (add `runNotify`)
- Test: `test/pipeline/notify.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `test/pipeline/notify.test.ts`**

Add `runNotify` to the import line and `ExpoPushMessage, NotifyDb, UserDigest` to the type import, then append:
```ts
import type { ExpoPushMessage, NotifyDb, UserDigest } from '../../src/pipeline/notify-types';

function makeDb(digests: UserDigest[], tokensByUser: Record<string, PushTokenRow[]>) {
  const deleted: string[] = [];
  const db: NotifyDb = {
    listUserDigests: async () => digests,
    listPushTokens: async (userId) => tokensByUser[userId] ?? [],
    deletePushTokens: async (ids) => { deleted.push(...ids); },
  };
  return { db, deleted };
}

describe('runNotify', () => {
  it('sends one message per token with the digest body and counts sends', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 3 }], { u1: [{ id: 't1', expoToken: 'a' }, { id: 't2', expoToken: 'b' }] });
    const sent: ExpoPushMessage[] = [];
    const send = async (msgs: ExpoPushMessage[]) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(sent).toEqual([
      { to: 'a', title: 'AI Daily Digest', body: '3 new summaries ready' },
      { to: 'b', title: 'AI Daily Digest', body: '3 new summaries ready' },
    ]);
    expect(res).toEqual({ sent: 2, pruned: 0 });
  });

  it('skips a user with no tokens and does not send', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 5 }], { u1: [] });
    let calls = 0;
    const send = async (msgs: ExpoPushMessage[]) => { calls++; return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(calls).toBe(0);
    expect(res).toEqual({ sent: 0, pruned: 0 });
  });

  it('does not send when newCount is zero', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 0 }], { u1: [{ id: 't1', expoToken: 'a' }] });
    let calls = 0;
    const send = async (msgs: ExpoPushMessage[]) => { calls++; return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(calls).toBe(0);
    expect(res).toEqual({ sent: 0, pruned: 0 });
  });

  it('prunes tokens reported DeviceNotRegistered', async () => {
    const { db, deleted } = makeDb([{ userId: 'u1', newCount: 1 }], { u1: [{ id: 't1', expoToken: 'a' }, { id: 't2', expoToken: 'b' }] });
    const send = async (_msgs: ExpoPushMessage[]) => [
      { status: 'ok' as const },
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
    ];
    const res = await runNotify({ db, send });
    expect(deleted).toEqual(['t2']);
    expect(res).toEqual({ sent: 2, pruned: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify the new cases fail**

Run: `npm test -- notify`
Expected: FAIL — `runNotify` is not exported.

- [ ] **Step 3: Implement `runNotify` in `src/pipeline/notify.ts`**

Add `NotifyDeps` to the type import and append:
```ts
import type { NotifyDeps } from './notify-types';

const EXPO_PUSH_BATCH = 100; // Expo accepts up to 100 messages per request

export async function runNotify(deps: NotifyDeps): Promise<{ sent: number; pruned: number }> {
  const digests = await deps.db.listUserDigests();
  let sent = 0;
  let pruned = 0;
  for (const digest of digests) {
    if (digest.newCount <= 0) continue;
    const tokens = await deps.db.listPushTokens(digest.userId);
    if (tokens.length === 0) continue;
    const message = buildDigestMessage(digest.newCount);
    const pruneIds: string[] = [];
    for (const group of chunk(tokens, EXPO_PUSH_BATCH)) {
      const messages = group.map((t) => ({ to: t.expoToken, title: message.title, body: message.body }));
      const tickets = await deps.send(messages);
      sent += messages.length;
      pruneIds.push(...tokensToPrune(tickets, group));
    }
    if (pruneIds.length > 0) {
      await deps.db.deletePushTokens(pruneIds);
      pruned += pruneIds.length;
    }
  }
  return { sent, pruned };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- notify`
Expected: PASS (12 tests).

- [ ] **Step 5: Run FULL suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/notify.ts test/pipeline/notify.test.ts
git commit -m "feat: notify orchestration — send daily digest and prune dead tokens"
```

---

## Task 4: SQL — user digests RPC + notify cron (static)

**Files:**
- Create: `supabase/migrations/0005_notify.sql`

- [ ] **Step 1: Create the migration — `supabase/migrations/0005_notify.sql`**

```sql
-- Count summaries that became 'done' today, grouped by the owning user.
create or replace function user_digests_today()
returns table (user_id uuid, new_count bigint)
language sql stable as $$
  select s.user_id, count(*) as new_count
    from summaries sm
    join articles a on a.id = sm.article_id
    join sources  s on s.id = a.source_id
   where sm.status = 'done'
     and sm.updated_at >= date_trunc('day', now())
   group by s.user_id;
$$;

-- Send the daily digest at 07:10 UTC, after fetch (07:00) and summarize (07:05).
select cron.schedule(
  'daily-notify', '10 7 * * *',
  $$ select net.http_post(
       url := current_setting('app.functions_base_url') || '/notify',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
     ); $$
);
```

(The `app.functions_base_url` / `app.service_role_key` settings are the same ones documented in `0004_cron.sql`.)

- [ ] **Step 2: Static sanity check + commit**

Confirm the join chain (summaries→articles→sources.user_id) matches the schema; `new_count` is `bigint` (count). `npm test && npm run typecheck` unaffected.

```bash
git add supabase/migrations/0005_notify.sql
git commit -m "feat: user_digests_today RPC and daily notify cron schedule"
```

---

## Task 5: Deno notify adapter + Expo sender + Edge Function (static)

**Files:**
- Create: `supabase/functions/_shared/notify-db.ts`, `supabase/functions/notify/index.ts`

- [ ] **Step 1: Create the adapter + sender — `supabase/functions/_shared/notify-db.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type {
  ExpoPushMessage, ExpoPushTicket, NotifyDb, PushSender, PushTokenRow, UserDigest,
} from '../../../src/pipeline/notify-types.ts';

export function createNotifyDb(url: string, serviceRoleKey: string): NotifyDb {
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async listUserDigests(): Promise<UserDigest[]> {
      const { data, error } = await sb.rpc('user_digests_today');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ userId: r.user_id, newCount: Number(r.new_count) }));
    },
    async listPushTokens(userId: string): Promise<PushTokenRow[]> {
      const { data, error } = await sb.from('push_tokens').select('id, expo_token').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, expoToken: r.expo_token }));
    },
    async deletePushTokens(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const { error } = await sb.from('push_tokens').delete().in('id', ids);
      if (error) throw error;
    },
  };
}

/** Sends a batch (<=100) to the Expo push API and returns tickets in the same order. */
export function createExpoPushSender(): PushSender {
  return async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
    const json = await res.json();
    return (json.data ?? []) as ExpoPushTicket[];
  };
}
```

- [ ] **Step 2: Create the Edge Function — `supabase/functions/notify/index.ts`**

```ts
import { createNotifyDb, createExpoPushSender } from '../_shared/notify-db.ts';
import { runNotify } from '../../../src/pipeline/notify.ts';

Deno.serve(async () => {
  const db = createNotifyDb(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await runNotify({ db, send: createExpoPushSender() });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
```

- [ ] **Step 3: Static sanity check + commit**

Verify: `NotifyDb` methods match `src/pipeline/notify-types.ts`; columns `id`, `expo_token`, `user_id` match the `push_tokens` schema; the RPC name `user_digests_today` matches Task 4; the Expo sender returns `json.data` tickets in order; env var names match the other functions. `npm test && npm run typecheck` unaffected (supabase/** excluded from Node tsconfig).

```bash
git add supabase/functions/_shared/notify-db.ts supabase/functions/notify/index.ts
git commit -m "feat: Deno notify Edge Function with Supabase adapter and Expo sender"
```

---

## Task 6: App push registration (RN; manual-verified)

**Files:**
- Create: `src/client/push.ts`
- Modify: `app/_layout.tsx` (register on session), `tsconfig.json` (exclude push.ts), `package.json` (deps)

- [ ] **Step 1: Install the Expo notification deps**

Run: `npx expo install expo-notifications expo-device`

- [ ] **Step 2: Create `src/client/push.ts`**

```ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/** Request permission, get the Expo push token, and upsert it for the current user.
 *  No-op on simulators or when permission is denied. */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return;
  await supabase.from('push_tokens').upsert(
    { user_id: userId, expo_token: token, platform: Platform.OS },
    { onConflict: 'user_id,expo_token' },
  );
}
```

- [ ] **Step 3: Exclude `src/client/push.ts` from the Node tsconfig**

Add `"src/client/push.ts"` to the `exclude` array in `tsconfig.json` (alongside `supabase.ts` and `data.ts`), since it imports RN-only modules. Ensure no Vitest test imports it.

- [ ] **Step 4: Register on sign-in + handle notification taps — modify `app/_layout.tsx`**

In the existing layout, after a session is established, call `registerPushToken()`, and add a notification-response listener that routes to the feed. Add these imports and effects to `app/_layout.tsx`:
```tsx
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../src/client/push';
```
Inside the component, add:
```tsx
  useEffect(() => {
    if (session) registerPushToken().catch(() => {});
  }, [session]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.replace('/');
    });
    return () => sub.remove();
  }, [router]);
```

- [ ] **Step 5: Verify + commit**

Run: `npm test && npm run typecheck` (still green; push.ts excluded, app/ not typechecked by Node).
```bash
git add src/client/push.ts app/_layout.tsx tsconfig.json package.json package-lock.json
git commit -m "feat: register Expo push token on sign-in and route notification taps to the feed"
```

**Manual verification (deferred):** on a real device, granting permission stores a `push_tokens` row; denying it is a no-op; tapping a digest notification opens the Today feed.

---

## Task 7: Magic-link deep-link handler (RN; manual-verified)

**Files:**
- Modify: `app/_layout.tsx`

This completes the `auth` "complete sign-in from the link" scenario deferred from Plan C.

- [ ] **Step 1: Add a deep-link handler to `app/_layout.tsx`**

Add the import:
```tsx
import * as Linking from 'expo-linking';
```
Add an effect that handles both the cold-start URL and live URL events, exchanging the auth code for a session:
```tsx
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return;
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === 'string') {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
    }
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
```

- [ ] **Step 2: Verify + commit**

Run: `npm test && npm run typecheck` (unaffected; app/ not Node-typechecked).
```bash
git add app/_layout.tsx
git commit -m "feat: handle magic-link deep link by exchanging the code for a session"
```

**Manual verification (deferred):** with `aidailydigest://**` allowed in Supabase Auth redirect URLs, tapping the emailed magic link opens the app and establishes a session (lands on the feed). Note: this assumes the PKCE flow (Supabase default) returning a `code` param; if your project uses a different flow, adjust accordingly.

---

## Task 8: README + manual verification checklist + archive (docs)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document push + the full end-to-end manual check in `README.md`**

Add a "Push notifications" note (the `notify` Edge Function + the `daily-notify` cron; that registration happens on sign-in) and extend the manual verification checklist with: on a real device, sign in → grant notifications → confirm a `push_tokens` row → run the full pipeline (fetch → summarize → notify) → receive the digest push → tap it → land on the Today feed. Note that simulators don't receive Expo push.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: push notification setup and full end-to-end verification checklist"
```

- [ ] **Step 3: Archive the OpenSpec change (run after this branch is merged to main)**

After Plan D is merged to `main`, run:
```bash
openspec archive add-daily-digest-mvp
openspec validate --strict
```
This moves the validated capabilities into `openspec/specs/` as the project's source of truth and marks the change complete. (Run this from `main` once all four plans are merged. It is a documentation/spec-state operation, independent of the deferred live verification.)

---

## Definition of Done (Plan D)

- `npm test` passes: all feed + pipeline (incl. notify) + client tests green.
- `npm run typecheck` clean (`src/client/push.ts` excluded alongside supabase.ts/data.ts; `supabase/**` and `app/**` outside the Node tsconfig).
- The notify pure logic (message, prune, chunk, orchestration) is unit-tested; the Deno notify function, RPC, and cron are committed and statically reviewed.
- App registers push tokens on sign-in, routes notification taps to the feed, and handles the magic-link deep link.
- README documents push setup and the full end-to-end manual verification; the OpenSpec archive step is documented to run post-merge.

This completes the MVP: **fetch → summarize → push → read**, spec-driven from OpenSpec through four TDD-built, reviewed plans.
