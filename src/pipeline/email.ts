import type { EmailMessage } from './types';
import type { ParsedArticle } from '../feed/types';

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
