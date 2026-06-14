import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Linking, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getFeedItem } from '../../src/client/data';
import type { FeedItem } from '../../src/client/types';

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeedItem(String(id)).then(setItem).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!item) return <Text style={{ padding: 16 }}>Not found.</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>{item.title}</Text>
      <Text style={{ color: '#888' }}>{item.sourceTitle}</Text>
      <Text style={{ fontSize: 16, lineHeight: 24 }}>{item.summary}</Text>
      <Button title="Open original" onPress={() => Linking.openURL(item.url)} />
    </ScrollView>
  );
}
