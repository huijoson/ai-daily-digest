import type { Summarizer } from './types';
import type { SourceType } from '../feed/types';
import { MAX_ARTICLE_IMAGES } from './constants';

export const GEMINI_MODEL = 'gemini-2.5-flash';

const SUPPORTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** Normalize an HTTP Content-Type to a Gemini-supported image MIME, or null. */
export function supportedImageMime(contentType: string | null | undefined): string | null {
  if (!contentType) return null;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return SUPPORTED_IMAGE_MIME.includes(mime) ? mime : null;
}

export function buildSummaryPrompt(
  input: { title: string; url: string; content: string | null },
  mode: 'brief' | 'analysis' = 'brief',
  hasImages = false,
): string {
  const body = input.content?.trim()
    ? input.content.trim()
    : '(no content provided; summarize based on the title and link)';
  const analysisInstructions = [
    'Summarize the following paid article for a daily digest.',
    'Write the summary in the same language as the article.',
    'Format (no preamble, no markdown headers): first one sentence stating the core takeaway,',
    'then 3-6 bullet points (each line starting with "- ") covering the key points,',
    'then one short paragraph of analysis and implications.',
    'Be factual; ground the analysis in the article.',
  ];
  if (hasImages) {
    analysisInstructions.push(
      "The article's charts/figures are attached as images; read the data they show and incorporate it into the takeaway, key points, and analysis.",
    );
  }
  const instructions = mode === 'analysis'
    ? analysisInstructions
    : [
        'Summarize the following article in 2-3 concise sentences for a daily digest.',
        'Write the summary in the same language as the article.',
        'Be factual and neutral. Do not add any preamble or markdown.',
      ];
  return [...instructions, '', `Title: ${input.title}`, `URL: ${input.url}`, '', 'Content:', body].join('\n');
}

export interface GeminiImage { mimeType: string; base64: string }

/** Build the Gemini request `parts` array: the text prompt followed by one
 *  inline_data part per image. The caller wraps it as { contents: [{ parts }] }. */
export function buildGeminiContents(promptText: string, images: GeminiImage[]): unknown[] {
  const parts: unknown[] = [{ text: promptText }];
  for (const img of images) parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
  return parts;
}

export function parseGeminiResponse(json: unknown): string {
  const text = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Gemini response missing text');
  }
  return text.trim();
}

export interface GeminiDeps {
  apiKey: string;
  httpPostJson: (
    url: string,
    body: unknown,
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
  fetchImage?: (url: string) => Promise<GeminiImage | null>;
}

export function createGeminiSummarizer(deps: GeminiDeps): Summarizer {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${deps.apiKey}`;
  const mode = (input: { sourceType: SourceType }) => (input.sourceType === 'email' ? 'analysis' : 'brief');
  const post = async (input: Parameters<Summarizer>[0], images: GeminiImage[]) => {
    const parts = buildGeminiContents(buildSummaryPrompt(input, mode(input), images.length > 0), images);
    const res = await deps.httpPostJson(endpoint, { contents: [{ parts }] });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    return { text: parseGeminiResponse(await res.json()), model: GEMINI_MODEL };
  };
  return async (input) => {
    const wantImages = input.sourceType === 'email' && (input.imageUrls?.length ?? 0) > 0 && !!deps.fetchImage;
    if (wantImages) {
      const fetched = await Promise.all(
        input.imageUrls!.slice(0, MAX_ARTICLE_IMAGES).map((u) => deps.fetchImage!(u).catch(() => null)),
      );
      const images = fetched.filter((x): x is GeminiImage => x != null);
      if (images.length > 0) {
        try { return await post(input, images); }
        catch { /* multimodal failed -> text-only fallback below */ }
      }
    }
    return await post(input, []);
  };
}
