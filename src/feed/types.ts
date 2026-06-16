export type SourceType = 'rss' | 'youtube' | 'hackernews' | 'email';

export interface ParsedArticle {
  guid: string;
  title: string;
  url: string;
  publishedAt: string | null; // ISO 8601, or null if the feed omits a date
  content?: string | null;     // full text when available (e.g. email body); else unset/null
  imageUrls?: string[];
}

export interface HnItem {
  id: number;
  title?: string;
  url?: string;
  time?: number; // unix seconds
  type?: string;
}
