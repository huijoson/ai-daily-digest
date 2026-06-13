# Mobile App (Auth + Sources + Feed) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo (React Native) app: magic-link sign-in, source management (add/validate/toggle/remove + Hacker News), a Today feed of completed summaries, and an article detail view — reading the data the Plan B pipeline produces.

**Architecture:** Framework-free, Vitest-tested pure logic lives in `src/client/` (source validation, row→view mappers, time formatting, email validation) plus a small `src/feed/meta.ts` title extractor. The Expo app at the repo root (expo-router) imports that pure core and Supabase. Per the agreed structure, RN screens are built and verified manually in Expo (deferred, like the Docker-gated DB checks); only the pure logic is unit-tested. This is Plan C of 4 (A & B done: feed core, schema, ingestion pipeline; D: push + verification).

**Tech Stack:** Expo (React Native, expo-router, TypeScript), @supabase/supabase-js, @react-native-async-storage/async-storage, Vitest (pure-logic tests).

**Spec:** `openspec/changes/add-daily-digest-mvp/specs/{auth,source-management,app-feed}/spec.md`.

**Prereqs from A/B:** `src/feed/` (`parseRssFeed`, `detectSourceType`, types) and the Supabase schema/RLS. The app uses the Supabase **anon** key (RLS scopes every read to the signed-in user); the service-role key is never in the app.

---

## File Structure

```
package.json                      # MODIFIED: drop "type":"module"; add Expo deps + scripts
app.json                          # Expo config
babel.config.js                   # babel-preset-expo (CJS — needs non-module package.json)
metro.config.js                   # default Expo metro
.env.example                      # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
app/_layout.tsx                   # root layout + auth gate (session-aware routing)
app/sign-in.tsx                   # magic-link sign-in screen
app/index.tsx                     # Today feed
app/sources.tsx                   # source management
app/article/[id].tsx              # article detail
src/feed/meta.ts                  # extractFeedTitle(xml) -> string | null   (TDD)
src/client/types.ts               # FeedItem, SourceListItem, PreparedSource
src/client/validation.ts          # isValidEmail(s)                          (TDD)
src/client/sources.ts             # prepareSource(url, httpGet), mapSourceRow (TDD) + thin DB ops
src/client/feed.ts                # formatRelativeTime(iso, now), mapFeedRow  (TDD) + thin DB ops
src/client/supabase.ts            # supabase client factory (thin)
test/feed/meta.test.ts
test/client/validation.test.ts
test/client/sources.test.ts
test/client/feed.test.ts
```

`src/client/*` and `src/feed/meta.ts` are framework-free (no React/RN imports) so they run under the existing Vitest. Screens import them. Tasks 2–5 are pure TDD; Tasks 1, 6–10 are Expo/RN, verified manually.

---

## Task 1: Expo scaffold coexisting with Vitest

**Files:**
- Modify: `package.json`
- Create: `app.json`, `babel.config.js`, `metro.config.js`, `.env.example`, `app/_layout.tsx` (placeholder), `app/index.tsx` (placeholder)

- [ ] **Step 1: Drop `"type": "module"` from `package.json`**

Remove the `"type": "module"` line. Rationale: Expo's `babel.config.js`/`metro.config.js` use CommonJS `module.exports`; with `"type":"module"` Node would parse them as ESM and fail. Vitest (via esbuild) and `tsc` (module: ESNext) handle the TypeScript ESM in `src/` regardless of this field, so removing it is safe.

- [ ] **Step 2: Verify the existing suite still passes after the change**

Run: `npm test`
Expected: 32 tests still pass (the field removal must not break Vitest).

- [ ] **Step 3: Install Expo + router + Supabase deps**

Run:
```bash
npx expo install expo expo-router react react-native react-dom react-native-web \
  @react-native-async-storage/async-storage @supabase/supabase-js \
  expo-linking expo-constants expo-status-bar react-native-safe-area-context react-native-screens
```
`expo install` resolves Expo-compatible versions automatically. (If `npx expo` prompts to install the CLI, accept.)

- [ ] **Step 4: Create `app.json`**

```json
{
  "expo": {
    "name": "AI Daily Digest",
    "slug": "ai-daily-digest",
    "scheme": "aidailydigest",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "plugins": ["expo-router"],
    "ios": { "supportsTablet": true },
    "android": {}
  }
}
```

- [ ] **Step 5: Create `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
```

