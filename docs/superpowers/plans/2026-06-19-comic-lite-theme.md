# Comic-Lite Visual Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a consistent "comic-lite" look (bold ink borders, hard offset shadows, paper background, red accent, Bangers display font for Latin headers) across all four screens via a shared theme module.

**Architecture:** A pure-constants `src/client/theme.ts` (colors, spacing, radii, type, hard shadow, reusable style objects — no React Native import, so it is unit-testable under Vitest and Node-typechecked). The four RN screens import its tokens and restyle; layout/structure and behavior are unchanged. Bangers loads at startup via expo-font with a system-font fallback.

**Tech Stack:** TypeScript, Vitest, Expo (React Native), `@expo-google-fonts/bangers` + `expo-font`.

**Spec:** `docs/superpowers/specs/2026-06-19-comic-lite-theme-design.md`.

---

## File Structure

```
src/client/theme.ts        # NEW: pure comic-lite tokens + reusable style objects (TDD)
test/client/theme.test.ts  # NEW
app/_layout.tsx            # MODIFY: load Bangers via useFonts (non-blocking)
app/index.tsx              # MODIFY: restyle Today feed to the theme
app/article/[id].tsx       # MODIFY: restyle article detail
app/sources.tsx            # MODIFY: restyle source management
app/sign-in.tsx            # MODIFY: restyle sign-in
package.json               # MODIFY: add @expo-google-fonts/bangers (+ expo-font if missing)
```

Task 1 is pure TDD (gate-covered). Tasks 2–6 are RN (outside the Node tsconfig; behavior unchanged; verified live in Expo). Buttons become `Pressable` styled from theme tokens (RN's `<Button>` can't carry the comic look).

---

## Task 1: theme.ts tokens + unit test (TDD)

**Files:**
- Create: `src/client/theme.ts`
- Test: `test/client/theme.test.ts`

- [ ] **Step 1: Write the failing test — `test/client/theme.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { colors, border, radii, spacing, shadowHard, fonts, type, styles } from '../../src/client/theme';

describe('comic-lite theme tokens', () => {
  it('has string colors incl ink/paper/accent', () => {
    for (const k of ['ink', 'paper', 'card', 'accent', 'muted', 'subtle'] as const) {
      expect(typeof colors[k]).toBe('string');
      expect(colors[k]).toMatch(/^#/);
    }
  });
  it('uses a blur-less hard shadow (the comic look)', () => {
    expect(shadowHard.shadowRadius).toBe(0);
    expect(shadowHard.shadowOffset.width).toBeGreaterThan(0);
    expect(shadowHard.shadowOpacity).toBe(1);
  });
  it('has a visible ink border', () => {
    expect(border.width).toBeGreaterThan(0);
    expect(border.color).toBe(colors.ink);
  });
  it('defines a non-empty display font family', () => {
    expect(typeof fonts.displayFamily).toBe('string');
    expect(fonts.displayFamily.length).toBeGreaterThan(0);
  });
  it('comicCard is white with the ink border and hard shadow', () => {
    expect(styles.comicCard.backgroundColor).toBe(colors.card);
    expect(styles.comicCard.borderColor).toBe(colors.ink);
    expect(styles.comicCard.shadowRadius).toBe(0);
  });
  it('exposes spacing, radii, and type scales', () => {
    expect(spacing.md).toBeGreaterThan(0);
    expect(radii.card).toBeGreaterThan(0);
    expect(type.title.fontSize).toBeGreaterThan(type.meta.fontSize);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- client/theme`
Expected: FAIL — cannot find module `../../src/client/theme`.

- [ ] **Step 3: Implement — `src/client/theme.ts`** (pure objects, NO `react-native` import)

