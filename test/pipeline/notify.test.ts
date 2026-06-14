import { describe, it, expect } from 'vitest';
import { buildDigestMessage, chunk } from '../../src/pipeline/notify';

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
