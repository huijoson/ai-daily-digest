import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ParsedArticle } from '../../../src/feed/types.ts';
import type { DbClient, PendingSummary, SourceRow, SummaryResult } from '../../../src/pipeline/types.ts';
import { HN_MAX_AGE_MS } from '../../../src/pipeline/constants.ts';

/** Stop retrying a summary after this many failed attempts. */
export const MAX_SUMMARY_ATTEMPTS = 5;

export function createSupabaseDbClient(url: string, serviceRoleKey: string): DbClient {
  const sb: SupabaseClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  return {
    async listActiveSources(): Promise<SourceRow[]> {
      const { data, error } = await sb.from('sources')
        .select('id, type, feed_url')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, type: r.type, feedUrl: r.feed_url }));
    },

    async existingGuids(sourceId: string): Promise<string[]> {
      const { data, error } = await sb.from('articles')
        .select('guid')
        .eq('source_id', sourceId);
      if (error) throw error;
      return (data ?? []).map((r) => r.guid);
    },

    async insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number> {
      if (articles.length === 0) return 0;
      const { data, error } = await sb.from('articles')
        .insert(articles.map((a) => ({
          source_id: sourceId,
          guid: a.guid,
          title: a.title,
          url: a.url,
          published_at: a.publishedAt,
          content: a.content ?? null,
          image_urls: a.imageUrls ?? null,
        })))
        .select('id');
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.id);
      if (ids.length > 0) {
        const { error: sErr } = await sb.from('summaries')
          .insert(ids.map((articleId) => ({ article_id: articleId, status: 'pending' })));
        if (sErr) throw sErr;
      }
      return ids.length;
    },

    async recordSourceError(sourceId: string, errorText: string | null): Promise<void> {
      const { error } = await sb.from('sources').update({ last_error: errorText }).eq('id', sourceId);
      if (error) throw error;
    },

    async listPendingSummaries(limit: number): Promise<PendingSummary[]> {
      const sel = 'article_id, articles!inner(title, url, content, image_urls, sources!inner(type))';
      const mapRow = (r: any): PendingSummary => {
        const article = Array.isArray(r.articles) ? r.articles[0] : r.articles;
        const source = Array.isArray(article?.sources) ? article.sources[0] : article?.sources;
        return {
          articleId: r.article_id,
          title: article?.title ?? '',
          url: article?.url ?? '',
          content: article?.content ?? null,
          imageUrls: article?.image_urls ?? [],
          sourceType: source?.type ?? 'rss',
        };
      };
      // Prioritize paid email content: take email-source pending first, then the rest.
      const emailQ = await sb.from('summaries').select(sel)
        .in('status', ['pending', 'failed']).lt('attempts', MAX_SUMMARY_ATTEMPTS)
        .eq('articles.sources.type', 'email')
        .order('created_at', { ascending: true }).limit(limit);
      if (emailQ.error) throw emailQ.error;
      let rows = emailQ.data ?? [];
      if (rows.length < limit) {
        const restQ = await sb.from('summaries').select(sel)
          .in('status', ['pending', 'failed']).lt('attempts', MAX_SUMMARY_ATTEMPTS)
          .neq('articles.sources.type', 'email')
          .gte('articles.published_at', new Date(Date.now() - HN_MAX_AGE_MS).toISOString())
          .order('published_at', { referencedTable: 'articles', ascending: false })
          .limit(limit - rows.length);
        if (restQ.error) throw restQ.error;
        rows = rows.concat(restQ.data ?? []);
      }
      return rows.map(mapRow);
    },

    async saveSummary(articleId: string, result: SummaryResult): Promise<void> {
      const { error } = await sb.from('summaries')
        .update({ summary_text: result.text, model: result.model, status: 'done', updated_at: new Date().toISOString() })
        .eq('article_id', articleId);
      if (error) throw error;
    },

    async markSummaryFailed(articleId: string): Promise<void> {
      const { error } = await sb.rpc('increment_summary_failure', { p_article_id: articleId });
      if (error) throw error;
    },
  };
}
