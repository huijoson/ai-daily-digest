import { supabase } from './supabase';
import { prepareSource, mapSourceRow } from './sources';
import { mapFeedRow } from './feed';
import type { HttpGet } from '../pipeline/types';
import type { SourceListItem, FeedItem } from './types';

// ── Sources ──────────────────────────────────────────────────────────────────

export async function addSourceFromUrl(url: string, httpGet: HttpGet): Promise<void> {
  const prepared = await prepareSource(url, httpGet);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { error } = await supabase.from('sources').insert({
    user_id: userId,
    type: prepared.type, feed_url: prepared.feedUrl, title: prepared.title, is_active: true,
  });
  if (error) throw error;
}

export async function listSources(): Promise<SourceListItem[]> {
  const { data, error } = await supabase
    .from('sources').select('id, type, title, is_active, last_error')
    .order('title', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSourceRow);
}

export async function setSourceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('sources').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}

export async function removeSource(id: string): Promise<void> {
  const { error } = await supabase.from('sources').delete().eq('id', id);
  if (error) throw error;
}

// ── Feed ─────────────────────────────────────────────────────────────────────

/** Today's completed summaries, newest first. RLS limits rows to the current user. */
export async function listTodaySummaries(): Promise<FeedItem[]> {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('summaries')
    .select('article_id, summary_text, articles(title, url, published_at, sources(title, type))')
    .eq('status', 'done')
    .gte('updated_at', startOfToday.toISOString())
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapFeedRow);
}

export async function getFeedItem(articleId: string): Promise<FeedItem | null> {
  const { data, error } = await supabase
    .from('summaries')
    .select('article_id, summary_text, articles(title, url, published_at, sources(title, type))')
    .eq('article_id', articleId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFeedRow(data) : null;
}
