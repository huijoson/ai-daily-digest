import { createClient } from '@supabase/supabase-js';
import type {
  ExpoPushMessage, ExpoPushTicket, NotifyDb, PushSender, PushTokenRow, UserDigest,
} from '../../../src/pipeline/notify-types.ts';

export function createNotifyDb(url: string, serviceRoleKey: string): NotifyDb {
  const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return {
    async listUserDigests(): Promise<UserDigest[]> {
      const { data, error } = await sb.rpc('user_digests_today');
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ userId: r.user_id, newCount: Number(r.new_count) }));
    },
    async listPushTokens(userId: string): Promise<PushTokenRow[]> {
      const { data, error } = await sb.from('push_tokens').select('id, expo_token').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.id, expoToken: r.expo_token }));
    },
    async deletePushTokens(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const { error } = await sb.from('push_tokens').delete().in('id', ids);
      if (error) throw error;
    },
  };
}

/** Sends a batch (<=100) to the Expo push API and returns tickets in the same order. */
export function createExpoPushSender(): PushSender {
  return async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
    const json = await res.json();
    return (json.data ?? []) as ExpoPushTicket[];
  };
}
