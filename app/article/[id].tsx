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
