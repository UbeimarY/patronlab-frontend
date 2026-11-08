/** The pattern document, identical to the API's (units: millimeters). */

export const SHAPE_KINDS = ['rect', 'ellipse', 'triangle', 'hexagon', 'star', 'leaf'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

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
}

export interface PatternDocument {
  width: number;
  height: number;
  background: string;
  shapes: Shape[];
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: 'Rectángulo',
  ellipse: 'Óvalo',
  triangle: 'Triángulo',
  hexagon: 'Hexágono',
  star: 'Estrella',
  leaf: 'Hoja',
};

export interface Material {
  id: string;
  label: string;
  /** Usual roll or sheet width, used as the default for the cutting plan. */
  rollWidth: number;
  color: string;
}

export const MATERIALS: Material[] = [
  { id: 'felt', label: 'Fieltro', rollWidth: 900, color: '#8c9a82' },
  { id: 'fabric', label: 'Tela', rollWidth: 1400, color: '#c9b8a3' },
  { id: 'leather', label: 'Cuero', rollWidth: 600, color: '#8a5a3c' },
  { id: 'wood', label: 'Madera (corte láser)', rollWidth: 600, color: '#c89f6c' },
  { id: 'acrylic', label: 'Acrílico', rollWidth: 600, color: '#a9c6cf' },
  { id: 'paper', label: 'Papel', rollWidth: 500, color: '#e9e4da' },
];

export function materialOf(id: string): Material {
  return MATERIALS.find((material) => material.id === id) ?? MATERIALS[0];
}

export const MAX_SHAPES = 400;
const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function newShapeId(): string {
  return `s-${crypto.randomUUID().slice(0, 8)}`;
}

export function createShape(kind: ShapeKind, x: number, y: number, fill: string): Shape {
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
  return {
    ...document,
    shapes: document.shapes.map((shape) => (shape.id === id ? { ...shape, ...changes } : shape)),
  };
}

/** Keeps a value inside the API's accepted range, so a save never fails validation. */
export function clampShape(shape: Shape): Shape {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    ...shape,
    x: round(clamp(shape.x, -2000, 2000)),
    y: round(clamp(shape.y, -2000, 2000)),
    width: round(clamp(shape.width, 2, 2000)),
    height: round(clamp(shape.height, 2, 2000)),
    rotation: round((((shape.rotation % 360) + 540) % 360) - 180),
  };
}
