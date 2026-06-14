import { createNotifyDb, createExpoPushSender } from '../_shared/notify-db.ts';
import { runNotify } from '../../../src/pipeline/notify.ts';

Deno.serve(async () => {
  const db = createNotifyDb(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const result = await runNotify({ db, send: createExpoPushSender() });
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
});
