import { describe, it, expect } from 'vitest';
import { filterNewArticles } from '../../src/feed/dedup';
import type { ParsedArticle } from '../../src/feed/types';

const a = (guid: string): ParsedArticle => ({ guid, title: guid, url: 'u', publishedAt: null });

describe('filterNewArticles', () => {
  it('drops articles whose guid already exists', () => {
    const out = filterNewArticles([a('1'), a('2'), a('3')], ['2']);
    expect(out.map((x) => x.guid)).toEqual(['1', '3']);
  });

  it('drops duplicates within the same batch', () => {
    const out = filterNewArticles([a('1'), a('1'), a('2')], []);
    expect(out.map((x) => x.guid)).toEqual(['1', '2']);
  });

  it('returns nothing when everything is already known (idempotent re-run)', () => {
    const out = filterNewArticles([a('1'), a('2')], ['1', '2']);
    expect(out).toEqual([]);
  });
});
