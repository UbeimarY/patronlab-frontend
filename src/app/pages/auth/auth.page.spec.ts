import { describe, expect, it } from 'vitest';

import { passwordStrength } from './auth.page';

describe('passwordStrength', () => {
  it('asks for 8 characters and counts what is missing', () => {
    expect(passwordStrength('').level).toBe(0);
    const short = passwordStrength('abc12');
    expect(short.level).toBe(1);
    expect(short.label).toContain('faltan 3');
  });

  it('rates length and variety of characters', () => {
    expect(passwordStrength('abcdefgh').level).toBe(2);
    expect(passwordStrength('abcdefgh1234').level).toBe(3);
    expect(passwordStrength('Mopa-Mopa2026').level).toBe(4);
  });
});
