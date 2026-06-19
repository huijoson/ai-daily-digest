# Bilingual Hacker News Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hacker News (brief-mode) summaries bilingual — a 2-3 sentence English summary followed by its Traditional Chinese translation — while leaving paid (FOMO/analysis) summaries and titles unchanged.

**Architecture:** Change only the `brief` branch of the pure `buildSummaryPrompt` in `src/pipeline/summarize.ts` (gate-covered by Vitest) to instruct English + 繁體中文 output; widen the Today feed card preview to 6 lines (RN). Existing HN summaries are refreshed by a one-off re-summarize.

**Tech Stack:** TypeScript, Vitest, Expo (React Native), Gemini.

**Spec:** `docs/superpowers/specs/2026-06-19-bilingual-hn-summaries-design.md`.

---

## File Structure

```
src/pipeline/summarize.ts        # MODIFY: brief-mode instructions → English + Traditional Chinese
test/pipeline/summarize.test.ts  # MODIFY: the two brief tests that asserted "same language"
app/index.tsx                    # MODIFY: feed card summary numberOfLines 4 → 6
```

Task 1 is gate-covered (pure prompt + tests). Task 2 is RN (manual). Task 3 is a live re-summarize. The `analysis` branch and its "same language" test are untouched.

---

## Task 1: Bilingual brief prompt (TDD)

**Files:**
- Modify: `src/pipeline/summarize.ts`, `test/pipeline/summarize.test.ts`

- [ ] **Step 1: Update the two brief tests in `test/pipeline/summarize.test.ts`**

There are two brief-mode tests that assert `'same language'`. Brief mode no longer says that, so update both:

Replace this test:
```ts
  it('instructs the model to summarize in the article\'s own language', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p.toLowerCase()).toContain('same language');
  });
```
with:
```ts
  it('brief mode asks for English plus a Traditional Chinese translation', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p.toLowerCase()).toContain('english');
    expect(p).toContain('繁體中文');
    expect(p.toLowerCase()).not.toContain('same language');
  });
```

And in this test:
```ts
  it('brief mode (default) asks for 2-3 sentences', () => {
    const p = buildSummaryPrompt({ title: 'T', url: 'u', content: 'c' });
    expect(p).toContain('2-3');
    expect(p.toLowerCase()).toContain('same language');
  });
```
change the last line from `expect(p.toLowerCase()).toContain('same language');` to:
```ts
    expect(p).toContain('English');
```

(Leave the `analysis mode asks for bullets…` test — it still asserts analysis contains `'same language'`, which stays true.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- summarize`
Expected: FAIL — brief prompt does not yet contain "English"/"繁體中文" and still contains "same language".

- [ ] **Step 3: Update the brief branch in `src/pipeline/summarize.ts`**

Replace the brief (non-analysis) instructions array:
```ts
      : [
          'Summarize the following article in 2-3 concise sentences for a daily digest.',
          'Write the summary in the same language as the article.',
          'Be factual and neutral. Do not add any preamble or markdown.',
        ];
```
with:
```ts
      : [
          'Summarize the following article in 2-3 concise sentences for a daily digest.',
          'First write the summary in English, then on a new paragraph write a Traditional Chinese (繁體中文) translation of that summary.',
          'Output exactly the two paragraphs separated by a blank line — English first, then Traditional Chinese — with no labels, preamble, or markdown.',
          'Be factual and neutral.',
        ];
```
(The `analysisInstructions` array, `hasImages` handling, and the final `return [...instructions, '', Title…]` line are unchanged.)

- [ ] **Step 4: Run the tests to verify they pass + full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: brief tests pass; full suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/summarize.ts test/pipeline/summarize.test.ts
git commit -m "feat: bilingual brief summaries (English + Traditional Chinese) for Hacker News"
```

---

## Task 2: Widen the feed card preview (RN; manual-verified)

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Change the summary preview line count**

In `app/index.tsx`, the feed item renders the summary with `numberOfLines={4}`. Change it to `numberOfLines={6}` so the Traditional Chinese paragraph peeks out under the English. The exact line:
```tsx
              <Text numberOfLines={4} style={[type.summary, { marginTop: spacing.xs }]}>{item.summary}</Text>
```
becomes:
```tsx
              <Text numberOfLines={6} style={[type.summary, { marginTop: spacing.xs }]}>{item.summary}</Text>
```
(Nothing else changes; the article detail already shows the full summary with no line cap.)

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
Expected: unchanged green (app/ is outside the Node tsconfig).

```bash
git add app/index.tsx
git commit -m "feat: widen Today feed card to 6 lines for bilingual summaries"
```

---

## Task 3: Live re-summarize existing HN (REQUIRED, user/assistant-run)

- [ ] 3.1 Reset the current `done` Hacker News summaries to `pending` (so they regenerate bilingually) and re-run the pipeline:
  - Reset via the Supabase REST/SQL: set `summaries.status = 'pending'` for summaries whose article's source type is `hackernews`.
  - Run `npx tsx scripts/run-pipeline.ts` (batch 30) — HN within 24h re-summarize bilingually; FOMO is untouched.
- [ ] 3.2 Rebuild the iOS app (Xcode ▶︎ Run, Release) and/or `npm start` → `w`; confirm each Hacker News card/detail shows the English summary followed by a Traditional Chinese translation, and FOMO is unchanged.

---

## Definition of Done

- The brief prompt yields English + Traditional Chinese; the two brief tests assert the new behavior; analysis prompt + its test unchanged. `npm test` green, `npm run typecheck` clean.
- Feed card shows 6 lines. Live: HN summaries are bilingual (English then 繁體中文); FOMO unaffected.
