import { describe, it, expect } from 'vitest';
import { detectSourceType } from '../../src/feed/detect';

describe('detectSourceType', () => {
  it('detects Hacker News', () => {
    expect(detectSourceType('https://news.ycombinator.com/rss')).toBe('hackernews');
  });

  it('detects YouTube channel feeds', () => {
    expect(detectSourceType('https://www.youtube.com/feeds/videos.xml?channel_id=X')).toBe('youtube');
    expect(detectSourceType('https://youtu.be/abc')).toBe('youtube');
  });

  it('treats Substack and generic feeds as rss', () => {
    expect(detectSourceType('https://lenny.substack.com/feed')).toBe('rss');
    expect(detectSourceType('https://example.com/index.xml')).toBe('rss');
  });

  it('throws on an invalid URL', () => {
    expect(() => detectSourceType('not a url')).toThrow();
  });
});
