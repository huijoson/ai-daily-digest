import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
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
            <Pressable style={StyleSheet.flatten([t.comicCard, { padding: spacing.md }])}>
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
