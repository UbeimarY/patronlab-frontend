import { describe, expect, it } from 'vitest';

import { Shape } from './document';
import {
  area,
  handlePositions,
  hitTest,
  outline,
  pointInPolygon,
  toDocument,
  toLocal,
} from './geometry';

const rect = (changes: Partial<Shape> = {}): Shape => ({
  id: 'r',
  kind: 'rect',
  x: 50,
  y: 50,
  width: 40,
  height: 20,
  rotation: 0,
  fill: '#000000',
  stroke: '#000000',
  ...changes,
});

describe('geometry', () => {
  it('matches the API outline area for a rotated rectangle', () => {
    expect(area(outline(rect({ rotation: 30 })))).toBeCloseTo(800, 6);
  });

  it('builds the same outlines as the Python module', () => {
    // Same unit outlines as ai/geometry.py: 48-point ellipse, 10-point star, 48-point leaf.
    const sizes = (['ellipse', 'star', 'leaf', 'hexagon', 'triangle'] as const).map(
      (kind) => outline(rect({ kind })).length,
    );
    expect(sizes).toEqual([48, 10, 48, 6, 3]);
  });

  it('hits the topmost shape and misses empty space', () => {
    const document = {
      width: 100,
      height: 100,
      background: '#ffffff',
      shapes: [rect({ id: 'below' }), rect({ id: 'above', x: 60 })],
    };
    expect(hitTest(document, [62, 50])?.id).toBe('above');
    expect(hitTest(document, [35, 50])?.id).toBe('below');
    expect(hitTest(document, [5, 5])).toBeNull();
  });

  it('respects rotation when testing points', () => {
    const turned = outline(rect({ rotation: 90 })); // now 20 wide, 40 tall
    expect(pointInPolygon([50, 68], turned)).toBe(true);
    expect(pointInPolygon([68, 50], turned)).toBe(false);
  });

  it('converts to the shape frame and back', () => {
    const shape = rect({ rotation: 37 });
    const [x, y] = toDocument(shape, toLocal(shape, [61, 44]));
    expect(x).toBeCloseTo(61, 9);
    expect(y).toBeCloseTo(44, 9);
  });

  it('puts the resize handle on the corner and the rotate handle above', () => {
    const handles = handlePositions(rect(), 10);
    expect(handles.resize).toEqual([70, 60]);
    expect(handles.rotate).toEqual([50, 30]);
  });
});
