# Comic-Lite Visual Theme — Design

## Why

The app works but looks generic (ad-hoc inline styles per screen). The user chose a
distinctive "comic-lite" look — bold black outlines, hard offset shadows
(sticker/comic feel), a warm paper background, a red accent, and a comic display
font for the English/Latin headers — applied consistently across all four screens.
Centralizing this in one theme module makes the look consistent and easy to retune.

## What changes

- A new shared theme module `src/client/theme.ts` holds the design tokens (colors,
  spacing, radii, type scale, hard shadow, border) and a few reusable style objects.
- All four screens (`app/index.tsx`, `app/article/[id].tsx`, `app/sources.tsx`,
  `app/sign-in.tsx`) restyle to the theme — layout/structure and behavior unchanged.
- The English/Latin comic display font (Bangers) is loaded at startup; Chinese and
  body text use the system font (Bangers has no CJK glyphs).

## Scope / non-goals

- In scope: visual styling only — colors, borders, shadows, spacing, the comic
  display font for Latin headers, and the shared theme module.
- Non-goals: NO change to data, queries, pipeline, navigation, or component
  behavior; no new screens; no change to what data each screen shows.

## Design tokens (comic-lite)

`src/client/theme.ts` (pure constants, importable + unit-testable):
- **colors:** `ink:'#1a1a1a'`, `paper:'#fdf6ec'`, `card:'#ffffff'`, `accent:'#e63946'`,
  `muted:'#999999'`, `subtle:'#555555'`.
- **border:** `width: 2.5`, `color: ink`. **radii:** `card: 10`, `pill: 20`.
- **shadowHard:** RN hard offset shadow — `shadowColor: ink, shadowOffset: {width:4,height:4},
  shadowOpacity: 1, shadowRadius: 0, elevation: 6` (the blur-less offset is the comic look).
- **spacing:** `xs:4, sm:8, md:12, lg:16, xl:24`.
- **type:** `display` (Bangers, ~26), `title:16/600`, `body:14`, `summary:12`,
  `meta:10`, `section:11/700`.
- **fonts:** `displayFamily: 'Bangers_400Regular'` (loaded via expo-font), with a
  graceful fallback to the system font until loaded.
- **styles (reusable objects):** `screenBg` (paper), `comicCard` (white + border +
  radii.card + shadowHard), `sectionPill` (ink background, paper text, pill radius),
  `headerTitle` (display font), `accentText`.

## Font loading

`app/_layout.tsx`: load Bangers with `@expo-google-fonts/bangers` + `expo-font`
`useFonts`. Render the app regardless of load state (do not block on fonts); the
display font simply swaps in when ready, falling back to the system font meanwhile.
Bangers is used ONLY for Latin display text ("Today", English titles, labels);
Chinese titles/summaries always use the system font.

## Screen application (structure unchanged)

- `app/index.tsx` (Today feed): `screenBg`; section headers as `sectionPill`
  ("📧 付費訂閱" / "🟠 Hacker News"); each item in a `comicCard`; "Today" header in
  the display font; accent on the relative-time/source meta as appropriate.
- `app/article/[id].tsx`: `screenBg`; title in display font (Latin) / system (CJK);
  summary in `comicCard`; images keep their current sizing; "Open original" as a
  comic button (ink border + hard shadow + accent fill).
- `app/sources.tsx`: `screenBg`; each source row in a `comicCard`; the add row +
  "+ Add Hacker News" + Delete as comic buttons; error text in accent.
- `app/sign-in.tsx`: `screenBg`; "AI Daily Digest" in display font; the email input
  bordered (ink), "Send magic link" as a comic button.

## Error handling
- No new failure modes (pure styling). Font load failure → system font fallback,
  app still fully usable.

## Testing
- `src/client/theme.ts` is pure constants — add a minimal unit test asserting the
  key tokens exist with sane types/values (colors are strings, shadow has zero
  radius, border width > 0). Screens are RN (outside the Node tsconfig) — verified
  manually in Expo, per existing convention.
- `npm test` + `npm run typecheck` stay green; functionality unchanged.

## Definition of done
- `theme.ts` exists with the comic-lite tokens (unit-tested); all four screens use
  it; Bangers loads for Latin headers with system fallback; behavior unchanged.
- Verified live: the four screens show the comic-lite look (bold borders, hard
  shadows, paper background, red accent, comic English headers) and remain fully
  functional.
