import type { SummarizeDeps } from './types';

export async function runSummarize(deps: SummarizeDeps): Promise<{ done: number; failed: number }> {
  const pending = await deps.db.listPendingSummaries(deps.batchSize);
  let done = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      const result = await deps.summarize({ title: item.title, url: item.url, content: item.content, sourceType: item.sourceType, imageUrls: item.imageUrls });
      await deps.db.saveSummary(item.articleId, result);
      done += 1;
    } catch {
      await deps.db.markSummaryFailed(item.articleId);
      failed += 1;
    }
  }
  return { done, failed };
}
