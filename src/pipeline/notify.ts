import type { ExpoPushTicket, PushTokenRow, NotifyDeps } from './notify-types';

export function tokensToPrune(tickets: ExpoPushTicket[], tokens: PushTokenRow[]): string[] {
  const n = Math.min(tickets.length, tokens.length);
  const prune: string[] = [];
  for (let i = 0; i < n; i++) {
    if (tickets[i].status === 'error' && tickets[i].details?.error === 'DeviceNotRegistered') {
      prune.push(tokens[i].id);
    }
  }
  return prune;
}

export function buildDigestMessage(count: number): { title: string; body: string } {
  const noun = count === 1 ? 'summary' : 'summaries';
  return { title: 'AI Daily Digest', body: `${count} new ${noun} ready` };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const EXPO_PUSH_BATCH = 100; // Expo accepts up to 100 messages per request

export async function runNotify(deps: NotifyDeps): Promise<{ sent: number; pruned: number }> {
  const digests = await deps.db.listUserDigests();
  let sent = 0;
  let pruned = 0;
  for (const digest of digests) {
    if (digest.newCount <= 0) continue;
    const tokens = await deps.db.listPushTokens(digest.userId);
    if (tokens.length === 0) continue;
    const message = buildDigestMessage(digest.newCount);
    const pruneIds: string[] = [];
    for (const group of chunk(tokens, EXPO_PUSH_BATCH)) {
      const messages = group.map((t) => ({ to: t.expoToken, title: message.title, body: message.body }));
      const tickets = await deps.send(messages);
      sent += messages.length;
      pruneIds.push(...tokensToPrune(tickets, group));
    }
    if (pruneIds.length > 0) {
      await deps.db.deletePushTokens(pruneIds);
      pruned += pruneIds.length;
    }
  }
  return { sent, pruned };
}
