import { describe, it, expect } from 'vitest';
import { colors, border, radii, spacing, shadowHard, fonts, type, styles } from '../../src/client/theme';

describe('comic-lite theme tokens', () => {
  it('has string colors incl ink/paper/accent', () => {
    for (const k of ['ink', 'paper', 'card', 'accent', 'muted', 'subtle'] as const) {
      expect(typeof colors[k]).toBe('string');
      expect(colors[k]).toMatch(/^#/);
    }
  });
  it('uses a blur-less hard shadow (the comic look)', () => {
    expect(shadowHard.shadowRadius).toBe(0);
    expect(shadowHard.shadowOffset.width).toBeGreaterThan(0);
    expect(shadowHard.shadowOpacity).toBe(1);
  });
  it('has a visible ink border', () => {
    expect(border.width).toBeGreaterThan(0);
    expect(border.color).toBe(colors.ink);
  });
  it('defines a non-empty display font family', () => {
    expect(typeof fonts.displayFamily).toBe('string');
    expect(fonts.displayFamily.length).toBeGreaterThan(0);
  });
  it('comicCard is white with the ink border and hard shadow', () => {
    expect(styles.comicCard.backgroundColor).toBe(colors.card);
    expect(styles.comicCard.borderColor).toBe(colors.ink);
    expect(styles.comicCard.shadowRadius).toBe(0);
  });
  it('exposes spacing, radii, and type scales', () => {
    expect(spacing.md).toBeGreaterThan(0);
    expect(radii.card).toBeGreaterThan(0);
    expect(type.title.fontSize).toBeGreaterThan(type.meta.fontSize);
  });
});
