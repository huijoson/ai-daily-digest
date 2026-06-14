import type { ExpoPushTicket, PushTokenRow } from './notify-types';

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
