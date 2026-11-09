import { PatternDocument, PrimitiveShapeKind, Shape, round } from './document';

export type Point = readonly [number, number];

/**
 * Unit outlines inside [-0.5, 0.5]², identical to the API's ai/geometry.py,
 * so the canvas, the SVG export and the AI tools all see the same shapes.
 */
function unitOutline(kind: PrimitiveShapeKind): Point[] {
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

const UNIT = new Map<PrimitiveShapeKind, Point[]>(
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
  if (shape.kind === 'path') {
    const pts = shape.points ?? [];
    if (pts.length === 0) return [];
    return pts.map(([px, py]) => [shape.x + px * cos - py * sin, shape.y + px * sin + py * cos]);
  }
  return UNIT.get(shape.kind)!.map(([ux, uy]) => {
    const px = ux * shape.width;
    const py = uy * shape.height;
    return [shape.x + px * cos - py * sin, shape.y + px * sin + py * cos] as const;
  });
}

/** Unrotated local dimensions of a shape (for `path`, computed from its points). */
export function localDimensions(shape: Shape): { width: number; height: number } {
  if (shape.kind !== 'path') {
    return { width: shape.width, height: shape.height };
  }
  const pts = shape.points ?? [];
  if (pts.length === 0) return { width: 20, height: 20 };
  let maxAbsX = 2;
  let maxAbsY = 2;
  for (const [px, py] of pts) {
    if (Math.abs(px) > maxAbsX) maxAbsX = Math.abs(px);
    if (Math.abs(py) > maxAbsY) maxAbsY = Math.abs(py);
  }
  return { width: maxAbsX * 2, height: maxAbsY * 2 };
}

/** Axis-aligned bounding box of a shape in document millimeters. */
export function boundingBox(shape: Shape): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const pts = outline(shape);
  if (pts.length === 0) {
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x,
      maxY: shape.y,
      width: 0,
      height: 0,
    };
  }
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
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

/** Whether a shape's layer is visible and unlocked for hit testing. */
export function isShapeSelectable(document: PatternDocument, shape: Shape): boolean {
  if (!shape.layerId || !document.layers?.length) return true;
  const layer = document.layers.find((l) => l.id === shape.layerId);
  if (!layer) return true;
  return layer.visible && !layer.locked;
}

export function isShapeVisible(document: PatternDocument, shape: Shape): boolean {
  if (!shape.layerId || !document.layers?.length) return true;
  const layer = document.layers.find((l) => l.id === shape.layerId);
  return layer ? layer.visible : true;
}

/** Topmost selectable shape under the point (the last drawn wins), or null. */
export function hitTest(document: PatternDocument, point: Point): Shape | null {
  const ordered = orderedShapesForRender(document);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const shape = ordered[i];
    if (!isShapeSelectable(document, shape)) continue;
    if (pointInPolygon(point, outline(shape))) return shape;
  }
  return null;
}

/**
 * Returns shapes in their visual stacking order: in Barniz mode with layers,
 * layers are drawn from index 0 (bottom) to top, preserving order within each layer.
 */
export function orderedShapesForRender(document: PatternDocument): Shape[] {
  const layers = document.layers ?? [];
  if (document.mode !== 'barniz' || layers.length === 0) {
    return document.shapes;
  }
  const rank = new Map<string, number>();
  layers.forEach((l, idx) => rank.set(l.id, idx));
  return [...document.shapes].sort((a, b) => {
    const ra = a.layerId !== null && a.layerId !== undefined ? (rank.get(a.layerId) ?? 999) : 999;
    const rb = b.layerId !== null && b.layerId !== undefined ? (rank.get(b.layerId) ?? 999) : 999;
    return ra - rb;
  });
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
  const { width, height } = localDimensions(shape);
  return {
    resize: toDocument(shape, [width / 2, height / 2]),
    rotate: toDocument(shape, [0, -height / 2 - handleOffset]),
  };
}

/** Distance from point P to segment AB, and the closest point on AB. */
export function distanceToSegment(
  p: Point,
  a: Point,
  b: Point,
): { distance: number; point: Point } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { distance: Math.hypot(p[0] - a[0], p[1] - a[1]), point: a };
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const proj: Point = [round(a[0] + t * dx), round(a[1] + t * dy)];
  return { distance: Math.hypot(p[0] - proj[0], p[1] - proj[1]), point: proj };
}

/**
 * Finds the edge segment of a `path` shape closest to `docPoint` (within `toleranceMm`).
 * Returns the index `i` after which the new vertex should be inserted (`i + 1`).
 */
export function findPathSegment(
  shape: Shape,
  docPoint: Point,
  toleranceMm: number,
): { insertIndex: number; localPoint: Point } | null {
  if (shape.kind !== 'path' || !shape.points || shape.points.length < 3) return null;
  const local = toLocal(shape, docPoint);
  let bestDist = Infinity;
  let bestIndex = -1;
  let bestPoint: Point = local;
  const pts = shape.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const { distance, point } = distanceToSegment(local, a, b);
    if (distance <= toleranceMm && distance < bestDist) {
      bestDist = distance;
      bestIndex = i + 1;
      bestPoint = point;
    }
  }
  return bestIndex >= 0 ? { insertIndex: bestIndex, localPoint: bestPoint } : null;
}

/** Scales a `path` shape's relative points when resized via its bounding handle. */
export function scalePathPoints(
  shape: Shape,
  newWidth: number,
  newHeight: number,
): readonly Point[] {
  const pts = shape.points ?? [];
  const { width, height } = localDimensions(shape);
  const sx = width > 0 ? newWidth / width : 1;
  const sy = height > 0 ? newHeight / height : 1;
  return pts.map(([px, py]) => [round(px * sx), round(py * sy)] as const);
}
