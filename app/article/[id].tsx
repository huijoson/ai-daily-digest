import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFeedItem } from '../../src/client/data';
import { neighbors } from '../../src/client/feed';
import { getFeedOrder } from '../../src/client/feedOrder';
import { colors, spacing, styles as t, type } from '../../src/client/theme';
import type { FeedItem } from '../../src/client/types';

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch on id change (prev/next reuse this same route). Reset state up front so a
  // navigation shows the loading state rather than the previous article's content.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItem(null);
    getFeedItem(String(id))
      .then((it) => { if (!cancelled) setItem(it); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const { prevId, nextId } = neighbors(getFeedOrder(), String(id));

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
      {item.url ? (
        <Pressable style={t.comicButton} onPress={() => Linking.openURL(item.url)}>
          <Text style={t.comicButtonText}>Open original</Text>
        </Pressable>
      ) : null}

      <View style={nav.row}>
        <Pressable
          disabled={!prevId}
          onPress={() => prevId && router.replace(`/article/${prevId}`)}
          style={[nav.btn, !prevId && nav.btnDisabled]}
        >
          <Text style={nav.btnText}>‹ 上一篇</Text>
        </Pressable>
        <Pressable
          disabled={!nextId}
          onPress={() => nextId && router.replace(`/article/${nextId}`)}
          style={[nav.btn, !nextId && nav.btnDisabled]}
        >
          <Text style={nav.btnText}>下一篇 ›</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const nav = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  btn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: colors.ink, fontWeight: '700' },
});
