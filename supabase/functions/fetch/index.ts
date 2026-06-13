import { createSupabaseDbClient } from '../_shared/db.ts';
import { runFetch } from '../../../src/pipeline/run-fetch.ts';
import type { HttpGet } from '../../../src/pipeline/types.ts';

const httpGet: HttpGet = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'ai-daily-digest/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

Deno.serve(async () => {
  const db = createSupabaseDbClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await runFetch({ db, httpGet });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
