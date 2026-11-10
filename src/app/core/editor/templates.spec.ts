import { describe, expect, it } from 'vitest';

import { MAX_PATH_POINTS } from './document';
import { boundingBox } from './geometry';
import { TEMPLATES } from './templates';

describe('TEMPLATES', () => {
  it('provides at least 4 regional Barniz de Pasto templates plus pattern templates', () => {
    const barniz = TEMPLATES.filter((t) => t.mode === 'barniz' && t.id !== 'barniz-blank');
    expect(barniz.length).toBeGreaterThanOrEqual(4);
    for (const tpl of barniz) {
      expect(tpl.label.toLowerCase()).not.toContain('tradicional');
      expect(tpl.label.toLowerCase()).toContain('inspirad');
      const doc = tpl.build();
      expect(doc.schemaVersion).toBe(2);
      expect(doc.mode).toBe('barniz');
      expect(doc.object).not.toBeNull();
      expect((doc.layers ?? []).length).toBeGreaterThanOrEqual(3);
      expect(doc.shapes.length).toBeGreaterThan(0);
    }
  });

  it('draws regional motifs with smooth curves inside the API path limits', () => {
    for (const tpl of TEMPLATES.filter((t) => t.mode === 'barniz' && t.id !== 'barniz-blank')) {
      const doc = tpl.build();
      for (const s of doc.shapes.filter((shape) => shape.kind === 'path')) {
        // No faceted 3–8 point polygons: every cut is a sampled curve or a softened outline.
        expect(s.points!.length).toBeGreaterThanOrEqual(16);
        expect(s.points!.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
        expect(s.layerId).toBeTruthy();
      }
      // Every lamina gets at least one piece to cut.
      for (const layer of doc.layers ?? []) {
        expect(doc.shapes.some((s) => s.layerId === layer.id)).toBe(true);
      }
    }
  });

  it('scales the tray and box motifs to a custom object size', () => {
    for (const [id, width, height] of [
      ['barniz-galeras-tray', 500, 200],
      ['barniz-fret-box', 320, 240],
    ] as const) {
      const doc = TEMPLATES.find((t) => t.id === id)!.build({ width, height });
      expect(doc.width).toBe(width);
      expect(doc.height).toBe(height);
      for (const s of doc.shapes) {
        const box = boundingBox(s);
        expect(box.minX).toBeGreaterThanOrEqual(-1);
        expect(box.maxX).toBeLessThanOrEqual(width + 1);
        expect(box.minY).toBeGreaterThanOrEqual(-1);
        expect(box.maxY).toBeLessThanOrEqual(height + 1);
      }
    }
  });

  it('keeps plate and bowl circular when customized', () => {
    const hummingbird = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!;
    const doc = hummingbird.build({ kind: 'plate', width: 340, height: 200, leaf: 'gold' });
    expect(doc.width).toBe(340);
    expect(doc.height).toBe(340);
    expect(doc.object?.height).toBe(340);
  });
});
