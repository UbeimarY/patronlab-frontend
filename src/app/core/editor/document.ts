/** The pattern document, identical to the API's (units: millimeters). */

export const SHAPE_KINDS = [
  'rect',
  'ellipse',
  'triangle',
  'hexagon',
  'star',
  'leaf',
  'path',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Shapes that can be placed directly with a single click from the toolbar. */
export const PRIMITIVE_SHAPE_KINDS = [
  'rect',
  'ellipse',
  'triangle',
  'hexagon',
  'star',
  'leaf',
] as const;
export type PrimitiveShapeKind = (typeof PRIMITIVE_SHAPE_KINDS)[number];

export type PatternMode = 'pattern' | 'barniz';
export type BarnizObjectKind = 'plate' | 'bowl' | 'box' | 'tray';
export type BarnizLeaf = 'none' | 'gold' | 'silver';

export interface BarnizObject {
  kind: BarnizObjectKind;
  width: number;
  height: number;
  baseColor: string;
  leaf: BarnizLeaf;
}

export interface BarnizLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface RadialGroup {
  id: string;
  kind: 'radial' | 'free';
  count: number;
  mirror: boolean;
  sourceId: string;
}

export interface Shape {
  id: string;
  kind: ShapeKind;
  /** Center of the shape. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
  fill: string;
  stroke: string;
  layerId?: string | null;
  groupId?: string | null;
  /** Closed polygon points in millimeters relative to (x, y), when kind === 'path'. */
  points?: readonly (readonly [number, number])[];
}

export interface PatternDocument {
  schemaVersion?: 2;
  mode?: PatternMode;
  width: number;
  height: number;
  background: string;
  object?: BarnizObject | null;
  layers?: BarnizLayer[];
  groups?: RadialGroup[];
  shapes: Shape[];
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectángulo',
  ellipse: 'Óvalo',
  triangle: 'Triángulo',
  hexagon: 'Hexágono',
  star: 'Estrella',
  leaf: 'Hoja',
  path: 'Corte a bisturí',
};

export const OBJECT_LABELS: Record<BarnizObjectKind, string> = {
  plate: 'Plato',
  bowl: 'Cuenco',
  box: 'Caja',
  tray: 'Bandeja',
};

export const LEAF_LABELS: Record<BarnizLeaf, string> = {
  none: 'Sin lámina metálica',
  gold: 'Pan de oro',
  silver: 'Pan de plata',
};

export interface Material {
  id: string;
  label: string;
  /** Usual roll or sheet width, used as the default for the cutting plan. */
  rollWidth: number;
  color: string;
}

export const MATERIALS: Material[] = [
  { id: 'mopa-mopa', label: 'Barniz mopa-mopa sobre madera', rollWidth: 400, color: '#1b1411' },
  { id: 'felt', label: 'Fieltro', rollWidth: 900, color: '#8c9a82' },
  { id: 'fabric', label: 'Tela', rollWidth: 1400, color: '#c9b8a3' },
  { id: 'leather', label: 'Cuero', rollWidth: 600, color: '#8a5a3c' },
  { id: 'wood', label: 'Madera (corte láser)', rollWidth: 600, color: '#c89f6c' },
  { id: 'acrylic', label: 'Acrílico', rollWidth: 600, color: '#a9c6cf' },
  { id: 'paper', label: 'Papel', rollWidth: 500, color: '#e9e4da' },
];

export const ANILINE_COLORS: { name: string; hex: string }[] = [
  { name: 'Rojo cochinilla', hex: '#b3202a' },
  { name: 'Verde mopa-mopa', hex: '#286b35' },
  { name: 'Azul añil', hex: '#1f5fa0' },
  { name: 'Amarillo ocre', hex: '#d99b1e' },
  { name: 'Naranja fuego', hex: '#d45b24' },
  { name: 'Verde oliva natural', hex: '#6c7a36' },
  { name: 'Turquesa andino', hex: '#1e7f7a' },
  { name: 'Morado obispo', hex: '#632b6c' },
];

export function materialOf(id: string): Material {
  return MATERIALS.find((material) => material.id === id) ?? MATERIALS[1];
}

export const MAX_SHAPES = 400;
export const MAX_BARNIZ_SHAPES = 1500;
export const MAX_LAYERS = 12;
export const MIN_PATH_POINTS = 3;
export const MAX_PATH_POINTS = 2000;

export function maxShapesFor(document: PatternDocument): number {
  return document.mode === 'barniz' ? MAX_BARNIZ_SHAPES : MAX_SHAPES;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function newShapeId(): string {
  return `s-${crypto.randomUUID().slice(0, 8)}`;
}

export function newLayerId(): string {
  return `l-${crypto.randomUUID().slice(0, 8)}`;
}

export function newGroupId(): string {
  return `g-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Migrates a v1 document (or partial v2 document) into the full v2 contract:
 * schemaVersion 2, mode "pattern", object null, layers [], groups [], and
 * layerId / groupId set to null on every shape.
 */
export function migrateDocument(raw: PatternDocument): PatternDocument {
  const mode: PatternMode = raw.mode === 'barniz' ? 'barniz' : 'pattern';
  const object: BarnizObject | null =
    mode === 'barniz' && raw.object
      ? {
          kind: raw.object.kind ?? 'plate',
          width: round(raw.object.width ?? raw.width),
          height: round(
            raw.object.kind === 'plate' || raw.object.kind === 'bowl'
              ? (raw.object.width ?? raw.width)
              : (raw.object.height ?? raw.height),
          ),
          baseColor: isHexColor(raw.object.baseColor ?? '') ? raw.object.baseColor : '#1b1512',
          leaf: raw.object.leaf ?? 'none',
        }
      : null;
  const layers: BarnizLayer[] = (raw.layers ?? []).slice(0, MAX_LAYERS).map((layer, index) => ({
    id: layer.id || `l-${index + 1}`,
    name: layer.name || `Lámina ${index + 1}`,
    color: isHexColor(layer.color) ? layer.color.toLowerCase() : '#b3202a',
    visible: layer.visible ?? true,
    locked: layer.locked ?? false,
  }));
  const groups: RadialGroup[] = (raw.groups ?? []).map((group) => ({
    id: group.id,
    kind: group.kind ?? 'radial',
    count: Math.min(24, Math.max(2, Math.round(group.count || 6))),
    mirror: Boolean(group.mirror),
    sourceId: group.sourceId,
  }));
  const shapes: Shape[] = (raw.shapes ?? []).map((shape) => {
    const normalized: Shape = {
      ...shape,
      layerId: shape.layerId ?? null,
      groupId: shape.groupId ?? null,
    };
    if (shape.kind === 'path') {
      const pts = (shape.points ?? [])
        .slice(0, MAX_PATH_POINTS)
        .map(([px, py]) => [round(px), round(py)] as const);
      return {
        ...normalized,
        width: round(shape.width || 0),
        height: round(shape.height || 0),
        points: pts,
      };
    }
    return normalized;
  });

  return {
    schemaVersion: 2,
    mode,
    width: raw.width,
    height: raw.height,
    background: raw.background,
    object,
    layers,
    groups,
    shapes,
  };
}

export function createShape(
  kind: ShapeKind,
  x: number,
  y: number,
  fill: string,
  layerId: string | null = null,
): Shape {
  if (kind === 'path') {
    return {
      id: newShapeId(),
      kind: 'path',
      x: round(x),
      y: round(y),
      width: 0,
      height: 0,
      rotation: 0,
      fill,
      stroke: '#2b2420',
      layerId,
      groupId: null,
      points: [
        [-20, -10],
        [20, -10],
        [0, 20],
      ],
    };
  }
  const width = kind === 'leaf' ? 30 : 50;
  const height = kind === 'leaf' ? 60 : kind === 'rect' ? 40 : 50;
  return {
    id: newShapeId(),
    kind,
    x: round(x),
    y: round(y),
    width,
    height,
    rotation: 0,
    fill,
    stroke: '#2b2420',
    layerId,
    groupId: null,
  };
}

/** Creates a closed `path` shape centered at the centroid of its document-space points. */
export function createPathShape(
  docPoints: readonly (readonly [number, number])[],
  fill: string,
  layerId: string | null = null,
): Shape | null {
  const limited = docPoints.slice(0, MAX_PATH_POINTS);
  if (limited.length < MIN_PATH_POINTS) return null;
  const xs = limited.map(([x]) => x);
  const ys = limited.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = round((minX + maxX) / 2);
  const cy = round((minY + maxY) / 2);
  const points = limited.map(([x, y]) => [round(x - cx), round(y - cy)] as const);
  return {
    id: newShapeId(),
    kind: 'path',
    x: cx,
    y: cy,
    width: 0,
    height: 0,
    rotation: 0,
    fill,
    stroke: '#2b2420',
    layerId,
    groupId: null,
    points,
  };
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function updateShape(
  document: PatternDocument,
  id: string,
  changes: Partial<Shape>,
): PatternDocument {
  const shapes = document.shapes.map((shape) =>
    shape.id === id ? { ...shape, ...changes } : shape,
  );
  return syncRadialGroups({ ...document, shapes }, id);
}

/** Keeps a value inside the API's accepted range, so a save never fails validation. */
export function clampShape(shape: Shape): Shape {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const rotation = round((((shape.rotation % 360) + 540) % 360) - 180);
  if (shape.kind === 'path') {
    const points = (shape.points ?? [])
      .slice(0, MAX_PATH_POINTS)
      .map(([px, py]) => [round(clamp(px, -2000, 2000)), round(clamp(py, -2000, 2000))] as const);
    return {
      ...shape,
      x: round(clamp(shape.x, -2000, 2000)),
      y: round(clamp(shape.y, -2000, 2000)),
      width: 0,
      height: 0,
      rotation,
      points,
    };
  }
  return {
    ...shape,
    x: round(clamp(shape.x, -2000, 2000)),
    y: round(clamp(shape.y, -2000, 2000)),
    width: round(clamp(shape.width, 2, 2000)),
    height: round(clamp(shape.height, 2, 2000)),
    rotation,
  };
}

/**
 * Generates the real copy shapes for a radial symmetry group around the document center.
 * When `mirror` is true, every odd copy is mirrored across the ray from the center.
 */
export function buildRadialCopies(
  source: Shape,
  group: RadialGroup,
  centerX: number,
  centerY: number,
): Shape[] {
  if (group.kind !== 'radial') return [];
  const count = Math.min(24, Math.max(2, Math.round(group.count)));
  const copies: Shape[] = [];
  const dx = source.x - centerX;
  const dy = source.y - centerY;
  const stepDeg = 360 / count;

  for (let i = 1; i < count; i++) {
    const angleDeg = stepDeg * i;
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = centerX + dx * cos - dy * sin;
    const ry = centerY + dx * sin + dy * cos;
    const mirrored = group.mirror && i % 2 === 1;
    const copyId = `${source.id}-r${i}`;

    if (source.kind === 'path' && source.points) {
      const pts = mirrored
        ? source.points.map(([px, py]) => [round(-px), round(py)] as const).reverse()
        : source.points;
      copies.push(
        clampShape({
          ...source,
          id: copyId,
          x: rx,
          y: ry,
          rotation: (mirrored ? -source.rotation : source.rotation) + angleDeg,
          groupId: group.id,
          points: pts,
        }),
      );
    } else {
      copies.push(
        clampShape({
          ...source,
          id: copyId,
          x: rx,
          y: ry,
          rotation: (mirrored ? -source.rotation : source.rotation) + angleDeg,
          groupId: group.id,
        }),
      );
    }
  }
  return copies;
}

/**
 * Regenerates the copies of any radial group whose source shape was edited.
 * Copies are real shapes in `document.shapes` with the same `groupId`.
 */
export function syncRadialGroups(
  document: PatternDocument,
  changedShapeId?: string,
): PatternDocument {
  const groups = document.groups ?? [];
  if (groups.length === 0) return document;
  const cx = document.width / 2;
  const cy = document.height / 2;
  let shapes = document.shapes;

  for (const group of groups) {
    if (group.kind !== 'radial') continue;
    if (changedShapeId && group.sourceId !== changedShapeId) continue;
    const source = shapes.find((s) => s.id === group.sourceId);
    if (!source) continue;
    const taggedSource: Shape =
      source.groupId === group.id ? source : { ...source, groupId: group.id };
    const copies = buildRadialCopies(taggedSource, group, cx, cy);
    const result: Shape[] = [];
    let inserted = false;
    for (const s of shapes) {
      if (s.id === taggedSource.id) {
        result.push(taggedSource, ...copies);
        inserted = true;
      } else if (s.groupId === group.id) {
        // drop old copies of this radial group
      } else {
        result.push(s);
      }
    }
    if (!inserted) result.push(taggedSource, ...copies);
    shapes = result;
  }

  return shapes === document.shapes ? document : { ...document, shapes };
}
