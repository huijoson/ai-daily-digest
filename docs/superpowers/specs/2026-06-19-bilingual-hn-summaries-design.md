# Bilingual Hacker News Summaries (English + Traditional Chinese) — Design

## Why

Hacker News summaries come out English-only because the brief summary prompt says
"write in the same language as the article" and HN articles are English. The user
reads Traditional Chinese and wants HN summaries side-by-side: the English summary
plus a Traditional Chinese translation. Paid (FOMO) content is already Chinese and
is not affected.

## What changes

- The brief summary mode (used for Hacker News / non-email sources) produces a
  2-3 sentence English summary followed by its Traditional Chinese translation, as
  two short paragraphs in one summary value.
- The Today feed card preview widens from 4 to 6 lines so the Chinese paragraph
  peeks out under the English; the article detail shows the full bilingual text.
- Titles are unchanged (English original, per the user's choice).

## Scope / non-goals

- In scope: the `brief` branch of `buildSummaryPrompt` and the feed card's
  `numberOfLines`. A one-off re-summarize of existing HN to refresh them.
- Non-goals: the `analysis` (paid/email) prompt is unchanged — FOMO stays in its own
  language (Chinese). No title translation. No data-model change (the bilingual text
  lives in the existing `summary_text`).

## Architecture

### Prompt — `buildSummaryPrompt(input, 'brief')` in `src/pipeline/summarize.ts`
Replace the brief instructions. Today they are:
```
Summarize the following article in 2-3 concise sentences for a daily digest.
Write the summary in the same language as the article.
Be factual and neutral. Do not add any preamble or markdown.
```
New brief instructions:
```
Summarize the following article in 2-3 concise sentences for a daily digest.
First write the summary in English, then on a new paragraph write a Traditional
Chinese (繁體中文) translation of that summary.
Output exactly the two paragraphs separated by a blank line — English first, then
Traditional Chinese — with no labels, preamble, or markdown.
Be factual and neutral.
```
The `analysis` branch (paid/email) is unchanged. `hasImages` handling unchanged
(brief never uses it). The summary value therefore becomes "English paragraph\n\n繁中
paragraph"; `parseGeminiResponse` already trims and returns the whole text.

### Feed card — `app/index.tsx`
The item summary `<Text numberOfLines={4}>` becomes `numberOfLines={6}` so the
Chinese paragraph is partially visible in the feed; the article detail view already
shows the full text (no `numberOfLines`), so the complete bilingual summary is read
there.

## Error handling
No new failure modes. If Gemini returns only one language, the summary still renders
(it's just text). Existing failure/retry behavior is unchanged.

## Testing
- Unit (Vitest): update the `buildSummaryPrompt` brief test — it currently asserts
  "2-3" and "same language"; change it to assert the prompt contains "English" and
  "Traditional Chinese" (or 繁體中文) and no longer claims "same language". The
  analysis-mode and createGeminiSummarizer tests are unaffected.
- `npm test` + `npm run typecheck` stay green.
- Manual (live): re-summarize HN and confirm each HN card/detail shows English then
  Traditional Chinese; FOMO unchanged.

## Live refresh
Existing HN summaries are English-only. After shipping, a one-off reset of the
current HN `done` summaries to `pending` + a pipeline re-run regenerates them
bilingually (they are within the 24h window, so they re-summarize). New HN are
bilingual automatically.

## Definition of done
- The brief prompt yields English + Traditional Chinese; feed card shows 6 lines;
  analysis/title unchanged. `npm test` green, `npm run typecheck` clean. Verified
  live: HN summaries are bilingual, FOMO unaffected.
