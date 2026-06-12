# Backend Foundation & Feed-Parsing Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project scaffold, the Supabase database (schema + Row Level Security), and a fully unit-tested, pure-logic feed-parsing core (RSS/Atom + Hacker News parsing, source-type detection, dedup).

**Architecture:** Pure, side-effect-free TypeScript functions in `src/feed/` take raw feed data and return normalized `ParsedArticle[]`. They are unit-tested in Node with Vitest and will later be imported unchanged by the Deno Edge Functions (Plan B). The database lives in Supabase migrations; RLS scopes every row to its owning user. This plan is Plan A of 4 (B: ingestion pipeline, C: mobile app, D: push + verification).

**Tech Stack:** TypeScript, Vitest, `fast-xml-parser`, Supabase CLI (Postgres + RLS).

**Spec:** `openspec/changes/add-daily-digest-mvp/` — capabilities `fetch-pipeline` (parsing/dedup), `auth` (schema + RLS).

---

## File Structure

```
package.json                 # root tooling: typescript, vitest, fast-xml-parser
tsconfig.json
vitest.config.ts
src/feed/types.ts            # ParsedArticle, SourceType, HnItem
src/feed/rss.ts              # parseRssFeed(xml) -> ParsedArticle[]  (RSS 2.0 + Atom)
src/feed/hackernews.ts       # parseHackerNewsStories(items) -> ParsedArticle[]
src/feed/detect.ts           # detectSourceType(url) -> SourceType
src/feed/dedup.ts            # filterNewArticles(parsed, existingGuids) -> ParsedArticle[]
src/feed/index.ts            # re-exports
test/feed/rss.test.ts
test/feed/hackernews.test.ts
test/feed/detect.test.ts
test/feed/dedup.test.ts
supabase/migrations/0001_init.sql
supabase/migrations/0002_rls.sql
```

Each `src/feed/*.ts` file has one responsibility and no I/O — fetching happens in Plan B. This keeps the core testable in isolation and reusable from Deno.

---

## Task 1: Root tooling scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-daily-digest",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fast-xml-parser": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts package-lock.json .gitignore
git commit -m "chore: add TypeScript + Vitest tooling for the feed core"
```

---

## Task 2: Feed types + RSS/Atom parser (TDD)

**Files:**
- Create: `src/feed/types.ts`, `src/feed/rss.ts`
- Test: `test/feed/rss.test.ts`

- [ ] **Step 1: Create the shared types**

`src/feed/types.ts`:
```ts
export type SourceType = 'rss' | 'youtube' | 'hackernews';

export interface ParsedArticle {
  guid: string;
  title: string;
  url: string;
  publishedAt: string | null; // ISO 8601, or null if the feed omits a date
}

export interface HnItem {
  id: number;
  title?: string;
  url?: string;
  time?: number; // unix seconds
  type?: string;
}
```

- [ ] **Step 2: Write the failing test**

`test/feed/rss.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseRssFeed } from '../../src/feed/rss';

const RSS2 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example</title>
  <item>
    <title>Hello World</title>
    <link>https://example.com/a</link>
    <guid>https://example.com/a</guid>
    <pubDate>Tue, 10 Jun 2025 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Second Post</title>
    <link>https://example.com/b</link>
    <guid isPermaLink="false">tag:example,b</guid>
    <pubDate>Wed, 11 Jun 2025 09:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>YT Channel</title>
  <entry>
    <id>yt:video:ABC123</id>
    <title>My Video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=ABC123"/>
    <published>2025-06-10T12:00:00+00:00</published>
  </entry>
</feed>`;

describe('parseRssFeed', () => {
  it('parses RSS 2.0 items', () => {
    const items = parseRssFeed(RSS2);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      guid: 'https://example.com/a',
      title: 'Hello World',
      url: 'https://example.com/a',
      publishedAt: '2025-06-10T09:00:00.000Z',
    });
  });

  it('reads guid text when guid has attributes', () => {
    const items = parseRssFeed(RSS2);
    expect(items[1].guid).toBe('tag:example,b');
  });

  it('parses Atom entries (e.g. YouTube) using the alternate link', () => {
    const items = parseRssFeed(ATOM);
    expect(items[0]).toEqual({
      guid: 'yt:video:ABC123',
      title: 'My Video',
      url: 'https://www.youtube.com/watch?v=ABC123',
      publishedAt: '2025-06-10T12:00:00.000Z',
    });
  });

  it('throws on an unrecognized document', () => {
    expect(() => parseRssFeed('<html></html>')).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- rss`
