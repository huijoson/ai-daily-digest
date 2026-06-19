import { supabase } from './supabase';
import { prepareSource, mapSourceRow } from './sources';
import { mapFeedRow } from './feed';
import type { HttpGet } from '../pipeline/types';
import type { SourceListItem, FeedItem } from './types';
import { HN_MAX_AGE_MS } from '../pipeline/constants';
import { MAX_PAID_ITEMS } from './constants';

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

/**
 * Feed items for the digest: ALL completed paid (email) summaries (no time window,
 * so weekly paid posts persist) plus today's completed non-email summaries.
 * RLS limits rows to the current user. The screen's groupFeed re-splits + sorts.
 */
export async function listDigest(): Promise<FeedItem[]> {
  const sel = 'article_id, summary_text, articles!inner(title, url, published_at, image_urls, sources!inner(title, type))';

  const paidQ = await supabase
    .from('summaries')
    .select(sel)
    .eq('status', 'done')
    .eq('articles.sources.type', 'email')
    .order('updated_at', { ascending: false })
    .limit(MAX_PAID_ITEMS);
  if (paidQ.error) throw paidQ.error;

  const todayQ = await supabase
    .from('summaries')
    .select(sel)
    .eq('status', 'done')
    .neq('articles.sources.type', 'email')
    .gte('articles.published_at', new Date(Date.now() - HN_MAX_AGE_MS).toISOString())
    .order('published_at', { referencedTable: 'articles', ascending: false });
  if (todayQ.error) throw todayQ.error;

  return [...(paidQ.data ?? []), ...(todayQ.data ?? [])].map(mapFeedRow);
}

export async function getFeedItem(articleId: string): Promise<FeedItem | null> {
  const { data, error } = await supabase
    .from('summaries')
    .select('article_id, summary_text, articles(title, url, published_at, image_urls, sources(title, type))')
    .eq('article_id', articleId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapFeedRow(data) : null;
}
