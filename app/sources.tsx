import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, RefreshControl, Switch, Text, TextInput, View } from 'react-native';
import { addSourceFromUrl, listSources, removeSource, setSourceActive } from '../src/client/data';
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

  async function toggle(item: SourceListItem) {
    try { await setSourceActive(item.id, !item.isActive); await load(); }
    catch (e: any) { Alert.alert('Update failed', e.message); }
  }

  async function remove(item: SourceListItem) {
    try { await removeSource(item.id); await load(); }
    catch (e: any) { Alert.alert('Delete failed', e.message); }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          placeholder="Paste an RSS / YouTube / Substack feed URL"
          autoCapitalize="none" value={url} onChangeText={setUrl}
          style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        />
        <Button title={busy ? '…' : 'Add'} onPress={add} disabled={busy} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        ListEmptyComponent={<Text style={{ color: '#888' }}>No sources yet — add one above.</Text>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '500' }}>{item.title || item.type}</Text>
              {item.lastError ? <Text style={{ color: '#c00', fontSize: 12 }}>⚠ {item.lastError}</Text> : null}
            </View>
            <Switch value={item.isActive} onValueChange={() => toggle(item)} />
            <Button title="Delete" color="#c00" onPress={() => remove(item)} />
          </View>
        )}
      />
    </View>
  );
}
