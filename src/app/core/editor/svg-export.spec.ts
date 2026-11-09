import { describe, expect, it } from 'vitest';

import { slug, toLayerSvg, toSvg } from './svg-export';

describe('SVG export', () => {
  it('writes a real-size SVG with one polygon per piece', () => {
    const svg = toSvg(
      {
        width: 300,
        height: 200,
        background: '#f6efe3',
        shapes: [
          {
            id: 'a',
            kind: 'rect',
            x: 50,
            y: 50,
            width: 20,
            height: 10,
            rotation: 0,
            fill: '#112233',
            stroke: '#000000',
          },
        ],
      },
      'Cojín <prueba>',
    );
    expect(svg).toContain('width="300mm" height="200mm" viewBox="0 0 300 200"');
    expect(svg).toContain('points="40.00,45.00 60.00,45.00 60.00,55.00 40.00,55.00"');
    expect(svg).toContain('Cojín &#60;prueba&#62;');
    expect(svg).not.toContain('<prueba>');
  });

  it('exports a single Barniz layer SVG including path shapes', () => {
    const layer = { id: 'l-1', name: 'Rojo', color: '#b3202a', visible: true, locked: false };
    const svg = toLayerSvg(
      {
        schemaVersion: 2,
        mode: 'barniz',
        width: 300,
        height: 300,
        background: '#1b1512',
        layers: [layer],
        shapes: [
          {
            id: 'p-1',
            kind: 'path',
            x: 150,
            y: 150,
            width: 0,
            height: 0,
            rotation: 0,
            fill: '#b3202a',
            stroke: '#2b2420',
            layerId: 'l-1',
            points: [
              [-10, -10],
              [10, -10],
              [0, 10],
            ],
          },
          {
            id: 'other',
            kind: 'rect',
            x: 50,
            y: 50,
            width: 20,
            height: 20,
            rotation: 0,
            fill: '#1f5fa0',
            stroke: '#2b2420',
            layerId: 'l-2',
          },
        ],
      },
      layer,
      'Plato Colibrí',
    );
    expect(svg).toContain('Plato Colibrí · Lámina Rojo');
    expect(svg).toContain('id="p-1"');
    expect(svg).toContain('points="140.00,140.00 160.00,140.00 150.00,160.00"');
    expect(svg).not.toContain('id="other"');
  });

  it('makes safe file names', () => {
    expect(slug('Cojín de hojas #2')).toBe('cojin-de-hojas-2');
    expect(slug('***')).toBe('patron');
  });
});
