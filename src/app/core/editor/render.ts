import { BarnizObject, PatternDocument, Shape } from './document';
import {
  Point,
  handlePositions,
  isShapeVisible,
  localDimensions,
  orderedShapesForRender,
  outline,
  toDocument,
} from './geometry';
import { Guides } from './snapping';

/** Canvas pixels per millimeter at zoom 1 (before the device pixel ratio). */
export const BASE_PX_PER_MM = 2;

export function tracePolygon(ctx: CanvasRenderingContext2D, points: Point[], scale: number): void {
  if (points.length === 0) return;
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale),
  );
  ctx.closePath();
}

/** Traces the silhouette of the wooden object in Barniz mode for painting and clipping. */
export function traceObjectShape(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
): void {
  const obj: BarnizObject = document.object ?? {
    kind: 'plate',
    width: document.width,
    height: document.height,
    baseColor: document.background,
    leaf: 'none',
  };
  const cx = (document.width / 2) * scale;
  const cy = (document.height / 2) * scale;
  const w = (obj.width || document.width) * scale;
  const h = (obj.height || document.height) * scale;

  ctx.beginPath();
  if (obj.kind === 'plate' || obj.kind === 'bowl') {
    const r = Math.min(w, h) / 2;
    ctx.arc(cx, cy, Math.max(4, r), 0, Math.PI * 2);
  } else {
    const radius = obj.kind === 'tray' ? Math.min(w, h) * 0.12 : Math.min(w, h) * 0.04;
    const x0 = cx - w / 2;
    const y0 = cy - h / 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x0, y0, w, h, radius);
    } else {
      ctx.rect(x0, y0, w, h);
    }
  }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  scale: number,
  barnizMode = false,
  leaf: 'none' | 'gold' | 'silver' = 'none',
): void {
  const pts = outline(shape);
  if (pts.length === 0) return;
  tracePolygon(ctx, pts, scale);

  if (barnizMode) {
    ctx.save();
    ctx.globalAlpha = leaf !== 'none' ? 0.86 : 0.92;
    if (leaf !== 'none') {
      ctx.globalCompositeOperation = 'multiply';
    }
    ctx.fillStyle = shape.fill;
    ctx.fill();

    // Subtle resin sheen across the stretched mopa-mopa sheet
    ctx.globalCompositeOperation = 'source-over';
    const { width, height } = localDimensions(shape);
    const r = Math.max(width, height) * 0.6 * scale;
    if (r > 2 && typeof ctx.createLinearGradient === 'function') {
      const sheen = ctx.createLinearGradient(
        (shape.x - width * 0.4) * scale,
        (shape.y - height * 0.4) * scale,
        (shape.x + width * 0.4) * scale,
        (shape.y + height * 0.4) * scale,
      );
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.02)');
      sheen.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = sheen;
      ctx.fill();
    }
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.8, 0.45 * scale);
    ctx.strokeStyle = leaf === 'gold' ? 'rgba(212, 167, 54, 0.55)' : shape.stroke;
    ctx.stroke();
    return;
  }

  ctx.fillStyle = shape.fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, 0.6 * scale);
  ctx.strokeStyle = shape.stroke;
  ctx.stroke();
}

/**
 * Every visible shape in drawing order, optionally skipping one or a set of IDs
 * (the shapes being dragged on the interaction layer).
 * In Barniz mode, shapes are clipped to the wooden object's silhouette.
 */
export function drawShapes(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
  skip: string | ReadonlySet<string> | null = null,
  maxLayerCount?: number,
): void {
  const isSkipped = (id: string) =>
    typeof skip === 'string' ? id === skip : skip ? skip.has(id) : false;
  const isBarniz = document.mode === 'barniz';
  const leaf = document.object?.leaf ?? 'none';

  const allowedLayerIds =
    maxLayerCount !== undefined && document.layers?.length
      ? new Set(document.layers.slice(0, maxLayerCount).map((l) => l.id))
      : null;

  ctx.save();
  if (isBarniz) {
    traceObjectShape(ctx, document, scale);
    ctx.clip();
  }
  for (const shape of orderedShapesForRender(document)) {
    if (isSkipped(shape.id)) continue;
    if (!isShapeVisible(document, shape)) continue;
    if (allowedLayerIds && shape.layerId && !allowedLayerIds.has(shape.layerId)) continue;
    drawShape(ctx, shape, scale, isBarniz, leaf);
  }
  ctx.restore();
}

