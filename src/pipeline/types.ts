import type { ParsedArticle, SourceType } from '../feed/types';

/** A source row as the pipeline needs it (subset of the DB row). */
export interface SourceRow {
  id: string;
  type: SourceType;
  feedUrl: string | null;
}

/** An article awaiting summarization, with whatever content we have. */
export interface PendingSummary {
  articleId: string;
  title: string;
  url: string;
  content: string | null;
}

export interface SummaryResult {
  text: string;
  model: string;
}

/** Provider-agnostic summarizer: the seam that hides the LLM. */
export type Summarizer = (input: {
  title: string;
  url: string;
  content: string | null;
}) => Promise<SummaryResult>;

/** Minimal HTTP GET returning the response body as text. Injected for testability. */
export type HttpGet = (url: string) => Promise<string>;

/** The database operations the pipeline needs. Implemented by supabase-js in Deno (Task 7),
 *  and by an in-memory fake in the unit tests. */
export interface DbClient {
  listActiveSources(): Promise<SourceRow[]>;
  /** Guids already stored FOR THIS SOURCE — uniqueness is per (source_id, guid). */
  existingGuids(sourceId: string): Promise<string[]>;
  /** Insert new articles and a 'pending' summary row for each; returns the number inserted. */
  insertNewArticles(sourceId: string, articles: ParsedArticle[]): Promise<number>;
  /** Set or clear (null) the source's last_error. */
  recordSourceError(sourceId: string, error: string | null): Promise<void>;
  /** Up to `limit` summaries in 'pending' or 'failed' state, with article fields, oldest first. */
  listPendingSummaries(limit: number): Promise<PendingSummary[]>;
  /** Persist a successful summary and mark it 'done'. */
  saveSummary(articleId: string, result: SummaryResult): Promise<void>;
  /** Mark a summary 'failed' and increment its attempt counter. */
  markSummaryFailed(articleId: string): Promise<void>;
}

export interface FetchDeps {
  db: DbClient;
  httpGet: HttpGet;
}

export interface SummarizeDeps {
  db: DbClient;
  summarize: Summarizer;
  batchSize: number;
}
