/**
 * Drawings of the regional motifs, each in its own frame (millimeters, y pointing down).
 *
 * The templates place them on a specific object; the text-to-design composer
 * fits them into a slot of any size. Keeping one copy of each drawing means a
 * hummingbird looks the same whether it came from a template or from a phrase.
 */

import { Pt, flower, ribbon, roundCorners, smoothClosed } from './motifs';

/** The hummingbird facing right: body, throat, wing, forked tail and beak. */
export function hummingbirdParts(): Record<'body' | 'throat' | 'wing' | 'tail' | 'beak', Pt[]> {
  const body = smoothClosed(
    [
      [20, -58],
      [34, -62],
      [46, -54],
      [48, -42],
      [42, -28],
      [34, -8],
      [20, 10],
      [2, 22],
      [-16, 30],
      [-24, 26],
      [-18, 12],
      [-6, -6],
      [4, -24],
      [10, -40],
      [13, -52],
    ],
    8,
  );
  const throat = smoothClosed(
    [
      [47, -40],
      [44, -27],
      [37, -13],
      [31, -17],
      [34, -29],
      [40, -38],
    ],
    8,
  );
  const wing = smoothClosed(
    [
      [16, -22],
      [10, -44],
      [-4, -68],
      [-28, -92],
      [-46, -100],
      [-42, -88],
      [-54, -84],
      [-36, -70],
      [-48, -64],
      [-28, -52],
      [-38, -44],
      [-18, -34],
      [-20, -22],
      [0, -10],
    ],
    8,
  );
  const tail = smoothClosed(
    [
      [-4, 8],
      [-16, 22],
      [-36, 32],
      [-62, 38],
      [-44, 46],
      [-58, 68],
      [-30, 50],
      [-14, 36],
      [-2, 20],
    ],
    8,
  );
  const beak = ribbon(
    [
      [44, -48],
      [70, -46],
      [98, -38],
    ],
    4.6,
    1.2,
    10,
  );
  return { body, throat, wing, tail, beak };
}

/** Eye position of {@link hummingbirdParts}, in the same frame. */
export const HUMMINGBIRD_EYE: Pt = [36, -48];

/** A stepped pyramid fret (base at y = 0, pointing up) and a coiled spiral hook. */
export function fretParts(): { pyramid: Pt[]; spiral: Pt[] } {
  const steps: Pt[] = [
    [-18, 0],
    [-18, -6],
    [-12, -6],
    [-12, -12],
    [-6, -12],
    [-6, -18],
    [6, -18],
    [6, -12],
    [12, -12],
    [12, -6],
    [18, -6],
    [18, 0],
  ];
  const pyramid = roundCorners(steps, 1);
  // A coiled spiral hook (Archimedean) ending in a short tail.
  const spiralSpine: Pt[] = Array.from({ length: 22 }, (_, i) => {
    const t = i / 21;
    const theta = Math.PI * 2.1 * (1 - t);
    const r = 2 + 8 * (1 - t);
    return [r * Math.cos(theta), r * Math.sin(theta)] as const;
  });
  const spiral = ribbon(spiralSpine, 4.2, 2.8, 4);
  return { pyramid, spiral };
}

/** The corner rosette of the fret box. */
export function rosette(): Pt[] {
  return flower(9, 4, 0.55, 96);
}

/**
 * A frailejón of the páramo, base of the trunk at (0, 0): a stout shaggy trunk,
 * a fan rosette of furry leaves and two flower stalks (call `stalk(-1)` and `stalk(1)`).
 */
export function frailejonParts(): { trunk: Pt[]; rosette: Pt[]; stalk: (dir: number) => Pt[] } {
  const trunk = smoothClosed(
    Array.from({ length: 14 }, (_, i) => {
      const side = i < 7 ? 1 : -1;
      const j = i < 7 ? i : 13 - i;
      const y = -j * 4.6;
      const shag = j % 2 === 0 ? 1.6 : 0;
      return [side * (7.5 - j * 0.3 + shag), y] as const;
    }),
    5,
  );
  const fan = Array.from({ length: 180 }, (_, i) => {
    const t = (2 * Math.PI * i) / 180;
    const up = Math.cos(t) > -0.15 ? 1 : 0.5;
    const r = 26 * up * (0.42 + 0.58 * Math.pow(Math.abs(Math.cos(5.5 * t)), 1.2));
    return [r * Math.sin(t), -34 - r * Math.cos(t) * 0.85] as const;
  });

  const stalk = (dir: number): Pt[] =>
    ribbon(
      [
        [dir * 3, -48],
        [dir * 10, -62],
        [dir * 13, -72],
      ],
      2.4,
      1.6,
      6,
    );

  return { trunk, rosette: fan, stalk };
}

/** A sun disc with twelve wavy flame rays. */
export function polarSun(r: number): Pt[] {
  return Array.from({ length: 192 }, (_, i) => {
    const t = (2 * Math.PI * i) / 192;
    const wave = Math.sin(12 * t + 0.6 * Math.sin(24 * t));
    const radius = r * (0.74 + 0.26 * Math.max(0, wave));
    return [radius * Math.sin(t), -radius * Math.cos(t)] as const;
  });
}
