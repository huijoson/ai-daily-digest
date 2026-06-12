export type SourceType = 'rss' | 'youtube' | 'hackernews';

export interface ParsedArticle {
  guid: string;
  title: string;
  url: string;
  publishedAt: string | null; // ISO 8601, or null if the feed omits a date
}

export interface HnItem {
  id: number;
  title?: string;
  url?: string;
  time?: number; // unix seconds
  type?: string;
}
