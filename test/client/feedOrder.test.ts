import { describe, it, expect } from 'vitest';
import { setFeedOrder, getFeedOrder } from '../../src/client/feedOrder';

describe('feedOrder store', () => {
  it('defaults to an empty array before any set', () => {
    expect(getFeedOrder()).toEqual([]);
  });

  it('returns the stored ids after setFeedOrder', () => {
    setFeedOrder(['x', 'y']);
    expect(getFeedOrder()).toEqual(['x', 'y']);
  });

  it('stores a copy so later mutation of the input does not corrupt it', () => {
    const ids = ['a', 'b'];
    setFeedOrder(ids);
    ids.push('c');
    expect(getFeedOrder()).toEqual(['a', 'b']);
  });
});
