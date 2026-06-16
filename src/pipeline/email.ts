import type { EmailMessage, EmailIngestDeps } from './types';
import type { ParsedArticle } from '../feed/types';
import { filterNewArticles } from '../feed/dedup';

const SUBSTACK_POST_RE = /https?:\/\/[a-z0-9-]+\.substack\.com\/p\/[a-z0-9-]+/i;

export function parseSubstackEmail(msg: EmailMessage): ParsedArticle {
  const url = msg.html.match(SUBSTACK_POST_RE)?.[0] ?? '';
  const content = msg.text.trim();
  return {
    guid: msg.messageId,
    title: msg.subject.trim(),
    url,
    publishedAt: msg.date,
    content: content.length > 0 ? content : null,
  };
}

export async function runEmailIngest(deps: EmailIngestDeps): Promise<{ inserted: number; errors: number }> {
  const sources = (await deps.db.listActiveSources()).filter((s) => s.type === 'email');
  let inserted = 0;
  let errors = 0;
  for (const source of sources) {
    try {
      if (!source.feedUrl) throw new Error(`email source ${source.id} has no sender address`);
      const messages = await deps.fetchEmails(source.feedUrl);
      const parsed = messages.map(parseSubstackEmail);
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
