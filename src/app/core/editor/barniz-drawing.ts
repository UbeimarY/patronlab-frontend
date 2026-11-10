/** Building blocks shared by the Barniz templates and the text-to-design composer. */

import {
  BarnizLayer,
  BarnizObject,
  PatternDocument,
  Shape,
  migrateDocument,
  round,
  syncRadialGroups,
} from './document';
import { Pt } from './motifs';

export const STROKE = '#2b2420';

export function shape(partial: Omit<Shape, 'stroke'>): Shape {
  return { ...partial, stroke: STROKE };
}

/**
 * A `path` shape from document-space points (a sampled curve), centered on its
 * bounding box like the Bisturí does, rounded to 0.1 mm without repeated points.
 */
export function curved(
  id: string,
  docPoints: readonly Pt[],
  fill: string,
  layerId: string,
  groupId: string | null = null,
): Shape {
  const xs = docPoints.map(([x]) => x);
  const ys = docPoints.map(([, y]) => y);
  const cx = round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cy = round((Math.min(...ys) + Math.max(...ys)) / 2);
  const points: [number, number][] = [];
  for (const [x, y] of docPoints) {
    const p: [number, number] = [round(x - cx), round(y - cy)];
    const prev = points[points.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) points.push(p);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 3 && first[0] === last[0] && first[1] === last[1]) points.pop();
  return shape({
    id,
    kind: 'path',
    x: cx,
    y: cy,
    width: 0,
    height: 0,
    rotation: 0,
    fill,
    layerId,
    groupId,
    points,
  });
}

export function dot(
  id: string,
  x: number,
  y: number,
  d: number,
  fill: string,
  layerId: string,
  groupId: string | null = null,
): Shape {
  return shape({
    id,
    kind: 'ellipse',
    x: round(x),
    y: round(y),
    width: round(d),
    height: round(d),
    rotation: 0,
    fill,
    layerId,
    groupId,
  });
}

/** The aniline palette the regional designs are cut from. */
export const C = {
  gold: '#e0a526',
  red: '#c0262f',
  green: '#2f8a3f',
  blue: '#2a6fb8',
  turquoise: '#1f9a90',
  orange: '#e0642a',
  olive: '#7d8f3a',
  magenta: '#a83a7c',
};

export function buildBarnizDoc(
  object: BarnizObject,
  layers: BarnizLayer[],
  shapes: Shape[],
  groups: PatternDocument['groups'] = [],
): PatternDocument {
  const width = object.width;
  const height = object.kind === 'plate' || object.kind === 'bowl' ? object.width : object.height;
  return syncRadialGroups(
    migrateDocument({
      schemaVersion: 2,
      mode: 'barniz',
      width,
      height,
      background: object.baseColor,
      object: { ...object, height },
      layers,
      groups,
      shapes,
    }),
  );
}
