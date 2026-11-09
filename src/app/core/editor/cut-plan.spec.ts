import { describe, expect, it } from 'vitest';

import { cutPlanSvg, placedShapes } from './cut-plan';
import { outline } from './geometry';

describe('placedShapes', () => {
  it('draws each piece inside the box the API placed, turned when rotated', () => {
    const document = {
      width: 300,
      height: 300,
      background: '#ffffff',
      shapes: [
        {
          id: 'a',
          kind: 'rect' as const,
          x: 100,
          y: 100,
          width: 60,
          height: 20,
          rotation: 0,
          fill: '#000000',
          stroke: '#000000',
        },
      ],
    };
    const layout = {
      placements: [{ shapeId: 'a', x: 10, y: 5, width: 20, height: 60, rotated: true }],
      usedLength: 65,
      wastePercent: 0,
      baselineLength: 0,
      baselineWastePercent: 0,
      cutOrder: ['a'],
      cutTravel: 0,
      baselineCutTravel: 0,
    };
    const placed = placedShapes(document, layout).get('a')!;
    const xs = outline(placed).map(([x]) => x);
    const ys = outline(placed).map(([, y]) => y);
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...xs)).toBeCloseTo(30, 6);
    expect(Math.min(...ys)).toBeCloseTo(5, 6);
    expect(Math.max(...ys)).toBeCloseTo(65, 6);
  });
});

describe('cutPlanSvg', () => {
  it('writes real-size cut lines and a separate layer for the order', () => {
    const document = {
      width: 300,
      height: 300,
      background: '#ffffff',
      shapes: [
        {
          id: 'a',
          kind: 'rect' as const,
          x: 100,
          y: 100,
          width: 60,
          height: 20,
          rotation: 0,
          fill: '#000000',
          stroke: '#000000',
        },
      ],
    };
    const layout = {
      placements: [{ shapeId: 'a', x: 0, y: 0, width: 60, height: 20, rotated: false }],
      usedLength: 20,
      wastePercent: 0,
      baselineLength: 20,
      baselineWastePercent: 0,
      cutOrder: ['a'],
      cutTravel: 31.6,
      baselineCutTravel: 31.6,
    };
    const svg = cutPlanSvg(document, layout, 400, 'Cojín <1>');
    expect(svg).toContain('width="400mm" height="25mm" viewBox="0 0 400 25"');
    expect(svg).toContain('<g id="corte">');
    expect(svg).toContain('points="0.00,0.00 60.00,0.00 60.00,20.00 0.00,20.00"');
    expect(svg).toContain('<g id="orden">');
    expect(svg).toContain('>1</text>');
    expect(svg).toContain('Cojín &#60;1&#62;');
  });
});
