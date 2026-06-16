# Digest Depth + Feed Sectioning + HN Recency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give paid email content analytical (bullets + analysis) summaries, split the Today feed into two newest-first sections (paid / Hacker News), and limit Hacker News fetching to the last 24 hours.

**Architecture:** Pure, dependency-injected logic stays Vitest-tested: a depth-aware `buildSummaryPrompt(input, mode)` chosen by `sourceType`, a pure `filterRecentArticles`, and a pure `groupFeed`. `sourceType` is threaded through `PendingSummary`/`Summarizer`/`FeedItem` and the data layer. The RN Today screen becomes a `SectionList`.

**Tech Stack:** TypeScript, Vitest, Expo (React Native), Supabase.

**Spec:** `docs/superpowers/specs/2026-06-16-digest-depth-and-feed-design.md`.

**Prereqs:** existing pipeline (`src/pipeline/*`), client (`src/client/*`), runner (`scripts/run-pipeline.ts`), Deno adapter (`supabase/functions/_shared/db.ts`).

---

## File Structure

```
src/pipeline/summarize.ts       # MODIFY: buildSummaryPrompt(input, mode); createGeminiSummarizer picks mode
src/pipeline/types.ts           # MODIFY: PendingSummary.sourceType; Summarizer input.sourceType
src/pipeline/run-summarize.ts   # MODIFY: pass sourceType to summarize()
src/pipeline/fetch-source.ts    # MODIFY: filterRecentArticles + HN 24h filter + now param
src/client/types.ts             # MODIFY: FeedItem.sourceType
src/client/feed.ts              # MODIFY: mapFeedRow returns sourceType; ADD groupFeed
src/client/data.ts              # MODIFY: listPendingSummaries... (no) — listTodaySummaries/getFeedItem select sources type
scripts/run-pipeline.ts         # MODIFY: listPendingSummaries returns sourceType
supabase/functions/_shared/db.ts# MODIFY: listPendingSummaries returns sourceType (parity)
app/index.tsx                   # MODIFY: SectionList with two groups
test/pipeline/summarize.test.ts # MODIFY
test/pipeline/run-summarize.test.ts # MODIFY
test/pipeline/fetch-source.test.ts  # MODIFY
test/client/feed.test.ts        # MODIFY
```

Tasks 1–4 are pure TDD. Task 5 is the data layer (runner/Deno/data.ts — static). Task 6 is the RN screen (manual).

---

## Task 1: Depth-aware summary prompt (TDD)

**Files:**
- Modify: `src/pipeline/summarize.ts`
- Test: `test/pipeline/summarize.test.ts`

- [ ] **Step 1: Add failing tests to `test/pipeline/summarize.test.ts`**

In the existing `describe('buildSummaryPrompt', ...)` block, append:
```ts
  it('brief mode (default) asks for 2-3 sentences', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p).toContain('2-3');
    expect(p.toLowerCase()).toContain('same language');
  });

  it('analysis mode asks for bullets and an analysis paragraph', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' }, 'analysis');
    expect(p.toLowerCase()).toContain('bullet');
    expect(p.toLowerCase()).toContain('analysis');
    expect(p.toLowerCase()).toContain('same language');
  });
```

- [ ] **Step 2: Run the test to verify the analysis test fails**

Run: `npm test -- summarize`
Expected: FAIL — `buildSummaryPrompt` ignores the second arg, so the analysis assertions (`bullet`, `analysis`) fail.

- [ ] **Step 3: Implement the mode param in `src/pipeline/summarize.ts`**

Replace the `buildSummaryPrompt` function with:
```ts
export function buildSummaryPrompt(
  input: { title: string; url: string; content: string | null },
  mode: 'brief' | 'analysis' = 'brief',
): string {
  const body = input.content?.trim()
    ? input.content.trim()
    : '(no content provided; summarize based on the title and link)';
  const instructions = mode === 'analysis'
    ? [
        'Summarize the following paid article for a daily digest.',
        'Write the summary in the same language as the article.',
        'Format (no preamble, no markdown headers): first one sentence stating the core takeaway,',
        'then 3-6 bullet points (each line starting with "- ") covering the key points,',
        'then one short paragraph of analysis and implications.',
        'Be factual; ground the analysis in the article.',
      ]
    : [
        'Summarize the following article in 2-3 concise sentences for a daily digest.',
        'Write the summary in the same language as the article.',
        'Be factual and neutral. Do not add any preamble or markdown.',
      ];
  return [...instructions, '', `Title: ${input.title}`, `URL: ${input.url}`, '', 'Content:', body].join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- summarize`
