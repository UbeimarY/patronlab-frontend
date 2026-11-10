import { describe, expect, it } from 'vitest';

import { buildTiledPrintHtml } from './print-scale';
import { TEMPLATES } from './templates';

describe('buildTiledPrintHtml', () => {
  it('tiles a 300x300 mm document into 2x2 A4 pages with registration marks', () => {
    const doc = TEMPLATES.find((t) => t.id === 'barniz-hummingbird')!.build();
    const res = buildTiledPrintHtml(doc, 'Plato Colibrí', 'A4');
    expect(res.cols).toBe(2);
    expect(res.rows).toBe(2);
    expect(res.totalSheets).toBe(4);
    expect(res.html).toContain('Hoja 1/4');
    expect(res.html).toContain('Escala 1:1');
  });
});