/**
 * The material piece or wooden Barniz object: in pattern mode, a millimeter cutting mat;
 * in Barniz mode, lacquered dark wood with optional gold/silver leaf and a specular rim.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
): void {
  if (document.mode === 'barniz') {
    drawBarnizBackground(ctx, document, scale);
    return;
  }
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

function drawBarnizBackground(
  ctx: CanvasRenderingContext2D,
  document: PatternDocument,
  scale: number,
): void {
  const w = document.width * scale;
  const h = document.height * scale;
  ctx.clearRect(0, 0, w, h);

  // Subtle workshop surface under the wooden piece
  ctx.fillStyle = '#18120f';
  ctx.fillRect(0, 0, w, h);

  const obj = document.object ?? {
    kind: 'plate',
    width: document.width,
    height: document.height,
    baseColor: document.background || '#1b1512',
    leaf: 'none',
  };

  ctx.save();
  traceObjectShape(ctx, document, scale);
  ctx.fillStyle = obj.baseColor || '#1b1512';
  ctx.fill();
  ctx.clip();

  // Procedural metallic leaf (gold or silver) applied before the mopa-mopa resin
  if (obj.leaf === 'gold' || obj.leaf === 'silver') {
    if (typeof ctx.createLinearGradient === 'function') {
      const metal = ctx.createLinearGradient(0, 0, w, h);
      if (obj.leaf === 'gold') {
        metal.addColorStop(0, 'rgba(245, 212, 122, 0.42)');
        metal.addColorStop(0.35, 'rgba(212, 167, 54, 0.25)');
        metal.addColorStop(0.68, 'rgba(252, 229, 150, 0.48)');
        metal.addColorStop(1, 'rgba(166, 121, 26, 0.32)');
      } else {
        metal.addColorStop(0, 'rgba(235, 240, 245, 0.42)');
        metal.addColorStop(0.4, 'rgba(180, 190, 200, 0.24)');
        metal.addColorStop(0.7, 'rgba(248, 251, 255, 0.46)');
        metal.addColorStop(1, 'rgba(135, 145, 156, 0.3)');
      }
      ctx.fillStyle = metal;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Turned wood / lacquer gloss
  if (typeof ctx.createRadialGradient === 'function') {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(w, h) / 2;
    const gloss = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.05, cx, cy, r);
    gloss.addColorStop(0, 'rgba(255, 248, 230, 0.14)');
    gloss.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, h);
  }

  // Rim ring for plate/bowl or inner bevel for box/tray
  ctx.strokeStyle =
    obj.leaf === 'gold'
      ? 'rgba(224, 182, 70, 0.45)'
      : obj.leaf === 'silver'
        ? 'rgba(210, 220, 230, 0.4)'
        : 'rgba(255, 240, 215, 0.15)';
  ctx.lineWidth = Math.max(1.5, 2.2 * scale);
  if (obj.kind === 'plate' || obj.kind === 'bowl') {
    const r = (Math.min(obj.width, obj.height) / 2) * scale;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.max(2, r * 0.88), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const inset = 12 * scale;
    ctx.strokeRect(inset, inset, Math.max(2, w - inset * 2), Math.max(2, h - inset * 2));
  }
  ctx.restore();

  // Outer rim stroke
  traceObjectShape(ctx, document, scale);
  ctx.strokeStyle = obj.leaf === 'gold' ? '#c99b2e' : 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.stroke();
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
  showNodes = false,
  selectedNodeIndex: number | null = null,
): void {
  tracePolygon(ctx, outline(shape), scale);
  ctx.lineWidth = 2 * pixel;
  ctx.strokeStyle = '#1d2321';
  ctx.stroke();
  ctx.setLineDash([5 * pixel, 4 * pixel]);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.stroke();
  ctx.setLineDash([]);

  const { width, height } = localDimensions(shape);
  const handles = handlePositions(shape, handleOffset);
  const [tx, ty] = handles.rotate;
  const [mx, my] = toDocument(shape, [0, -height / 2]);
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

  // Node handles when editing a `path` cut with the Bisturí
  if (showNodes && shape.kind === 'path' && shape.points) {
    const docPts = outline(shape);
    docPts.forEach(([nx, ny], idx) => {
      ctx.beginPath();
      const r = (idx === selectedNodeIndex ? 6.5 : 4.5) * pixel;
      ctx.arc(nx * scale, ny * scale, r, 0, Math.PI * 2);
      ctx.fillStyle = idx === selectedNodeIndex ? '#e0457b' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5 * pixel;
      ctx.strokeStyle = '#1d2321';
      ctx.stroke();
    });
  }
}

/** Draws the dotted knife cut line while drawing a new polygon with the Bisturí tool. */
export function drawKnifeDraft(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  cursorPoint: Point | null,
  scale: number,
  pixel: number,
): void {
  if (points.length === 0) return;
  ctx.save();
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x * scale, y * scale) : ctx.lineTo(x * scale, y * scale),
  );
  if (cursorPoint) {
    ctx.lineTo(cursorPoint[0] * scale, cursorPoint[1] * scale);
  }
  ctx.lineWidth = 2 * pixel;
  ctx.strokeStyle = '#1d2321';
  ctx.stroke();
  ctx.setLineDash([5 * pixel, 4 * pixel]);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.stroke();
  ctx.setLineDash([]);

  points.forEach(([x, y], i) => {
    ctx.beginPath();
    ctx.arc(x * scale, y * scale, (i === 0 ? 6 : 4) * pixel, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? SELECTION_COLOR : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5 * pixel;
    ctx.strokeStyle = '#1d2321';
    ctx.stroke();
  });
  ctx.restore();
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
  if (document.mode === 'barniz') {
    drawBarnizBackground(ctx, document, scale);
  } else {
    ctx.fillStyle = document.background;
    ctx.fillRect(0, 0, document.width * scale, document.height * scale);
  }
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
