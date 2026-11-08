import { PatternDocument, Shape, ShapeKind } from './document';

export type Point = readonly [number, number];

/**
 * Unit outlines inside [-0.5, 0.5]², identical to the API's ai/geometry.py,
 * so the canvas, the SVG export and the AI tools all see the same shapes.
 */
function unitOutline(kind: ShapeKind): Point[] {
  switch (kind) {
    case 'rect':
      return [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
    case 'ellipse':
      return range(48).map((i) => [
        0.5 * Math.cos((2 * Math.PI * i) / 48),
        0.5 * Math.sin((2 * Math.PI * i) / 48),
      ]);
    case 'triangle':
      return [
        [0, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
    case 'hexagon':
      return range(6).map((i) => [
        0.5 * Math.cos((Math.PI / 3) * i),
        0.5 * Math.sin((Math.PI / 3) * i),
      ]);
    case 'star':
      return range(10).map((i) => {
        const radius = i % 2 === 0 ? 0.5 : 0.2;
        const angle = -Math.PI / 2 + (Math.PI / 5) * i;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      });
    case 'leaf': {
      const steps = 24;
      const right: Point[] = range(steps + 1).map((t) => [
        0.5 * Math.sin((Math.PI * t) / steps),
        -0.5 + t / steps,
      ]);
      const left: Point[] = right
        .slice(1, -1)
        .reverse()
        .map(([x, y]) => [-x, y]);
      return [...right, ...left];
    }
  }
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

const UNIT = new Map<ShapeKind, Point[]>(
  (['rect', 'ellipse', 'triangle', 'hexagon', 'star', 'leaf'] as const).map((kind) => [
    kind,
    unitOutline(kind),
  ]),
);

/** The shape's polygon in document millimeters. */
export function outline(shape: Shape): Point[] {
  const angle = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return UNIT.get(shape.kind)!.map(([ux, uy]) => {
    const px = ux * shape.width;
    const py = uy * shape.height;
    return [shape.x + px * cos - py * sin, shape.y + px * sin + py * cos] as const;
  });
}

/** Shoelace formula. */
export function area(points: Point[]): number {
  let total = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    total += x1 * y2 - x2 * y1;
  });
  return Math.abs(total) / 2;
}

/** Even-odd ray casting. */
export function pointInPolygon([x, y]: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Topmost shape under the point (the last drawn wins), or null. */
export function hitTest(document: PatternDocument, point: Point): Shape | null {
  for (let i = document.shapes.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, outline(document.shapes[i]))) return document.shapes[i];
  }
  return null;
}

/** A point in the shape's own frame (unrotated, centered at the origin). */
export function toLocal(shape: Shape, [x, y]: Point): Point {
  const angle = (-shape.rotation * Math.PI) / 180;
  const dx = x - shape.x;
  const dy = y - shape.y;
  return [dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle)];
}

/** From the shape's frame back to document coordinates. */
export function toDocument(shape: Shape, [lx, ly]: Point): Point {
  const angle = (shape.rotation * Math.PI) / 180;
  return [
    shape.x + lx * Math.cos(angle) - ly * Math.sin(angle),
    shape.y + lx * Math.sin(angle) + ly * Math.cos(angle),
  ];
}

export type Handle = 'resize' | 'rotate';

/** Where the selection handles are, in document millimeters. */
export function handlePositions(shape: Shape, handleOffset: number): Record<Handle, Point> {
  return {
    resize: toDocument(shape, [shape.width / 2, shape.height / 2]),
    rotate: toDocument(shape, [0, -shape.height / 2 - handleOffset]),
  };
}
