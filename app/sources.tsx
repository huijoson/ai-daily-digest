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
