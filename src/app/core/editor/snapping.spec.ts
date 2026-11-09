import { describe, expect, it } from 'vitest';

import { PatternDocument, Shape } from './document';
import { snapToGuides } from './snapping';

const shape = (id: string, x: number, y: number): Shape => ({
  id,
  kind: 'rect',
  x,
  y,
  width: 10,
  height: 10,
  rotation: 0,
  fill: '#000000',
  stroke: '#000000',
});

const doc = (shapes: Shape[]): PatternDocument => ({
  width: 200,
  height: 100,
  background: '#ffffff',
  shapes,
});

describe('snapToGuides', () => {
  it('snaps to the center of the material', () => {
    const moving = shape('a', 98, 52);
    const result = snapToGuides(moving, doc([moving]), 3);
    expect(result).toEqual({ x: 100, y: 50, guides: { x: 100, y: 50 } });
  });

  it('lines up with another piece, choosing the closest guide', () => {
    const moving = shape('a', 41, 20);
    const result = snapToGuides(moving, doc([moving, shape('b', 40, 80), shape('c', 43, 5)]), 3);
    expect(result.x).toBe(40);
    expect(result.guides.y).toBeNull();
  });

  it('leaves the piece alone when nothing is close', () => {
    const moving = shape('a', 10, 10);
    const result = snapToGuides(moving, doc([moving, shape('b', 60, 60)]), 3);
    expect(result).toEqual({ x: 10, y: 10, guides: { x: null, y: null } });
  });
});