Expected: PASS (existing buildSummaryPrompt tests + the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/summarize.ts test/pipeline/summarize.test.ts
git commit -m "feat: analysis-mode summary prompt (bullets + analysis paragraph)"
```

---

## Task 2: Thread sourceType so paid content uses analysis mode (TDD)

**Files:**
- Modify: `src/pipeline/types.ts`, `src/pipeline/summarize.ts`, `src/pipeline/run-summarize.ts`
- Test: `test/pipeline/summarize.test.ts`, `test/pipeline/run-summarize.test.ts`

- [ ] **Step 1: Add `sourceType` to the types**

In `src/pipeline/types.ts`: add `sourceType: SourceType;` to `PendingSummary` (after `content`), and add `sourceType: SourceType;` to the `Summarizer` input object (after `content`). `SourceType` is already imported at the top.

- [ ] **Step 2: Update failing tests**

In `test/pipeline/summarize.test.ts`, the `createGeminiSummarizer` tests call `summarize({ title: 'T', url: 'u', content: 'c' })` — add `sourceType: 'hackernews'` to those calls. Then append a new test that proves email → analysis mode:
```ts
  it('uses analysis mode for email sources', async () => {
    let sentBody: any;
    const summarize = createGeminiSummarizer({
      apiKey: 'KEY',
      httpPostJson: async (_url, body) => {
        sentBody = body;
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) } as any;
      },
    });
    await summarize({ title: 'T', url: 'u', content: 'c', sourceType: 'email' });
    const promptText = sentBody.contents[0].parts[0].text.toLowerCase();
    expect(promptText).toContain('bullet');
  });
```

In `test/pipeline/run-summarize.test.ts`, update the `p()` helper to include `sourceType`:
```ts
const p = (articleId: string): PendingSummary => ({ articleId, title: 't', url: 'u', content: 'c', sourceType: 'hackernews' });
```
And append a test that the sourceType is forwarded to the summarizer:
```ts
  it('forwards sourceType to the summarizer', async () => {
    const { db } = makeDb([{ articleId: 'a1', title: 't', url: 'u', content: 'c', sourceType: 'email' }]);
    let seen: string | undefined;
    const summarize: Summarizer = async (input) => { seen = input.sourceType; return { text: 's', model: 'm' }; };
    await runSummarize({ db, summarize, batchSize: 10 });
    expect(seen).toBe('email');
  });
```
(`SourceType`/`Summarizer` import: `Summarizer` is already imported in that file; `PendingSummary` too. No new import needed beyond what's there.)

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- summarize run-summarize`
Expected: FAIL — `createGeminiSummarizer` doesn't yet pick the mode; `runSummarize` doesn't forward `sourceType` (so `seen` is `undefined`); type errors until impl.

- [ ] **Step 4: Implement**

In `src/pipeline/summarize.ts`, change `createGeminiSummarizer`'s returned function to pick the mode:
```ts
export function createGeminiSummarizer(deps: GeminiDeps): Summarizer {
  return async (input) => {
    const mode = input.sourceType === 'email' ? 'analysis' : 'brief';
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${deps.apiKey}`;
    const body = { contents: [{ parts: [{ text: buildSummaryPrompt(input, mode) }] }] };
    const res = await deps.httpPostJson(url, body);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const text = parseGeminiResponse(await res.json());
    return { text, model: GEMINI_MODEL };
  };
}
```

In `src/pipeline/run-summarize.ts`, forward `sourceType`:
```ts
      const result = await deps.summarize({ title: item.title, url: item.url, content: item.content, sourceType: item.sourceType });
