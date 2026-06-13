import { filterNewArticles } from '../feed/dedup';
import { fetchSource } from './fetch-source';
import type { FetchDeps } from './types';

export async function runFetch(deps: FetchDeps): Promise<{ inserted: number; errors: number }> {
  const sources = await deps.db.listActiveSources();
  let inserted = 0;
  let errors = 0;
  for (const source of sources) {
    try {
      const parsed = await fetchSource(source, deps.httpGet);
      // Existing guids are scoped to THIS source — uniqueness is per (source_id, guid).
      const existing = await deps.db.existingGuids(source.id);
      const fresh = filterNewArticles(parsed, existing);
      inserted += await deps.db.insertNewArticles(source.id, fresh);
      await deps.db.recordSourceError(source.id, null);
    } catch (e) {
      errors += 1;
      await deps.db.recordSourceError(source.id, e instanceof Error ? e.message : String(e));
    }
  }
  return { inserted, errors };
}
