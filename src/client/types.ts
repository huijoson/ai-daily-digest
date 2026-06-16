import type { SourceType } from '../feed/types';

export interface PreparedSource {
  type: SourceType;
  feedUrl: string | null;
  title: string;
}

export interface SourceListItem {
  id: string;
  type: SourceType;
  title: string;
  isActive: boolean;
  lastError: string | null;
}

export interface FeedItem {
  articleId: string;
  title: string;
  url: string;
  summary: string;
  sourceTitle: string;
  sourceType: SourceType;
  imageUrls: string[];
  publishedAt: string | null;
}
