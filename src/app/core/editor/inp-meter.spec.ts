import { describe, expect, it } from 'vitest';

import { InpMeter, estimateInp, rate } from './inp-meter';

describe('INP', () => {
  it('reports the worst interaction while there are few', () => {
    expect(estimateInp([40, 120, 80])).toBe(120);
    expect(estimateInp([])).toBeNull();
  });

  it('ignores one outlier per 50 interactions, like Chrome', () => {
    const durations = [900, ...Array.from({ length: 59 }, () => 50)];
    expect(estimateInp(durations)).toBe(50);
  });

  it('uses the web.dev thresholds', () => {
    expect(rate(200)).toBe('good');
    expect(rate(201)).toBe('needs-improvement');
    expect(rate(501)).toBe('poor');
  });

  it('keeps the longest event of each interaction and skips non-interactions', () => {
    const meter = new InpMeter();
    meter.record({ interactionId: 7, duration: 40 });
    meter.record({ interactionId: 7, duration: 96 });
    meter.record({ interactionId: 0, duration: 999 });
    expect(meter.inp()).toBe(96);
    expect(meter.rating()).toBe('good');
  });
});