```

- [ ] **Step 5: Run to verify pass + typecheck**

Run: `npm test -- summarize run-summarize && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/pipeline/types.ts src/pipeline/summarize.ts src/pipeline/run-summarize.ts test/pipeline/summarize.test.ts test/pipeline/run-summarize.test.ts
git commit -m "feat: select summary depth by source (email -> analysis)"
```

---

## Task 3: Limit Hacker News to the last 24h (TDD)

**Files:**
- Modify: `src/pipeline/fetch-source.ts`
- Test: `test/pipeline/fetch-source.test.ts`

- [ ] **Step 1: Add failing tests to `test/pipeline/fetch-source.test.ts`**

Add `filterRecentArticles` to the import from `'../../src/pipeline/fetch-source'`, and a `ParsedArticle` type import. Append:
```ts
import { filterRecentArticles } from '../../src/pipeline/fetch-source';
import type { ParsedArticle } from '../../src/feed/types';

const art = (guid: string, publishedAt: string | null): ParsedArticle => ({ guid, title: 't', url: 'u', publishedAt });

describe('filterRecentArticles', () => {
  const now = new Date('2026-06-16T12:00:00.000Z').getTime();
  const DAY = 24 * 60 * 60 * 1000;
  it('keeps articles within the window and drops older ones', () => {
    const out = filterRecentArticles(
      [art('recent', '2026-06-16T06:00:00.000Z'), art('old', '2026-06-14T06:00:00.000Z')],
      now, DAY,
    );
    expect(out.map((a) => a.guid)).toEqual(['recent']);
  });
  it('drops articles with no published date', () => {
    expect(filterRecentArticles([art('x', null)], now, DAY)).toEqual([]);
  });
});
```
And update the existing HN test (`fetches Hacker News top stories then their items`) so its items (time `1700000000` / `1700000001`) are not filtered out: pass an explicit `now` near those times. Change its `fetchSource(source, httpGet)` call to:
```ts
    const out = await fetchSource(source, httpGet, 1700000002000); // now ≈ item time, within 24h
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- fetch-source`
Expected: FAIL — `filterRecentArticles` not exported; the HN test now passes a 3rd arg the function doesn't accept yet (type error) and the recency filter isn't applied.

- [ ] **Step 3: Implement in `src/pipeline/fetch-source.ts`**

Add the helper and the `now` param + HN filter. Full file:
```ts
import { parseRssFeed } from '../feed/rss';
import { parseHackerNewsStories } from '../feed/hackernews';
import type { HnItem, ParsedArticle } from '../feed/types';
import type { HttpGet, SourceRow } from './types';

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const HN_LIMIT = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Keep articles whose publishedAt is within maxAgeMs of now; drop undated ones. */
export function filterRecentArticles(articles: ParsedArticle[], now: number, maxAgeMs: number): ParsedArticle[] {
  return articles.filter((a) => {
    if (!a.publishedAt) return false;
    const t = new Date(a.publishedAt).getTime();
    return !Number.isNaN(t) && now - t <= maxAgeMs;
  });
}

export async function fetchSource(
  source: SourceRow,
  httpGet: HttpGet,
  now: number = Date.now(),
): Promise<ParsedArticle[]> {
  if (source.type === 'hackernews') {
    const ids = JSON.parse(await httpGet(HN_TOP)) as number[];
    const items: HnItem[] = [];
    for (const id of ids.slice(0, HN_LIMIT)) {
      items.push(JSON.parse(await httpGet(HN_ITEM(id))) as HnItem);
    }
    return filterRecentArticles(parseHackerNewsStories(items), now, ONE_DAY_MS);
  }
  // 'rss' and 'youtube' are both feed XML parsed by the same Atom/RSS parser.
  if (!source.feedUrl) throw new Error(`source ${source.id} has no feed_url`);
  return parseRssFeed(await httpGet(source.feedUrl));
}
```

- [ ] **Step 4: Run to verify pass + full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass (the updated HN test passes via the injected `now`); typecheck clean. (runFetch calls `fetchSource(source, deps.httpGet)` — the `now` default applies, so no runFetch change is needed.)

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/fetch-source.ts test/pipeline/fetch-source.test.ts
git commit -m "feat: limit Hacker News fetch to the last 24 hours"
```

---

