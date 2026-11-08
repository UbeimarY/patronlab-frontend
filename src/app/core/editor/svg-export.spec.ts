import { describe, expect, it } from 'vitest';

import { slug, toSvg } from './svg-export';

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

  it('makes safe file names', () => {
    expect(slug('Cojín de hojas #2')).toBe('cojin-de-hojas-2');
    expect(slug('***')).toBe('patron');
  });
});
