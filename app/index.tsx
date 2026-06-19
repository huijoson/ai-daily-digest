import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listDigest } from '../src/client/data';
import { buildFeedSections, formatRelativeTime, sectionScrollTarget } from '../src/client/feed';
import { setFeedOrder } from '../src/client/feedOrder';
import { supabase } from '../src/client/supabase';
import { colors, spacing, styles as t, type } from '../src/client/theme';
import type { FeedItem } from '../src/client/types';

const JUMP_INSET = 8;

export default function Today() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Section content offsets, keyed by stable section key (NOT array index) so they
  // survive refreshes: onLayout overwrites a moved section; unchanged sections keep a
  // valid entry; removed sections leave a stale entry that is never looked up.
  const offsets = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    try { setItems(await listDigest()); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => buildFeedSections(items, Date.now()), [items]);

  // Carry the feed's display order to the article screen for prev/next.
  useEffect(() => {
    setFeedOrder(sections.flatMap((s) => s.data.map((i) => i.articleId)));
  }, [sections]);

  const jumpTo = (sectionIndex: number) => {
    const key = sections[sectionIndex]?.key;
    if (key == null) return;
    scrollRef.current?.scrollTo({ y: sectionScrollTarget(offsets.current, key, JUMP_INSET), animated: true });
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;

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
      {sections.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}
          style={jumpBar.bar}
        >
          {sections.map((s, i) => (
            <Pressable
              key={s.key}
              onPress={() => jumpTo(i)}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              style={jumpBar.chip}
            >
              <Text numberOfLines={1} style={jumpBar.chipText}>{s.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
      >
        {sections.length === 0 ? (
          <Text style={{ color: colors.muted }}>Nothing new today. Pull to refresh.</Text>
        ) : (
          sections.map((s) => (
            <View key={s.key} onLayout={(e) => { offsets.current.set(s.key, e.nativeEvent.layout.y); }}>
              <Text style={[t.sectionPill, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>{s.title}</Text>
              {s.data.map((item, idx) => (
                <Link key={item.articleId} href={`/article/${item.articleId}`} asChild>
                  <Pressable style={StyleSheet.flatten([t.comicCard, { padding: spacing.md, marginTop: idx > 0 ? spacing.md : 0 }])}>
                    <Text style={type.title}>{item.title}</Text>
                    <Text numberOfLines={6} style={[type.summary, { marginTop: spacing.xs }]}>{item.summary}</Text>
                    <Text style={[type.meta, { marginTop: spacing.sm }]}>
                      {item.sourceTitle} · {formatRelativeTime(item.publishedAt, Date.now())}
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const jumpBar = StyleSheet.create({
  bar: {
    flexGrow: 0,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
    backgroundColor: colors.paper,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