## Task 4: Feed source type + grouping (TDD)

**Files:**
- Modify: `src/client/types.ts`, `src/client/feed.ts`
- Test: `test/client/feed.test.ts`

- [ ] **Step 1: Add `sourceType` to `FeedItem` — `src/client/types.ts`**

Add `sourceType: SourceType;` to `FeedItem` (after `sourceTitle`). `SourceType` is already imported at the top of the file.

- [ ] **Step 2: Update + add failing tests in `test/client/feed.test.ts`**

Add `groupFeed` to the import from `'../../src/client/feed'`. Update the two existing `mapFeedRow` tests to include `type` in the `sources` fixture and `sourceType` in the expected object:
- Test 1: fixture `sources: { title: 'Lenny', type: 'email' }`; expected adds `sourceType: 'email'`.
- Test 2: fixture `sources: [{ title: 'S2', type: 'hackernews' }]`; expected adds `sourceType: 'hackernews'`.
Then append:
```ts
import { groupFeed } from '../../src/client/feed';
import type { FeedItem } from '../../src/client/types';

const fi = (id: string, sourceType: FeedItem['sourceType'], publishedAt: string | null): FeedItem => ({
  articleId: id, title: id, url: 'u', summary: 's', sourceTitle: 't', sourceType, publishedAt,
});

describe('groupFeed', () => {
  it('splits paid (email) from the rest and sorts each newest-first', () => {
    const items = [
      fi('hn-old', 'hackernews', '2026-06-10T00:00:00.000Z'),
      fi('paid-new', 'email', '2026-06-16T00:00:00.000Z'),
      fi('hn-new', 'hackernews', '2026-06-15T00:00:00.000Z'),
      fi('paid-old', 'email', '2026-06-12T00:00:00.000Z'),
    ];
    const { paid, hackerNews } = groupFeed(items);
    expect(paid.map((i) => i.articleId)).toEqual(['paid-new', 'paid-old']);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['hn-new', 'hn-old']);
  });
  it('sorts null dates last', () => {
    const { hackerNews } = groupFeed([
      fi('a', 'hackernews', null),
      fi('b', 'hackernews', '2026-06-15T00:00:00.000Z'),
    ]);
    expect(hackerNews.map((i) => i.articleId)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- client/feed`
Expected: FAIL — `groupFeed` not exported; updated `mapFeedRow` tests fail until it returns `sourceType`.

- [ ] **Step 4: Implement in `src/client/feed.ts`**

Add `sourceType` to `mapFeedRow`'s returned object and add `groupFeed`:
```ts
export function mapFeedRow(row: any): FeedItem {
  const article = one<any>(row.articles);
  const source = one<any>(article?.sources);
  return {
    articleId: row.article_id,
    title: article?.title ?? '',
    url: article?.url ?? '',
    summary: row.summary_text ?? '',
    sourceTitle: source?.title ?? '',
    sourceType: source?.type ?? 'rss',
    publishedAt: article?.published_at ?? null,
  };
}

export function groupFeed(items: FeedItem[]): { paid: FeedItem[]; hackerNews: FeedItem[] } {
  const byTimeDesc = (a: FeedItem, b: FeedItem) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : -Infinity;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : -Infinity;
    return tb - ta;
  };
  const paid = items.filter((i) => i.sourceType === 'email').sort(byTimeDesc);
  const hackerNews = items.filter((i) => i.sourceType !== 'email').sort(byTimeDesc);
  return { paid, hackerNews };
}
```
Add the `FeedItem` import if not already present (the file imports `FeedItem` from `./types` already).

