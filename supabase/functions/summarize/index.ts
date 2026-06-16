import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { createSupabaseDbClient } from '../_shared/db.ts';
import { runSummarize } from '../../../src/pipeline/run-summarize.ts';
import { createGeminiSummarizer } from '../../../src/pipeline/summarize.ts';

const BATCH_SIZE = 10;

const SUPPORTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const fetchImage = async (url: string): Promise<{ mimeType: string; base64: string } | null> => {
  try {
    const res = await fetch(url, { headers: { Accept: 'image/png,image/jpeg,image/webp' } });
    if (!res.ok) return null;
    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!SUPPORTED_IMAGE_MIME.includes(mimeType)) return null;
    return { mimeType, base64: encodeBase64(new Uint8Array(await res.arrayBuffer())) };
  } catch {
    return null;
  }
};

Deno.serve(async () => {
  const db = createSupabaseDbClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const summarize = createGeminiSummarizer({
    apiKey: Deno.env.get('GEMINI_API_KEY')!,
    httpPostJson: async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, json: () => res.json() };
    },
    fetchImage,
  });
  const result = await runSummarize({ db, summarize, batchSize: BATCH_SIZE });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
