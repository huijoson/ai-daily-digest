import type { SourceType } from './types';

export function detectSourceType(url: string): SourceType {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (host === 'news.ycombinator.com') return 'hackernews';
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  return 'rss';
}