- [ ] **Step 6: Create `metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
```

- [ ] **Step 7: Add Expo scripts + entry to `package.json`**

Add to `scripts`: `"start": "expo start"`, `"ios": "expo start --ios"`, `"android": "expo start --android"`. Add `"main": "expo-router/entry"`. Keep `test`, `test:watch`, `typecheck` unchanged.

- [ ] **Step 8: Create `.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

- [ ] **Step 9: Create placeholder screens so the router boots**

`app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';
export default function RootLayout() {
  return <Stack />;
}
```

`app/index.tsx`:
```tsx
import { Text, View } from 'react-native';
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>AI Daily Digest</Text>
    </View>
  );
}
```

- [ ] **Step 10: Confirm tests + typecheck unaffected, then commit**

Run: `npm test && npm run typecheck`
Expected: 32 tests pass; typecheck clean. (Note: `tsconfig.json` `include` is `["src","test"]`, so RN screens under `app/` are not Node-typechecked — Expo typechecks them via its own tooling. Do NOT add `app/` to the Node tsconfig.)

```bash
git add package.json package-lock.json app.json babel.config.js metro.config.js .env.example app/
git commit -m "chore: scaffold Expo app (expo-router) coexisting with Vitest"
```

**Note for the controller:** Live verification (the app actually booting in Expo) is deferred to the user, like the Docker-gated checks — `npm test`/`typecheck` are the automated gates here.

---

## Task 2: Extract feed title (TDD)

**Files:**
- Create: `src/feed/meta.ts`
- Test: `test/feed/meta.test.ts`

- [ ] **Step 1: Write the failing test — `test/feed/meta.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { extractFeedTitle } from '../../src/feed/meta';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Lenny's Newsletter</title>
  <item><title>x</title></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>My YT Channel</title>
  <entry><title>v</title></entry>
</feed>`;

describe('extractFeedTitle', () => {
  it('reads the RSS channel title', () => {
    expect(extractFeedTitle(RSS)).toBe("Lenny's Newsletter");
  });
  it('reads the Atom feed title', () => {
    expect(extractFeedTitle(ATOM)).toBe('My YT Channel');
  });
  it('returns null when there is no title or the doc is unrecognized', () => {
    expect(extractFeedTitle('<rss version="2.0"><channel></channel></rss>')).toBe(null);
    expect(extractFeedTitle('<html></html>')).toBe(null);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- meta`
Expected: FAIL — cannot find module `../../src/feed/meta`.

- [ ] **Step 3: Implement — `src/feed/meta.ts`**

```ts
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true });

function titleText(node: unknown): string | null {
  if (typeof node === 'string' && node.trim().length > 0) return node.trim();
  if (node && typeof node === 'object' && '#text' in (node as any)) {
    const t = (node as any)['#text'];
    if (typeof t === 'string' && t.trim().length > 0) return t.trim();
  }
  return null;
}

export function extractFeedTitle(xml: string): string | null {
  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  if (doc?.rss?.channel) return titleText(doc.rss.channel.title);
  if (doc?.feed) return titleText(doc.feed.title);
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- meta`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/feed/meta.ts test/feed/meta.test.ts
git commit -m "feat: extract the feed/channel title from RSS and Atom"
```

---

## Task 3: Email validation (TDD)

**Files:**
- Create: `src/client/validation.ts`
- Test: `test/client/validation.test.ts`

- [ ] **Step 1: Write the failing test — `test/client/validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../../src/client/validation';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('first.last@sub.example.co')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('a@')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmail('  a@b.com  ')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- validation`
Expected: FAIL — cannot find module `validation`.

- [ ] **Step 3: Implement — `src/client/validation.ts`**

```ts
// Intentionally simple: a pragmatic check, not full RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- validation`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/validation.ts test/client/validation.test.ts
git commit -m "feat: pragmatic email validation for sign-in"
```

---

## Task 4: Source preparation + row mapping (TDD)

**Files:**
- Create: `src/client/types.ts`, `src/client/sources.ts`
- Test: `test/client/sources.test.ts`

- [ ] **Step 1: Create view types — `src/client/types.ts`**

```ts
import type { SourceType } from '../feed/types';

export interface PreparedSource {
  type: SourceType;
  feedUrl: string | null;
  title: string;
}

export interface SourceListItem {
  id: string;
  type: SourceType;
  title: string;
  isActive: boolean;
  lastError: string | null;
}