```ts
// Comic-lite design tokens. Pure JS objects (RN styles are plain objects), so this
// file is unit-testable under Node and importable by the RN screens in app/.

export const colors = {
  ink: '#1a1a1a',
  paper: '#fdf6ec',
  card: '#ffffff',
  accent: '#e63946',
  muted: '#999999',
  subtle: '#555555',
} as const;

export const border = { width: 2.5, color: colors.ink } as const;
export const radii = { card: 10, pill: 20 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const shadowHard = {
  shadowColor: colors.ink,
  shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 6,
} as const;

export const fonts = { displayFamily: 'Bangers_400Regular' } as const;

export const type = {
  display: { fontFamily: fonts.displayFamily, fontSize: 26, letterSpacing: 1, color: colors.ink },
  title: { fontSize: 16, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 14, lineHeight: 22, color: colors.ink },
  summary: { fontSize: 12, lineHeight: 18, color: colors.subtle },
  meta: { fontSize: 10, color: colors.muted },
  section: { fontSize: 11, fontWeight: '700' as const },
} as const;

export const styles = {
  screenBg: { flex: 1, backgroundColor: colors.paper },
  comicCard: {
    backgroundColor: colors.card,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radii.card,
    shadowColor: shadowHard.shadowColor,
    shadowOffset: shadowHard.shadowOffset,
    shadowOpacity: shadowHard.shadowOpacity,
    shadowRadius: shadowHard.shadowRadius,
    elevation: shadowHard.elevation,
  },
  sectionPill: {
    alignSelf: 'flex-start' as const,
    backgroundColor: colors.ink,
    color: colors.paper,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 3,
    overflow: 'hidden' as const,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  comicButton: {
    backgroundColor: colors.accent,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radii.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: shadowHard.shadowColor,
    shadowOffset: shadowHard.shadowOffset,
    shadowOpacity: shadowHard.shadowOpacity,
    shadowRadius: shadowHard.shadowRadius,
    elevation: shadowHard.elevation,
  },
  comicButtonText: { color: colors.card, fontWeight: '700' as const, textAlign: 'center' as const },
  headerTitle: { fontFamily: fonts.displayFamily, fontSize: 26, color: colors.ink, letterSpacing: 1 },
} as const;
```

- [ ] **Step 4: Run the test to verify it passes + full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: theme tests pass; full suite green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/client/theme.ts test/client/theme.test.ts
git commit -m "feat: comic-lite theme tokens (pure, unit-tested)"
```

---

## Task 2: Load the Bangers display font (RN; manual-verified)

**Files:**
- Modify: `package.json` (deps), `app/_layout.tsx`

- [ ] **Step 1: Install the font packages**

Run: `npx expo install @expo-google-fonts/bangers expo-font`
(expo-font may already be present via expo; the command is idempotent.)

- [ ] **Step 2: Load the font in `app/_layout.tsx` (non-blocking)**

Add the import and the `useFonts` call; render children regardless of load state so the app never blocks (the display font swaps in when ready; until then Latin display text falls back to the system font). Add near the other imports:
```tsx
import { useFonts, Bangers_400Regular } from '@expo-google-fonts/bangers';
```
Inside `RootLayout`, add at the top of the component body (before the existing effects/return):
```tsx
  useFonts({ Bangers_400Regular });
