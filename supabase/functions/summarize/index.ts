import { createSupabaseDbClient } from '../_shared/db.ts';
import { runSummarize } from '../../../src/pipeline/run-summarize.ts';
import { createGeminiSummarizer } from '../../../src/pipeline/summarize.ts';

const BATCH_SIZE = 10;

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
  });
  const result = await runSummarize({ db, summarize, batchSize: BATCH_SIZE });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