export interface FeedItem {
  articleId: string;
  title: string;
  url: string;
  summary: string;
  sourceTitle: string;
  publishedAt: string | null;
}
```

- [ ] **Step 2: Write the failing test — `test/client/sources.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { prepareSource, mapSourceRow } from '../../src/client/sources';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Lenny's Newsletter</title>
  <item><title>x</title><link>u</link><guid>g</guid></item>
</channel></rss>`;

describe('prepareSource', () => {
  it('validates an rss feed, detects type, and derives the title', async () => {
    const httpGet = async (url: string) => { expect(url).toBe('https://lenny.substack.com/feed'); return RSS; };
    const out = await prepareSource('https://lenny.substack.com/feed', httpGet);
    expect(out).toEqual({ type: 'rss', feedUrl: 'https://lenny.substack.com/feed', title: "Lenny's Newsletter" });
  });

  it('falls back to the hostname when the feed has no title', async () => {
    const noTitle = '<rss version="2.0"><channel><item><guid>g</guid></item></channel></rss>';
    const out = await prepareSource('https://blog.example.com/rss', async () => noTitle);
    expect(out.title).toBe('blog.example.com');
  });

  it('detects youtube and still validates the feed', async () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Chan</title><entry><id>i</id></entry></feed>`;
    const out = await prepareSource('https://www.youtube.com/feeds/videos.xml?channel_id=X', async () => atom);
    expect(out.type).toBe('youtube');
    expect(out.title).toBe('Chan');
  });

  it('prepares Hacker News without fetching', async () => {
    let called = false;
    const out = await prepareSource('https://news.ycombinator.com/rss', async () => { called = true; return ''; });
    expect(out).toEqual({ type: 'hackernews', feedUrl: null, title: 'Hacker News' });
    expect(called).toBe(false);
  });

  it('throws when the feed cannot be parsed', async () => {
    await expect(prepareSource('https://x.com/feed', async () => '<html></html>')).rejects.toThrow();
  });

  it('throws on an invalid URL', async () => {
    await expect(prepareSource('not a url', async () => RSS)).rejects.toThrow();
  });
});

