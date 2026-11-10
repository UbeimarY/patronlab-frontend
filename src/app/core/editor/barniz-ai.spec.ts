import { describe, expect, it } from 'vitest';

import {
  computeLayerLayouts,
  deltaE,
  fallbackAnalyzeColors,
  fallbackEvolve,
  fallbackVectorize,
} from './barniz-ai';
import { TEMPLATES } from './templates';

describe('barniz-ai helpers', () => {
  it('computes per-layer area in cm2, sheet counts and waste', () => {
    const doc = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!.build();
    const layouts = computeLayerLayouts(doc, 300, 300, 3);
    expect(layouts.length).toBe(doc.layers!.length);
    for (const item of layouts) {
      expect(item.areaCm2).toBeGreaterThanOrEqual(0);
      expect(item.sheets).toBeGreaterThanOrEqual(1);
      expect(item.placements.length).toBeGreaterThan(0);
    }
  });

  it('calculates perceptual deltaE and flags overly similar colors', () => {
    expect(deltaE('#b3202a', '#b5222c')).toBeLessThan(5);
    expect(deltaE('#b3202a', '#1f5fa0')).toBeGreaterThan(40);

    const doc = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!.build();
    const analysis = fallbackAnalyzeColors(doc);
    expect(analysis.names.length).toBeGreaterThan(0);
    expect(analysis.harmonies.length).toBeGreaterThanOrEqual(3);
  });

  it('produces vectorize and evolutionary fallback results matching the v2 contract', () => {
    const vec = fallbackVectorize(300, 300, 4);
    expect(vec.layers.length).toBe(4);
    expect(vec.shapes.length).toBeGreaterThan(0);

    const doc = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!.build();
    const evolved = fallbackEvolve(doc, ['#b3202a', '#286b35']);
    expect(evolved.variations.length).toBe(4);
    expect(evolved.history.length).toBeGreaterThan(0);
  });
});