```
(Do NOT gate rendering on the returned `[loaded]` flag — the spec requires no blocking; the font registers and re-renders when ready.)

- [ ] **Step 3: Confirm gates + commit**

Run: `npm test && npm run typecheck`
Expected: unchanged green (app/ is outside the Node tsconfig).

```bash
git add app/_layout.tsx package.json package-lock.json
git commit -m "feat: load Bangers display font (non-blocking, system fallback)"
```

---

## Task 3: Restyle the Today feed (RN; manual-verified)

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Replace `app/index.tsx` with the themed version**

Keep all data/logic (`listDigest`, `groupFeed(items, Date.now())`, sections, sign-out, refresh) exactly; only styling changes. The section header becomes a `sectionPill` `<Text>`, each item a `comicCard` `Pressable`, the screen background `paper`, and the nav/sign-out use the accent color.

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listDigest } from '../src/client/data';
import { formatRelativeTime, groupFeed } from '../src/client/feed';
import { supabase } from '../src/client/supabase';
import { colors, spacing, styles as t, type } from '../src/client/theme';
import type { FeedItem } from '../src/client/types';

export default function Today() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await listDigest()); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

  const { paid, hackerNews } = groupFeed(items, Date.now());
  const sections = [
    { title: '📧 付費訂閱', data: paid },
    { title: '🟠 Hacker News', data: hackerNews },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={t.screenBg}>
      <Stack.Screen
        options={{
          title: 'Today',
          headerStyle: { backgroundColor: colors.paper },
          headerTitleStyle: t.headerTitle,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Link href="/sources"><Text style={{ color: colors.accent, fontWeight: '700' }}>Sources</Text></Link>
              <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => supabase.auth.signOut()}>Sign out</Text>
            </View>
          ),
        }}
      />
      <SectionList
        contentContainerStyle={{ padding: spacing.lg }}
        sections={sections}
        keyExtractor={(i) => i.articleId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={{ color: colors.muted }}>Nothing new today. Pull to refresh.</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={[t.sectionPill, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <Link href={`/article/${item.articleId}`} asChild>
            <Pressable style={[t.comicCard, { padding: spacing.md }]}>
              <Text style={type.title}>{item.title}</Text>
              <Text numberOfLines={4} style={[type.summary, { marginTop: spacing.xs }]}>{item.summary}</Text>
              <Text style={[type.meta, { marginTop: spacing.sm }]}>
                {item.sourceTitle} · {formatRelativeTime(item.publishedAt, Date.now())}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/index.tsx
git commit -m "feat: comic-lite styling for the Today feed"
```

---

## Task 4: Restyle the article detail (RN; manual-verified)

**Files:**
- Modify: `app/article/[id].tsx`

- [ ] **Step 1: Replace `app/article/[id].tsx` with the themed version**

