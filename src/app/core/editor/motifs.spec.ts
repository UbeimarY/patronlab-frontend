import { describe, expect, it } from 'vitest';

import { area } from './geometry';
import { flower, leafShape, mirrorX, ribbon, roundCorners, smoothClosed } from './motifs';

describe('motifs', () => {
  it('samples a closed spline that passes through its control points', () => {
    const ctrl = [
      [0, -10],
      [10, 0],
      [0, 10],
      [-10, 0],
    ] as const;
    const pts = smoothClosed(ctrl, 6);
    expect(pts.length).toBe(24);
    expect(pts[0]).toEqual([0, -10]);
    expect(pts[6][0]).toBeCloseTo(10);
  });

  it('builds a tapered ribbon whose outline is wider at the start', () => {
    const pts = ribbon(
      [
        [0, 0],
        [50, 0],
      ],
      10,
      2,
      4,
    );
    const ys = (x: number) => pts.filter(([px]) => Math.abs(px - x) < 0.01).map(([, y]) => y);
    expect(Math.max(...ys(0)) - Math.min(...ys(0))).toBeCloseTo(10);
    expect(Math.max(...ys(50)) - Math.min(...ys(50))).toBeCloseTo(2);
  });

  it('softens corners without losing much area', () => {
    const square = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ] as const;
    const soft = roundCorners(square, 2);
    expect(soft.length).toBe(16);
    expect(area(soft)).toBeGreaterThan(area([...square]) * 0.8);
  });

  it('draws flowers, leaves and mirrors as closed outlines of real area', () => {
    expect(area(flower(15, 5))).toBeGreaterThan(Math.PI * 15 * 15 * 0.5);
    const leaf = leafShape(40, 16, 0.3);
    expect(area(leaf)).toBeGreaterThan(200);
    expect(area(mirrorX(leaf))).toBeCloseTo(area(leaf));
  });
});
