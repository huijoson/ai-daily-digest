/**
 * Local pipeline runner — runs the SAME tested pipeline logic (runFetch +
 * runSummarize) against your cloud Supabase, using a Node Supabase client +
 * the Gemini summarizer. No Docker, no Edge Function deploy needed.
 *
 * Run:  npx tsx scripts/run-pipeline.ts
 * Reads keys from .env (EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GEMINI_API_KEY). The service-role key bypasses RLS so the pipeline can write
 * articles/summaries — exactly like the real Edge Functions do.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { runFetch } from '../src/pipeline/run-fetch';
import { runSummarize } from '../src/pipeline/run-summarize';
import { createGeminiSummarizer } from '../src/pipeline/summarize';
import type { DbClient, HttpGet, PendingSummary, SourceRow } from '../src/pipeline/types';
import type { ParsedArticle } from '../src/feed/types';

// --- load .env (minimal parser, no extra deps) ---
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
if (!url || !serviceRole || !geminiKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY in .env');
}

const sb = createClient(url, serviceRole, { auth: { persistSession: false } });

// --- DbClient backed by supabase-js (service role) ---
function one<T>(v: T | T[] | null | undefined): T | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const db: DbClient = {
  async listActiveSources(): Promise<SourceRow[]> {
    const { data, error } = await sb.from('sources').select('id, type, feed_url').eq('is_active', true);
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, type: r.type, feedUrl: r.feed_url }));
  },
  async existingGuids(sourceId: string): Promise<string[]> {
    const { data, error } = await sb.from('articles').select('guid').eq('source_id', sourceId);
    if (error) throw error;
    return (data ?? []).map((r) => r.guid);
  },
  async insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number> {
    if (articles.length === 0) return 0;
    const { data, error } = await sb.from('articles').insert(
      articles.map((a) => ({
        source_id: sourceId, guid: a.guid, title: a.title, url: a.url, published_at: a.publishedAt,
      })),
    ).select('id');
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { error: sErr } = await sb.from('summaries').insert(ids.map((id) => ({ article_id: id, status: 'pending' })));
      if (sErr) throw sErr;
    }
    return ids.length;
  },
  async recordSourceError(sourceId: string, errorText: string | null): Promise<void> {
    const { error } = await sb.from('sources').update({ last_error: errorText }).eq('id', sourceId);
    if (error) throw error;
  },
  async listPendingSummaries(limit: number): Promise<PendingSummary[]> {
    const { data, error } = await sb.from('summaries')
      .select('article_id, articles(title, url)')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r: any) => {
      const article = one<any>(r.articles);
      return { articleId: r.article_id, title: article?.title ?? '', url: article?.url ?? '', content: null };
    });
  },
  async saveSummary(articleId, result): Promise<void> {
    const { error } = await sb.from('summaries')
      .update({ summary_text: result.text, model: result.model, status: 'done', updated_at: new Date().toISOString() })
      .eq('article_id', articleId);
    if (error) throw error;
  },
  async markSummaryFailed(articleId): Promise<void> {
    const { error } = await sb.from('summaries')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('article_id', articleId);
    if (error) throw error;
  },
};

const httpGet: HttpGet = async (u) => {
  const res = await fetch(u, { headers: { 'user-agent': 'ai-daily-digest/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${u}`);
  return res.text();
};

const summarize = createGeminiSummarizer({
  apiKey: geminiKey,
  httpPostJson: async (u, body) => {
    const res = await fetch(u, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, json: () => res.json() };
  },
});

// --- run it ---
async function main() {
  console.log('1/2  Fetching feeds…');
  console.log('     ', await runFetch({ db, httpGet }));
  console.log('2/2  Summarizing with Gemini (up to 8)…');
  console.log('     ', await runSummarize({ db, summarize, batchSize: 8 }));
  console.log('Done. Refresh the app to see today\'s summaries.');
}

main().catch((e) => {
  console.error('Pipeline failed:', e);
  process.exit(1);
});