- [ ] **Step 5: Run to verify pass + typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/client/types.ts src/client/feed.ts test/client/feed.test.ts
git commit -m "feat: feed item sourceType and groupFeed (paid vs hacker news, newest-first)"
```

---

## Task 5: Data layer returns sourceType (static; gates only)

**Files:**
- Modify: `scripts/run-pipeline.ts`, `supabase/functions/_shared/db.ts`, `src/client/data.ts`

`scripts/` and `supabase/**` are outside the Node tsconfig; `src/client/data.ts` imports the RN supabase client and is excluded too. Verify with `npm test` (must stay green) + `npm run typecheck` (clean), and read carefully.

- [ ] **Step 1: Runner `listPendingSummaries` returns `sourceType` — `scripts/run-pipeline.ts`**

The runner's `listPendingSummaries` already selects `articles!inner(title, url, content, sources!inner(type))` (from the prioritization change). Update its `mapRow` to return `sourceType`:
```ts
    const mapRow = (r: any): PendingSummary => {
      const article = one<any>(r.articles);
      const source = one<any>(article?.sources);
      return {
        articleId: r.article_id,
        title: article?.title ?? '',
        url: article?.url ?? '',
        content: article?.content ?? null,
        sourceType: source?.type ?? 'rss',
      };
    };
```

- [ ] **Step 2: Deno adapter `listPendingSummaries` returns `sourceType` — `supabase/functions/_shared/db.ts`**

Its `mapRow` (the select already includes `sources!inner(type)`) — add `sourceType`:
```ts
      const mapRow = (r: any): PendingSummary => {
        const article = Array.isArray(r.articles) ? r.articles[0] : r.articles;
        const source = Array.isArray(article?.sources) ? article.sources[0] : article?.sources;
        return {
          articleId: r.article_id,
          title: article?.title ?? '',
          url: article?.url ?? '',
          content: article?.content ?? null,
          sourceType: source?.type ?? 'rss',
        };
      };
```

- [ ] **Step 3: Feed queries select the source type — `src/client/data.ts`**

In BOTH `listTodaySummaries` and `getFeedItem`, change the select string from
`'article_id, summary_text, articles(title, url, published_at, sources(title))'`
to
`'article_id, summary_text, articles(title, url, published_at, sources(title, type))'`
(`mapFeedRow` already reads `source?.type`).

- [ ] **Step 4: Confirm gates + commit**

Run: `npm test && npm run typecheck`
Expected: still green (these files aren't gated, but the change must not break anything that is).

```bash
git add scripts/run-pipeline.ts supabase/functions/_shared/db.ts src/client/data.ts
git commit -m "feat: data layer returns source type for depth + feed grouping"
```

---

## Task 6: Today screen — two sections (RN; manual-verified)

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Replace the FlatList with a SectionList — `app/index.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listTodaySummaries, } from '../src/client/data';
import { formatRelativeTime, groupFeed } from '../src/client/feed';
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

  const { paid, hackerNews } = groupFeed(items);
  const sections = [
    { title: '📧 付費訂閱', data: paid },
    { title: '🟠 Hacker News', data: hackerNews },
  ].filter((s) => s.data.length > 0);

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
      <SectionList
        contentContainerStyle={{ padding: 16 }}
        sections={sections}
        keyExtractor={(i) => i.articleId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={{ color: '#888' }}>Nothing new today. Pull to refresh.</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item }) => (
          <Link href={`/article/${item.articleId}`} asChild>
            <Pressable>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
              <Text numberOfLines={4} style={{ color: '#333', marginTop: 4 }}>{item.summary}</Text>
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

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck` (unaffected; `app/` outside Node tsconfig).

```bash
git add app/index.tsx
git commit -m "feat: Today screen shows paid and Hacker News as separate sorted sections"
```

- [ ] **Step 3: Live re-verify (USER, after merge)**

Re-run the pipeline so FOMO posts get the new analytical summaries and HN is limited to 24h:
```bash
npx tsx scripts/run-pipeline.ts
```
Then refresh the app: the Today screen shows a "付費訂閱" section (analytical, bullet summaries) above a "Hacker News" section, each newest-first. (Existing FOMO summaries were made with the brief prompt; re-running re-summarizes only NEW pending items — to refresh the existing two, set their `summaries.status` to `'pending'` in the SQL editor and re-run, or wait for new posts.)

---

## Definition of Done

- `npm test` green (new tests: analysis prompt, sourceType forwarding, filterRecentArticles, groupFeed, updated mapFeedRow/HN tests); `npm run typecheck` clean.
- Email summaries use analysis mode; HN fetch limited to 24h; feed groups into two newest-first sections; dedup unchanged.
- Live: re-running the runner produces analytical FOMO summaries and a two-section sorted feed.