Keep `getFeedItem`, the image rendering, and "Open original" behavior; only styling changes. "Open original" becomes a `comicButton` `Pressable`; the summary sits in a `comicCard`; screen background `paper`.

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFeedItem } from '../../src/client/data';
import { colors, spacing, styles as t, type } from '../../src/client/theme';
import type { FeedItem } from '../../src/client/types';

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedItem(String(id)).then(setItem).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  if (!item) return <Text style={{ padding: spacing.lg, color: colors.ink }}>Not found.</Text>;

  return (
    <ScrollView style={t.screenBg} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>{item.title}</Text>
      <Text style={type.meta}>{item.sourceTitle}</Text>
      <View style={[t.comicCard, { padding: spacing.md }]}>
        <Text style={type.body}>{item.summary}</Text>
      </View>
      {item.imageUrls.map((uri) => (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="contain"
          style={{
            width: '100%', height: 240, borderRadius: 10,
            borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#f2f2f2',
          }}
        />
      ))}
      <Pressable style={t.comicButton} onPress={() => Linking.openURL(item.url)}>
        <Text style={t.comicButtonText}>Open original</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/article/[id].tsx
git commit -m "feat: comic-lite styling for the article detail"
```

---

## Task 5: Restyle source management (RN; manual-verified)

**Files:**
- Modify: `app/sources.tsx`

- [ ] **Step 1: Replace `app/sources.tsx` with the themed version**

Keep `httpGet`, `addSourceFromUrl`, `listSources`, `setSourceActive`, `removeSource`, `addHackerNews`, toggle/remove, and refresh exactly; only styling changes. Buttons become `comicButton` `Pressable`s; each source row a `comicCard`; the input gets the ink border; the screen background `paper`.

```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Switch, Text, TextInput, View } from 'react-native';
import { addSourceFromUrl, listSources, removeSource, setSourceActive } from '../src/client/data';
import { colors, spacing, styles as t, type } from '../src/client/theme';
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
  const [refreshing, setRefreshing] = useState(false);

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
  async function addHackerNews() {
    setBusy(true);
    try { await addSourceFromUrl('https://news.ycombinator.com/rss', httpGet); await load(); }
    catch (e: any) { Alert.alert("Couldn't add Hacker News", e.message); }
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

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

  return (
    <View style={[t.screenBg, { padding: spacing.lg, gap: spacing.md }]}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          placeholder="Paste an RSS / YouTube / Substack feed URL"
          autoCapitalize="none" value={url} onChangeText={setUrl}
          style={{ flex: 1, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 10, padding: 10, backgroundColor: colors.card }}
        />
        <Pressable style={[t.comicButton, { opacity: busy ? 0.6 : 1, justifyContent: 'center' }]} onPress={add} disabled={busy}>
          <Text style={t.comicButtonText}>{busy ? '…' : 'Add'}</Text>
        </Pressable>
      </View>
      <Pressable style={[t.comicButton, { backgroundColor: colors.ink, opacity: busy ? 0.6 : 1 }]} onPress={addHackerNews} disabled={busy}>
        <Text style={t.comicButtonText}>+ Add Hacker News</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={{ color: colors.muted }}>No sources yet — add one above.</Text>}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <View style={[t.comicCard, { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }]}>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{item.title || item.type}</Text>
              {item.lastError ? <Text style={{ color: colors.accent, fontSize: 12 }}>⚠ {item.lastError}</Text> : null}
            </View>
            <Switch value={item.isActive} onValueChange={() => toggle(item)} trackColor={{ true: colors.accent }} />
            <Pressable onPress={() => remove(item)}><Text style={{ color: colors.accent, fontWeight: '700' }}>Delete</Text></Pressable>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/sources.tsx
git commit -m "feat: comic-lite styling for source management"
```

---

## Task 6: Restyle sign-in (RN; manual-verified)

**Files:**
- Modify: `app/sign-in.tsx`

- [ ] **Step 1: Replace `app/sign-in.tsx` with the themed version**

Keep the magic-link logic (`isValidEmail`, `Linking.createURL('/')`, `signInWithOtp`) exactly; only styling changes. Title in display font; input ink-bordered; "Send magic link" a `comicButton`.

```tsx
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../src/client/supabase';
import { isValidEmail } from '../src/client/validation';
import { colors, spacing, styles as t } from '../src/client/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!isValidEmail(email)) { Alert.alert('Please enter a valid email'); return; }
    setBusy(true);
    const emailRedirectTo = Linking.createURL('/');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo } });
    setBusy(false);
    if (error) Alert.alert('Sign-in failed', error.message);
    else setSent(true);
  }

  return (
    <View style={[t.screenBg, { padding: spacing.xl, justifyContent: 'center', gap: spacing.md }]}>
      <Text style={[t.headerTitle, { fontSize: 40 }]}>AI Daily Digest</Text>
      {sent ? (
        <Text style={{ color: colors.ink }}>Check your email for the magic link.</Text>
      ) : (
        <>
          <TextInput
            placeholder="you@example.com"
            autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail}
            style={{ borderWidth: 2.5, borderColor: colors.ink, borderRadius: 10, padding: 12, backgroundColor: colors.card }}
          />
          <Pressable style={[t.comicButton, { opacity: busy ? 0.6 : 1 }]} onPress={send} disabled={busy}>
            <Text style={t.comicButtonText}>{busy ? 'Sending…' : 'Send magic link'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Confirm gates + commit**

Run: `npm test && npm run typecheck`
```bash
git add app/sign-in.tsx
git commit -m "feat: comic-lite styling for sign-in"
```

---

## Task 7: Live verification (user-run)

- [ ] 7.1 Rebuild the iOS app (Xcode ▶︎ Run, Release) and/or `npm start` → press `w` for web; confirm all four screens show the comic-lite look (bold ink borders, hard offset shadows, paper background, red accent) and that the "Today"/"AI Daily Digest" headers use the Bangers comic font (Latin), while Chinese text stays readable.
- [ ] 7.2 Confirm everything still works: sign in, view feed (paid/HN sections), open an article + images + "Open original", add/toggle/delete a source, pull-to-refresh.

---

## Definition of Done

- `src/client/theme.ts` exists with comic-lite tokens, unit-tested; `npm test` + `npm run typecheck` green.
- All four screens import the theme and show the comic-lite look; Bangers loads for Latin headers with a system fallback; no behavior change.
- Verified live: the four screens look comic-lite and remain fully functional.