Expected: FAIL — cannot find module `../../src/feed/rss`.

- [ ] **Step 4: Implement the parser**

`src/feed/rss.ts`:
```ts
import { XMLParser } from 'fast-xml-parser';
import type { ParsedArticle } from './types';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toIso(date: unknown): string | null {
  if (!date) return null;
  const d = new Date(String(date));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRss2(channel: any): ParsedArticle[] {
  return toArray(channel.item).map((item: any) => {
    const guidRaw = item.guid;
    const guid = typeof guidRaw === 'object' && guidRaw !== null ? guidRaw['#text'] : guidRaw;
    return {
      guid: String(guid ?? item.link ?? ''),
      title: String(item.title ?? '').trim(),
      url: String(item.link ?? ''),
      publishedAt: toIso(item.pubDate),
    };
  });
}

function parseAtom(feed: any): ParsedArticle[] {
  return toArray(feed.entry).map((entry: any) => {
    const links = toArray<any>(entry.link);
    const link = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
    const href = link?.['@_href'] ?? '';
    const title = entry.title?.['#text'] ?? entry.title ?? '';
    return {
      guid: String(entry.id ?? href ?? ''),
      title: String(title).trim(),
      url: String(href),
      publishedAt: toIso(entry.published ?? entry.updated),
    };
  });
}

export function parseRssFeed(xml: string): ParsedArticle[] {
  const doc = parser.parse(xml);
  if (doc?.rss?.channel) return parseRss2(doc.rss.channel);
  if (doc?.feed) return parseAtom(doc.feed);
  throw new Error('Unrecognized feed format (expected RSS 2.0 or Atom)');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- rss`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/feed/types.ts src/feed/rss.ts test/feed/rss.test.ts
git commit -m "feat: parse RSS 2.0 and Atom feeds into normalized articles"
```

---

## Task 3: Hacker News parser (TDD)

**Files:**
- Create: `src/feed/hackernews.ts`
- Test: `test/feed/hackernews.test.ts`

- [ ] **Step 1: Write the failing test**

`test/feed/hackernews.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseHackerNewsStories } from '../../src/feed/hackernews';
import type { HnItem } from '../../src/feed/types';

const items: HnItem[] = [
  { id: 1, title: 'A Story', url: 'https://ex.com/a', time: 1749549600, type: 'story' },
  { id: 2, title: 'Ask HN: Something', time: 1749549601, type: 'story' }, // no url
  { id: 3, title: 'A Comment', time: 1749549602, type: 'comment' },        // wrong type
  { id: 4, time: 1749549603, type: 'story' },                              // no title
];

