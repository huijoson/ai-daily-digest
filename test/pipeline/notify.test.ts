import { describe, it, expect } from 'vitest';
import { buildDigestMessage, chunk, tokensToPrune } from '../../src/pipeline/notify';
import type { ExpoPushTicket, PushTokenRow } from '../../src/pipeline/notify-types';

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