describe('mapSourceRow', () => {
  it('maps a DB row to a SourceListItem', () => {
    const row = { id: 's1', type: 'rss', title: 'T', is_active: true, last_error: null };
    expect(mapSourceRow(row)).toEqual({ id: 's1', type: 'rss', title: 'T', isActive: true, lastError: null });
  });
  it('falls back to an empty title and preserves last_error', () => {
    const row = { id: 's2', type: 'hackernews', title: null, is_active: false, last_error: 'boom' };
    expect(mapSourceRow(row)).toEqual({ id: 's2', type: 'hackernews', title: '', isActive: false, lastError: 'boom' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- client/sources`
Expected: FAIL — cannot find module `sources`.

- [ ] **Step 4: Implement — `src/client/sources.ts`**

```ts
import { detectSourceType } from '../feed/detect';
import { parseRssFeed } from '../feed/rss';
import { extractFeedTitle } from '../feed/meta';
import type { HttpGet } from '../pipeline/types';
import type { PreparedSource, SourceListItem } from './types';

/** Validate a pasted feed URL and derive its type + title. Throws if the URL is
 *  invalid or the feed is unreachable/unparseable. `httpGet` is injected for testing. */
export async function prepareSource(url: string, httpGet: HttpGet): Promise<PreparedSource> {
  const type = detectSourceType(url); // throws on an invalid URL
  if (type === 'hackernews') {
    return { type, feedUrl: null, title: 'Hacker News' };
  }
  const xml = await httpGet(url);
  parseRssFeed(xml); // throws if the feed is not parseable
  const title = extractFeedTitle(xml) ?? new URL(url).hostname.replace(/^www\./, '');
  return { type, feedUrl: url, title };
}

interface SourceRowDb {
  id: string;
  type: SourceListItem['type'];
  title: string | null;
  is_active: boolean;
  last_error: string | null;
}

export function mapSourceRow(row: SourceRowDb): SourceListItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title ?? '',
    isActive: row.is_active,
    lastError: row.last_error,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- client/sources`
Expected: PASS (8 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/client/types.ts src/client/sources.ts test/client/sources.test.ts
git commit -m "feat: validate/prepare a source and map source rows to view items"
```

---

## Task 5: Feed time formatting + row mapping (TDD)

**Files:**
- Create: `src/client/feed.ts`
- Test: `test/client/feed.test.ts`

- [ ] **Step 1: Write the failing test — `test/client/feed.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatRelativeTime, mapFeedRow } from '../../src/client/feed';

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-14T12:00:00.000Z').getTime();
  it('shows "just now" under a minute', () => {
    expect(formatRelativeTime('2026-06-14T11:59:30.000Z', now)).toBe('just now');
  });
  it('shows minutes', () => {
    expect(formatRelativeTime('2026-06-14T11:45:00.000Z', now)).toBe('15m ago');
  });
  it('shows hours', () => {
    expect(formatRelativeTime('2026-06-14T09:00:00.000Z', now)).toBe('3h ago');
  });
  it('shows days', () => {
    expect(formatRelativeTime('2026-06-12T12:00:00.000Z', now)).toBe('2d ago');
  });
  it('returns empty string for a null date', () => {
    expect(formatRelativeTime(null, now)).toBe('');
  });
});

describe('mapFeedRow', () => {
  it('maps a joined summary row to a FeedItem', () => {
    const row = {
      article_id: 'a1',
      summary_text: 'A summary.',
      articles: {
        title: 'Title',
        url: 'https://x/1',
        published_at: '2026-06-14T09:00:00.000Z',
        sources: { title: 'Lenny' },
      },
    };
    expect(mapFeedRow(row)).toEqual({
      articleId: 'a1',
      title: 'Title',
      url: 'https://x/1',
      summary: 'A summary.',
      sourceTitle: 'Lenny',
      publishedAt: '2026-06-14T09:00:00.000Z',
    });
  });
  it('handles the embed arriving as a one-element array and missing fields', () => {
    const row = {
      article_id: 'a2',
      summary_text: null,
      articles: [{ title: 'T2', url: 'u2', published_at: null, sources: [{ title: 'S2' }] }],
    };
    expect(mapFeedRow(row)).toEqual({
      articleId: 'a2', title: 'T2', url: 'u2', summary: '', sourceTitle: 'S2', publishedAt: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- client/feed`
Expected: FAIL — cannot find module `feed`.

- [ ] **Step 3: Implement — `src/client/feed.ts`**

```ts
import type { FeedItem } from './types';

export function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function mapFeedRow(row: any): FeedItem {
  const article = one<any>(row.articles);
  const source = one<any>(article?.sources);
  return {
    articleId: row.article_id,
    title: article?.title ?? '',
    url: article?.url ?? '',
    summary: row.summary_text ?? '',
    sourceTitle: source?.title ?? '',
    publishedAt: article?.published_at ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- client/feed`
Expected: PASS (7 tests).

- [ ] **Step 5: Run FULL suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass (feed + pipeline + client); typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/client/feed.ts test/client/feed.test.ts
git commit -m "feat: relative-time formatting and feed row mapping"
```

---

## Task 6: Supabase client + data-access layer (thin; static-verified)

**Files:**
- Create: `src/client/supabase.ts`
- Modify: `src/client/sources.ts`, `src/client/feed.ts` (append thin DB ops)

These wrap supabase-js with the anon key; RLS scopes all reads to the signed-in user. Thin passthroughs (no unit tests — verified manually in Expo). Build carefully.

- [ ] **Step 1: Create the client factory — `src/client/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

(If `react-native-url-polyfill` is not present, add it: `npx expo install react-native-url-polyfill`.)

- [ ] **Step 2: Append thin source DB ops to `src/client/sources.ts`**

```ts
import { supabase } from './supabase';

export async function addSourceFromUrl(url: string, httpGet: HttpGet): Promise<void> {
  const prepared = await prepareSource(url, httpGet);
  const { error } = await supabase.from('sources').insert({
    type: prepared.type, feed_url: prepared.feedUrl, title: prepared.title, is_active: true,
  });
  if (error) throw error;
}

export async function listSources(): Promise<SourceListItem[]> {
  const { data, error } = await supabase
    .from('sources').select('id, type, title, is_active, last_error')
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSourceRow);
}

export async function setSourceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('sources').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function removeSource(id: string): Promise<void> {
  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) throw error;
}
```

(Add the necessary imports at the top of the file: `import type { HttpGet } from '../pipeline/types';` is already present; ensure `supabase`, `SourceListItem`, `mapSourceRow`, `prepareSource` are in scope.)

- [ ] **Step 3: Append thin feed DB ops to `src/client/feed.ts`**

```ts
import { supabase } from './supabase';
import type { FeedItem } from './types';

/** Today's completed summaries, newest first. RLS limits rows to the current user. */
export async function listTodaySummaries(): Promise<FeedItem[]> {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('summaries')
    .select('article_id, summary_text, articles(title, url, published_at, sources(title))')
    .eq('status', 'done')
    .gte('updated_at', startOfToday.toISOString())
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFeedRow);
}

export async function getFeedItem(articleId: string): Promise<FeedItem | null> {
  const { data, error } = await supabase
    .from('summaries')
    .select('article_id, summary_text, articles(title, url, published_at, sources(title))')
    .eq('article_id', articleId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFeedRow(data) : null;
}
```

- [ ] **Step 4: Static check + commit**

Confirm `npm run typecheck` stays clean (these files are under `src/`, so they ARE Node-typechecked — but they import `./supabase`, which imports RN-only `@react-native-async-storage/async-storage` and `react-native-url-polyfill`. To keep Node typecheck/test green, this is the one place RN deps leak into `src/`.) **Decision:** exclude `src/client/supabase.ts` from the Node tsconfig by adding it to `exclude`, OR keep the data-ops in the screens. To preserve "src/ is Node-clean", add `"exclude": ["src/client/supabase.ts"]` to `tsconfig.json` and ensure no Vitest test imports `supabase.ts` (tests only import the pure functions). Verify `npm test` (pure tests don't touch supabase.ts) and `npm run typecheck` are both clean.

```bash
git add src/client/supabase.ts src/client/sources.ts src/client/feed.ts tsconfig.json package.json package-lock.json
git commit -m "feat: supabase client and thin data-access layer for sources and feed"
```

---

## Task 7: Auth — sign-in screen + session gate (RN; manual-verified)

**Files:**
- Create: `app/sign-in.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Implement the auth gate — `app/_layout.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/client/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) router.replace('/sign-in');
    else if (session && onSignIn) router.replace('/');
  }, [ready, session, segments, router]);

  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 2: Implement the sign-in screen — `app/sign-in.tsx`**

```tsx
import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { supabase } from '../src/client/supabase';
import { isValidEmail } from '../src/client/validation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!isValidEmail(email)) { Alert.alert('Please enter a valid email'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) Alert.alert('Sign-in failed', error.message);
    else setSent(true);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>AI Daily Digest</Text>
      {sent ? (
        <Text>Check your email for the magic link.</Text>
      ) : (
        <>
          <TextInput
            placeholder="you@example.com"
            autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
          <Button title={busy ? 'Sending…' : 'Send magic link'} onPress={send} disabled={busy} />
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Confirm typecheck/tests unaffected + commit**

Run: `npm test && npm run typecheck` (still 53 tests; `app/` not Node-typechecked).
```bash
git add app/_layout.tsx app/sign-in.tsx
git commit -m "feat: magic-link sign-in screen and session-aware routing gate"
```

**Manual verification (deferred):** with `.env` set, `npm start` → app routes to sign-in when signed out; entering an email sends a magic link; opening it routes to the feed; restarting keeps the session.

---

## Task 8: Source management screen (RN; manual-verified)

**Files:**
- Create: `app/sources.tsx`

- [ ] **Step 1: Implement — `app/sources.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, RefreshControl, Switch, Text, TextInput, View } from 'react-native';
import { addSourceFromUrl, listSources, removeSource, setSourceActive } from '../src/client/sources';
import type { SourceListItem } from '../src/client/types';

const httpGet = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

export default function Sources() {
  const [items, setItems] = useState<SourceListItem[]>([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await listSources()); } catch (e: any) { Alert.alert('Load failed', e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!url.trim()) return;
    setBusy(true);
    try { await addSourceFromUrl(url.trim(), httpGet); setUrl(''); await load(); }
    catch (e: any) { Alert.alert("Couldn't add source", e.message); }
    finally { setBusy(false); }
  }

  async function toggle(item: SourceListItem) {
    try { await setSourceActive(item.id, !item.isActive); await load(); }
    catch (e: any) { Alert.alert('Update failed', e.message); }
  }

  async function remove(item: SourceListItem) {
    try { await removeSource(item.id); await load(); }
    catch (e: any) { Alert.alert('Delete failed', e.message); }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          placeholder="Paste an RSS / YouTube / Substack feed URL"
          autoCapitalize="none" value={url} onChangeText={setUrl}
          style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <Button title={busy ? '…' : 'Add'} onPress={add} disabled={busy} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={<Text style={{ color: '#888' }}>No sources yet — add one above.</Text>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '500' }}>{item.title || item.type}</Text>
              {item.lastError ? <Text style={{ color: '#c00', fontSize: 12 }}>⚠ {item.lastError}</Text> : null}
            </View>
            <Switch value={item.isActive} onValueChange={() => toggle(item)} />
            <Button title="Delete" color="#c00" onPress={() => remove(item)} />
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck/tests + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/sources.tsx
git commit -m "feat: source management screen (add/validate/toggle/remove)"
```

**Manual verification (deferred):** add a real RSS URL → appears in the list; toggling pauses it; a bad URL shows a clear error; delete removes it.

---

## Task 9: Today feed + article detail (RN; manual-verified)

**Files:**
- Create: `app/index.tsx` (replace placeholder), `app/article/[id].tsx`

- [ ] **Step 1: Implement the Today feed — `app/index.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listTodaySummaries, formatRelativeTime } from '../src/client/feed';
import { supabase } from '../src/client/supabase';
import type { FeedItem } from '../src/client/types';

export default function Today() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await listTodaySummaries()); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Today',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Link href="/sources"><Text style={{ color: '#06f' }}>Sources</Text></Link>
              <Text style={{ color: '#06f' }} onPress={() => supabase.auth.signOut()}>Sign out</Text>
            </View>
          ),
        }}
      />
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={items}
        keyExtractor={(i) => i.articleId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={{ color: '#888' }}>Nothing new today. Pull to refresh.</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <Link href={`/article/${item.articleId}`} asChild>
            <Pressable>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
              <Text numberOfLines={3} style={{ color: '#333', marginTop: 4 }}>{item.summary}</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                {item.sourceTitle} · {formatRelativeTime(item.publishedAt, Date.now())}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </>
  );
}
```

This also satisfies the `auth` spec's sign-out scenario: `supabase.auth.signOut()` clears the session, and the `_layout` gate (Task 7) reacts to `onAuthStateChange` by routing back to `/sign-in`. The "Sources" link provides navigation from the feed to source management.

- [ ] **Step 2: Implement the article detail — `app/article/[id].tsx`**

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Linking, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFeedItem } from '../../src/client/feed';
import type { FeedItem } from '../../src/client/types';

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedItem(String(id)).then(setItem).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!item) return <Text style={{ padding: 16 }}>Not found.</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: '#888' }}>{item.sourceTitle}</Text>
      <Text style={{ fontSize: 16, lineHeight: 24 }}>{item.summary}</Text>
      <Button title="Open original" onPress={() => Linking.openURL(item.url)} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Typecheck/tests + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/index.tsx app/article/
git commit -m "feat: Today feed with pull-to-refresh and article detail view"
```