describe('parseHackerNewsStories', () => {
  it('keeps only stories that have a title', () => {
    const out = parseHackerNewsStories(items);
    expect(out.map((a) => a.guid)).toEqual(['hn:1', 'hn:2']);
  });

  it('uses a stable guid and falls back to the HN item URL', () => {
    const out = parseHackerNewsStories(items);
    expect(out[0].url).toBe('https://ex.com/a');
    expect(out[1].url).toBe('https://news.ycombinator.com/item?id=2');
  });

  it('converts unix time to an ISO date', () => {
    const out = parseHackerNewsStories(items);
    expect(out[0].publishedAt).toBe(new Date(1749549600 * 1000).toISOString());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- hackernews`
Expected: FAIL — cannot find module `hackernews`.

- [ ] **Step 3: Implement the parser**

`src/feed/hackernews.ts`:
```ts
import type { HnItem, ParsedArticle } from './types';

export function parseHackerNewsStories(items: HnItem[]): ParsedArticle[] {
  return items
    .filter((it): it is HnItem & { title: string } =>
      !!it && it.type === 'story' && typeof it.title === 'string' && it.title.length > 0)
    .map((it) => ({
      guid: `hn:${it.id}`,
      title: it.title.trim(),
      url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
      publishedAt: it.time ? new Date(it.time * 1000).toISOString() : null,
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- hackernews`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/feed/hackernews.ts test/feed/hackernews.test.ts
git commit -m "feat: parse Hacker News story items into normalized articles"
```

---

## Task 4: Source-type detection (TDD)

**Files:**
- Create: `src/feed/detect.ts`
- Test: `test/feed/detect.test.ts`

- [ ] **Step 1: Write the failing test**

`test/feed/detect.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectSourceType } from '../../src/feed/detect';

describe('detectSourceType', () => {
  it('detects Hacker News', () => {
    expect(detectSourceType('https://news.ycombinator.com/rss')).toBe('hackernews');
  });

  it('detects YouTube channel feeds', () => {
    expect(detectSourceType('https://www.youtube.com/feeds/videos.xml?channel_id=X')).toBe('youtube');
    expect(detectSourceType('https://youtu.be/abc')).toBe('youtube');
  });

  it('treats Substack and generic feeds as rss', () => {
    expect(detectSourceType('https://lenny.substack.com/feed')).toBe('rss');
    expect(detectSourceType('https://example.com/index.xml')).toBe('rss');
  });

  it('throws on an invalid URL', () => {
    expect(() => detectSourceType('not a url')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- detect`
Expected: FAIL — cannot find module `detect`.

- [ ] **Step 3: Implement detection**

`src/feed/detect.ts`:
```ts
import type { SourceType } from './types';

export function detectSourceType(url: string): SourceType {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (host === 'news.ycombinator.com') return 'hackernews';
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  return 'rss';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- detect`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/feed/detect.ts test/feed/detect.test.ts
git commit -m "feat: detect source type (hackernews/youtube/rss) from a URL"
```

---

## Task 5: Dedup by guid (TDD)

**Files:**
- Create: `src/feed/dedup.ts`, `src/feed/index.ts`
- Test: `test/feed/dedup.test.ts`

- [ ] **Step 1: Write the failing test**

`test/feed/dedup.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterNewArticles } from '../../src/feed/dedup';
import type { ParsedArticle } from '../../src/feed/types';

const a = (guid: string): ParsedArticle => ({ guid, title: guid, url: 'u', publishedAt: null });

describe('filterNewArticles', () => {
  it('drops articles whose guid already exists', () => {
    const out = filterNewArticles([a('1'), a('2'), a('3')], ['2']);
    expect(out.map((x) => x.guid)).toEqual(['1', '3']);
  });

  it('drops duplicates within the same batch', () => {
    const out = filterNewArticles([a('1'), a('1'), a('2')], []);
    expect(out.map((x) => x.guid)).toEqual(['1', '2']);
  });

  it('returns nothing when everything is already known (idempotent re-run)', () => {
    const out = filterNewArticles([a('1'), a('2')], ['1', '2']);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- dedup`
Expected: FAIL — cannot find module `dedup`.

- [ ] **Step 3: Implement dedup and the barrel file**

`src/feed/dedup.ts`:
```ts
import type { ParsedArticle } from './types';

export function filterNewArticles(
  parsed: ParsedArticle[],
  existingGuids: Iterable<string>,
): ParsedArticle[] {
  const seen = new Set(existingGuids);
  const out: ParsedArticle[] = [];
  for (const article of parsed) {
    if (seen.has(article.guid)) continue;
    seen.add(article.guid); // also dedup within this batch
    out.push(article);
  }
  return out;
}
```

`src/feed/index.ts`:
```ts
export * from './types';
export { parseRssFeed } from './rss';
export { parseHackerNewsStories } from './hackernews';
export { detectSourceType } from './detect';
export { filterNewArticles } from './dedup';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- dedup`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all feed tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/feed/dedup.ts src/feed/index.ts test/feed/dedup.test.ts
git commit -m "feat: dedup parsed articles by guid (within-batch and vs existing)"
```

---

## Task 6: Supabase init + schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql` (and `supabase/config.toml` via CLI)

- [ ] **Step 1: Initialize Supabase locally**

Run: `npx supabase init`
Expected: creates `supabase/config.toml`. (If the Supabase CLI is not installed, install per https://supabase.com/docs/guides/cli, then re-run.)

- [ ] **Step 2: Create the schema migration**

`supabase/migrations/0001_init.sql`:
```sql
create type source_type as enum ('rss', 'youtube', 'hackernews');
create type summary_status as enum ('pending', 'done', 'failed');

create table sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        source_type not null,
  feed_url    text,
  title       text,
  is_active   boolean not null default true,
  last_error  text,
  created_at  timestamptz not null default now()
);

create table articles (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references sources(id) on delete cascade,
  guid          text not null,
  title         text not null,
  url           text not null,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  unique (source_id, guid)
);

create table summaries (
  id            uuid primary key default gen_random_uuid(),
  article_id    uuid not null unique references articles(id) on delete cascade,
  summary_text  text,
  model         text,
  status        summary_status not null default 'pending',
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  expo_token  text not null,
  platform    text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, expo_token)
);

create index articles_source_id_idx on articles(source_id);
create index summaries_status_idx on summaries(status);
```

- [ ] **Step 3: Apply the migration to a local database**

Run: `npx supabase start && npx supabase db reset`
Expected: local stack boots; migration applies with no errors. (`db reset` re-applies all migrations.)

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml supabase/migrations/0001_init.sql
git commit -m "feat: add Postgres schema (sources, articles, summaries, push_tokens)"
```

---

## Task 7: Row Level Security migration + verification

**Files:**
- Create: `supabase/migrations/0002_rls.sql`, `supabase/tests/rls.test.sql`

- [ ] **Step 1: Create the RLS migration**

`supabase/migrations/0002_rls.sql`:
```sql
alter table sources     enable row level security;
alter table articles    enable row level security;
alter table summaries   enable row level security;
alter table push_tokens enable row level security;

create policy "own sources" on sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own push tokens" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own articles" on articles
  for all using (exists (
    select 1 from sources s
    where s.id = articles.source_id and s.user_id = auth.uid()));

create policy "own summaries" on summaries
  for all using (exists (
    select 1 from articles a
    join sources s on s.id = a.source_id
    where a.id = summaries.article_id and s.user_id = auth.uid()));
```

Note: Edge Functions (Plan B) use the service-role key, which bypasses RLS for the pipeline.

- [ ] **Step 2: Write a pgTAP test for isolation (failing)**

`supabase/tests/rls.test.sql`:
```sql
begin;
select plan(2);

-- two users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.dev');

-- user A owns a source
insert into sources (id, user_id, type, feed_url)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'rss', 'https://a.dev/feed');

-- act as user B
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint, 'user B cannot see user A''s source');

-- act as user A
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from sources where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint, 'user A can see their own source');

select * from finish();
rollback;
```

- [ ] **Step 3: Run the RLS test to verify it fails (no policies applied yet)**

Run: `npx supabase test db` (after `git stash`-ing migration 0002, or before applying it)
Expected: FAIL — user B currently sees user A's row.
(Practical alternative: apply 0002, then confirm the test PASSES in Step 5; the point is the assertions encode the requirement.)

- [ ] **Step 4: Apply both migrations**

Run: `npx supabase db reset`
Expected: 0001 and 0002 apply cleanly; RLS enabled.

- [ ] **Step 5: Run the RLS test to verify it passes**

Run: `npx supabase test db`
Expected: PASS — B sees 0 rows, A sees 1 row.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_rls.sql supabase/tests/rls.test.sql
git commit -m "feat: enforce per-user data isolation with Row Level Security"
```

---

## Definition of Done (Plan A)

- `npm test` passes: RSS/Atom, Hacker News, detection, dedup all green.
- `npm run typecheck` clean.
- `npx supabase db reset` applies both migrations; `npx supabase test db` passes the RLS isolation test.
- All work committed in small, conventional commits.

Hands off to **Plan B (ingestion pipeline)**, which imports `src/feed/*` into the Fetch Edge Function and adds the `summarize()` Gemini abstraction.
