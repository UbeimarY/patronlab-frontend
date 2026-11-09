import { describe, expect, it } from 'vitest';

import { rulerSteps } from './rulers';

describe('rulerSteps', () => {
  it('uses millimeter ticks when zoomed in', () => {
    expect(rulerSteps(8)).toEqual({ minor: 1, label: 10 });
  });

  it('switches to coarser round steps when zoomed out', () => {
    expect(rulerSteps(0.5)).toEqual({ minor: 20, label: 100 });
  });

  it('always labels a multiple of the minor tick', () => {
    for (const ppm of [0.2, 0.7, 1.3, 2, 3.7, 6]) {
      const { minor, label } = rulerSteps(ppm);
      expect(label % minor).toBe(0);
      expect(label * ppm).toBeGreaterThanOrEqual(48);
    }
  });
});
