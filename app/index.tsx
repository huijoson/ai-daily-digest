import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { listTodaySummaries } from '../src/client/data';
import { formatRelativeTime } from '../src/client/feed';
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