**Manual verification (deferred):** signed-in feed shows today's summaries; pull-to-refresh re-queries; tapping opens detail; "Open original" launches the browser; empty day shows the empty state.

---

## Task 10: README + manual verification checklist (docs)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document app setup + the manual verification steps**

Add a "Mobile app" section to `README.md`: prerequisites (Node, Expo Go or a simulator), `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), `npm start`, and the end-to-end manual check (sign in → add a source → run the pipeline (Plan B) → pull-to-refresh the feed → open an article → open original). Note that automated tests cover the pure logic; screens are verified manually.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: mobile app setup and manual verification checklist"
```

---

## Definition of Done (Plan C)

- `npm test` passes: all feed + pipeline + client pure-logic tests green (meta, validation, sources, feed mappers/formatters).
- `npm run typecheck` clean (RN screens excluded from the Node tsconfig; `src/client/supabase.ts` excluded as the single RN-importing module under `src/`).
- Expo app builds the four screens (sign-in, Today feed, source management, article detail) wired to Supabase via the anon key; auth gate routes on session.
- Pure client logic is framework-free and unit-tested; screens and live auth/data flow verified manually in Expo (documented in README).

Hands off to **Plan D (push notifications + final verification + archive)**: register Expo push tokens, send the daily digest, end-to-end real-device verification, and `openspec archive`.
