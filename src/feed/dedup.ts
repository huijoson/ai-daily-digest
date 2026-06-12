import type { ParsedArticle } from './types';

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
