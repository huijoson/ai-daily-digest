import type { ParsedArticle } from './types';

/**
 * Filter out articles already stored, and drop within-batch duplicates.
 *
 * IMPORTANT: database uniqueness is per `(source_id, guid)`, so `existingGuids`
 * MUST be the guids already stored FOR THE SAME SOURCE. Passing a cross-source
 * guid set would incorrectly drop a syndicated article that legitimately appears
 * under more than one source.
 */
export function filterNewArticles(
  parsed: ParsedArticle[],
  existingGuids: Iterable<string>,
): ParsedArticle[] {
  const seen = new Set(existingGuids);
  const out: ParsedArticle[] = [];
  for (const article of parsed) {
    if (seen.has(article.guid)) continue;
    seen.add(article.guid); // also dedup within this batch
    out.push(article);
  }
  return out;
}
