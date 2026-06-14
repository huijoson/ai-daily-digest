import { describe, it, expect } from 'vitest';
import { isValidEmail } from '../../src/client/validation';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('first.last@sub.example.co')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('a@')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmail('  a@b.com  ')).toBe(true);
  });
});
