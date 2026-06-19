import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listDigest } from '../src/client/data';
import { buildFeedSections, formatRelativeTime, scrollFailureOffset } from '../src/client/feed';
import { setFeedOrder } from '../src/client/feedOrder';
import { supabase } from '../src/client/supabase';
import { colors, spacing, styles as t, type } from '../src/client/theme';
import type { FeedItem } from '../src/client/types';

export default function Today() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<SectionList<FeedItem>>(null);
  const lastJump = useRef(0);
  const retryCount = useRef(0);

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
    lastJump.current = sectionIndex;
    retryCount.current = 0;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewOffset: 8, animated: true });
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
      <SectionList
        ref={listRef}
        contentContainerStyle={{ padding: spacing.lg }}
        sections={sections}
        keyExtractor={(i) => i.articleId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={{ color: colors.muted }}>Nothing new today. Pull to refresh.</Text>}
        onScrollToIndexFailed={(info) => {
          // Bounded recovery: a target section may not be measured yet on iOS. Scroll
          // toward an estimated offset to force measurement, then re-issue the jump.
          if (retryCount.current >= 3) return;
          retryCount.current += 1;
          listRef.current?.getScrollResponder()?.scrollTo({ y: scrollFailureOffset(info), animated: false });
          setTimeout(() => {
            listRef.current?.scrollToLocation({ sectionIndex: lastJump.current, itemIndex: 0, viewOffset: 8, animated: true });
          }, 250);
        }}
        renderSectionHeader={({ section }) => (
          <Text style={[t.sectionPill, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>{section.title}</Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <Link href={`/article/${item.articleId}`} asChild>
            <Pressable style={StyleSheet.flatten([t.comicCard, { padding: spacing.md }])}>
              <Text style={type.title}>{item.title}</Text>
              <Text numberOfLines={6} style={[type.summary, { marginTop: spacing.xs }]}>{item.summary}</Text>
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
