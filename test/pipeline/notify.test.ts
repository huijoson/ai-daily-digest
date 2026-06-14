import { describe, it, expect } from 'vitest';
import { buildDigestMessage, chunk, tokensToPrune, runNotify } from '../../src/pipeline/notify';
import type { ExpoPushTicket, PushTokenRow, ExpoPushMessage, NotifyDb, UserDigest } from '../../src/pipeline/notify-types';

describe('buildDigestMessage', () => {
  it('uses the singular for one summary', () => {
    expect(buildDigestMessage(1)).toEqual({ title: 'AI Daily Digest', body: '1 new summary ready' });
  });
  it('uses the plural for many', () => {
    expect(buildDigestMessage(12)).toEqual({ title: 'AI Daily Digest', body: '12 new summaries ready' });
  });
});

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns an empty array for empty input', () => {
    expect(chunk([], 100)).toEqual([]);
  });
  it('keeps everything in one group when smaller than the size', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]]);
  });
});

describe('tokensToPrune', () => {
  const tokens: PushTokenRow[] = [
    { id: 't1', expoToken: 'a' },
    { id: 't2', expoToken: 'b' },
    { id: 't3', expoToken: 'c' },
  ];

  it('returns ids of tokens whose ticket reports DeviceNotRegistered', () => {
    const tickets: ExpoPushTicket[] = [
      { status: 'ok', id: 'x' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ];
    expect(tokensToPrune(tickets, tokens)).toEqual(['t2']);
  });

  it('returns nothing when all succeed', () => {
    const tickets: ExpoPushTicket[] = [{ status: 'ok' }, { status: 'ok' }, { status: 'ok' }];
    expect(tokensToPrune(tickets, tokens)).toEqual([]);
  });

  it('ignores tickets beyond the token list length', () => {
    const tickets: ExpoPushTicket[] = [{ status: 'error', details: { error: 'DeviceNotRegistered' } }];
    expect(tokensToPrune(tickets, tokens)).toEqual(['t1']);
  });
});

function makeDb(digests: UserDigest[], tokensByUser: Record<string, PushTokenRow[]>) {
  const deleted: string[] = [];
  const db: NotifyDb = {
    listUserDigests: async () => digests,
    listPushTokens: async (userId) => tokensByUser[userId] ?? [],
    deletePushTokens: async (ids) => { deleted.push(...ids); },
  };
  return { db, deleted };
}

describe('runNotify', () => {
  it('sends one message per token with the digest body and counts sends', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 3 }], { u1: [{ id: 't1', expoToken: 'a' }, { id: 't2', expoToken: 'b' }] });
    const sent: ExpoPushMessage[] = [];
    const send = async (msgs: ExpoPushMessage[]) => { sent.push(...msgs); return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(sent).toEqual([
      { to: 'a', title: 'AI Daily Digest', body: '3 new summaries ready' },
      { to: 'b', title: 'AI Daily Digest', body: '3 new summaries ready' },
    ]);
    expect(res).toEqual({ sent: 2, pruned: 0 });
  });

  it('skips a user with no tokens and does not send', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 5 }], { u1: [] });
    let calls = 0;
    const send = async (msgs: ExpoPushMessage[]) => { calls++; return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(calls).toBe(0);
    expect(res).toEqual({ sent: 0, pruned: 0 });
  });

  it('does not send when newCount is zero', async () => {
    const { db } = makeDb([{ userId: 'u1', newCount: 0 }], { u1: [{ id: 't1', expoToken: 'a' }] });
    let calls = 0;
    const send = async (msgs: ExpoPushMessage[]) => { calls++; return msgs.map(() => ({ status: 'ok' as const })); };
    const res = await runNotify({ db, send });
    expect(calls).toBe(0);
    expect(res).toEqual({ sent: 0, pruned: 0 });
  });

  it('prunes tokens reported DeviceNotRegistered', async () => {
    const { db, deleted } = makeDb([{ userId: 'u1', newCount: 1 }], { u1: [{ id: 't1', expoToken: 'a' }, { id: 't2', expoToken: 'b' }] });
    const send = async (_msgs: ExpoPushMessage[]) => [
      { status: 'ok' as const },
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
    ];
    const res = await runNotify({ db, send });
    expect(deleted).toEqual(['t2']);
    expect(res).toEqual({ sent: 2, pruned: 1 });
  });
});
