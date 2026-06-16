import type { EmailMessage, EmailIngestDeps } from './types';
import type { ParsedArticle } from '../feed/types';
import { filterNewArticles } from '../feed/dedup';
import { MAX_ARTICLE_IMAGES } from './constants';

const SUBSTACK_POST_RE = /https?:\/\/[a-z0-9-]+\.substack\.com\/p\/[a-z0-9-]+/i;

function isContentImage(tag: string, src: string): boolean {
  let host: string;
  try { host = new URL(src).hostname.toLowerCase(); } catch { return false; }
  if (host === 'open.substack.com') return false;            // beacon host
  if (/\/open(\b|\/|\?)/.test(src)) return false;            // open beacon path
  const width = Number(/\bwidth\s*=\s*"?(\d+)"?/i.exec(tag)?.[1] ?? NaN);
  const height = Number(/\bheight\s*=\s*"?(\d+)"?/i.exec(tag)?.[1] ?? NaN);
  if (width === 1 || height === 1) return false;             // tracking pixel
  if (!src.includes('substackcdn.com/image/')) return false; // only CDN content images
  if (/[/,](c_fill|g_face|g_auto)\b/.test(src)) return false; // avatar/crop transforms
  if (/(\/profile\/|\/pub\/|logo|icon|button|favicon|avatars)/i.test(src)) return false;
  const w = /[/,]w_(\d+)/.exec(src);
  if (w && Number(w[1]) < 400) return false;                 // too small to be a chart
  return true;
}

/** Extract de-duplicated content image URLs from an email HTML body, excluding
 *  logos/avatars/tracking pixels, capped at MAX_ARTICLE_IMAGES. */
export function extractImageUrls(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const src = /\ssrc\s*=\s*"([^"]+)"/i.exec(tag)?.[1] ?? /\ssrc\s*=\s*'([^']+)'/i.exec(tag)?.[1];
    if (!src || seen.has(src)) continue;
    if (!isContentImage(tag, src)) continue;
    seen.add(src);
    out.push(src);
    if (out.length >= MAX_ARTICLE_IMAGES) break;
  }
  return out;
}

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
