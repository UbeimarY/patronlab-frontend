import { describe, expect, it } from 'vitest';

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

  it('keeps plate and bowl circular when customized', () => {
    const hummingbird = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!;
    const doc = hummingbird.build({ kind: 'plate', width: 340, height: 200, leaf: 'gold' });
    expect(doc.width).toBe(340);
    expect(doc.height).toBe(340);
    expect(doc.object?.height).toBe(340);
  });
});
