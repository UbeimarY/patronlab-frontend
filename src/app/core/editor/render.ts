import { PatternDocument, Shape } from './document';
import { Point, handlePositions, outline } from './geometry';
import { Guides } from './snapping';

/** Canvas pixels per millimeter at zoom 1 (before the device pixel ratio). */
export const BASE_PX_PER_MM = 2;

export function tracePolygon(ctx: CanvasRenderingContext2D, points: Point[], scale: number): void {
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale),
  );
  ctx.closePath();
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, scale: number): void {
  tracePolygon(ctx, outline(shape), scale);
  ctx.fillStyle = shape.fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, 0.6 * scale);
  ctx.strokeStyle = shape.stroke;
  ctx.stroke();
}

/** Every shape in drawing order, optionally skipping one (the one being dragged). */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
  skipId: string | null = null,
): void {
  for (const shape of document.shapes) {
    if (shape.id !== skipId) drawShape(ctx, shape, scale);
  }
}

/** The material piece: its color and a millimeter grid like a cutting mat. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
): void {
  ctx.fillStyle = document.background;
  ctx.fillRect(0, 0, document.width * scale, document.height * scale);
  for (const [step, alpha] of [
    [10, 0.07],
    [50, 0.16],
  ] as const) {
    ctx.beginPath();
    for (let x = step; x < document.width; x += step) {
      ctx.moveTo(Math.round(x * scale) + 0.5, 0);
      ctx.lineTo(Math.round(x * scale) + 0.5, document.height * scale);
    }
    for (let y = step; y < document.height; y += step) {
      ctx.moveTo(0, Math.round(y * scale) + 0.5);
      ctx.lineTo(document.width * scale, Math.round(y * scale) + 0.5);
    }
    ctx.strokeStyle = `rgba(30, 40, 36, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export const SELECTION_COLOR = '#f0c23b';

/**
 * Outline and handles of the selected shape, drawn on the interaction layer.
 * `pixel` is how many canvas pixels make one screen pixel, so handles keep the
 * same size on screen at any zoom.
 */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  scale: number,
  pixel: number,
  handleOffset: number,
): void {
  tracePolygon(ctx, outline(shape), scale);
  ctx.lineWidth = 2 * pixel;
  ctx.strokeStyle = '#1d2321';
  ctx.stroke();
  ctx.setLineDash([5 * pixel, 4 * pixel]);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.stroke();
  ctx.setLineDash([]);

  const handles = handlePositions(shape, handleOffset);
  const [tx, ty] = handles.rotate;
  const top = outline({ ...shape, kind: 'rect' });
  const [mx, my] = [(top[0][0] + top[1][0]) / 2, (top[0][1] + top[1][1]) / 2];
  ctx.beginPath();
  ctx.moveTo(mx * scale, my * scale);
  ctx.lineTo(tx * scale, ty * scale);
  ctx.lineWidth = 1.5 * pixel;
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.stroke();

  for (const [name, [hx, hy]] of Object.entries(handles)) {
    ctx.beginPath();
    const radius = 6 * pixel;
    if (name === 'rotate') ctx.arc(hx * scale, hy * scale, radius, 0, Math.PI * 2);
    else ctx.rect(hx * scale - radius, hy * scale - radius, radius * 2, radius * 2);
    ctx.fillStyle = SELECTION_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.5 * pixel;
    ctx.strokeStyle = '#1d2321';
    ctx.stroke();
  }
}

/** Renders a whole document into a canvas of any size (thumbnails, previews). */
export function renderThumbnail(canvas: HTMLCanvasElement, document: PatternDocument): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = Math.min(canvas.width / document.width, canvas.height / document.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(
    (canvas.width - document.width * scale) / 2,
    (canvas.height - document.height * scale) / 2,
  );
  ctx.fillStyle = document.background;
  ctx.fillRect(0, 0, document.width * scale, document.height * scale);
  drawShapes(ctx, document, scale);
  ctx.restore();
}

export const GUIDE_COLOR = '#e0457b';

/** Smart guides across the whole material, drawn under the moving piece. */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  guides: Guides,
  document: PatternDocument,
  scale: number,
  pixel: number,
): void {
  if (guides.x === null && guides.y === null) return;
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1.5 * pixel;
  ctx.setLineDash([6 * pixel, 4 * pixel]);
  ctx.beginPath();
  if (guides.x !== null) {
    ctx.moveTo(guides.x * scale, 0);
    ctx.lineTo(guides.x * scale, document.height * scale);
  }
  if (guides.y !== null) {
    ctx.moveTo(0, guides.y * scale);
    ctx.lineTo(document.width * scale, guides.y * scale);
  }
  ctx.stroke();
  ctx.restore();
}
