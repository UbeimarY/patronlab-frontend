import { Layout } from '../api/patronlab-api';
import { PatternDocument, Shape } from './document';
import { outline } from './geometry';
import { drawShape } from './render';

/**
 * Where each piece goes on the roll. The API places each piece's bounding box
 * (turned 90° when `rotated`); the piece is drawn inside its box exactly as it
 * will be cut, then the cutting route is traced through the pieces in order.
 */
export function placedShapes(document: PatternDocument, layout: Layout): Map<string, Shape> {
  const byId = new Map(document.shapes.map((shape) => [shape.id, shape]));
  const placed = new Map<string, Shape>();
  for (const placement of layout.placements) {
    const shape = byId.get(placement.shapeId);
    if (!shape) continue;
    const turned = {
      ...shape,
      x: 0,
      y: 0,
      rotation: shape.rotation + (placement.rotated ? 90 : 0),
    };
    const xs = outline(turned).map(([x]) => x);
    const ys = outline(turned).map(([, y]) => y);
    placed.set(shape.id, {
      ...turned,
      x: placement.x - Math.min(...xs),
      y: placement.y - Math.min(...ys),
    });
  }
  return placed;
}

export function drawCutPlan(
  canvas: HTMLCanvasElement,
  document: PatternDocument,
  layout: Layout,
  rollWidth: number,
  material: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const length = Math.max(layout.usedLength, 1);
  const scale = canvas.width / rollWidth;
  canvas.height = Math.ceil(length * scale) + 2;

  ctx.fillStyle = material;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const placed = placedShapes(document, layout);
  for (const shape of placed.values()) drawShape(ctx, shape, scale);

  // Cutting route: from the corner of the material through every piece, in order.
  const centers = layout.cutOrder
    .map((id) => placed.get(id))
    .filter((shape): shape is Shape => !!shape)
    .map((shape) => [shape.x * scale, shape.y * scale] as const);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (const [x, y] of centers) ctx.lineTo(x, y);
  ctx.strokeStyle = '#1d2321';
  ctx.lineWidth = Math.max(1.5, canvas.width / 400);
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const radius = Math.max(8, canvas.width / 60);
  ctx.font = `600 ${Math.round(radius * 1.1)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  centers.forEach(([x, y], i) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f0c23b';
    ctx.fill();
    ctx.strokeStyle = '#1d2321';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#1d2321';
    ctx.fillText(String(i + 1), x, y + 1);
  });
}

/**
 * The cutting plan as a real-size SVG (millimeters), ready for a laser cutter or a
 * plotter. Two layers: "corte" holds only the cut lines; "orden" the numbers and the
 * route, which can be hidden before cutting.
 */
export function cutPlanSvg(
  document: PatternDocument,
  layout: Layout,
  rollWidth: number,
  title: string,
): string {
  const placed = placedShapes(document, layout);
  const length = Math.ceil(layout.usedLength + 5);
  const fmt = (n: number) => n.toFixed(2);
  const cuts = [...placed.values()]
    .map((shape) => {
      const points = outline(shape)
        .map(([x, y]) => `${fmt(x)},${fmt(y)}`)
        .join(' ');
      return `    <polygon id="${shape.id}" points="${points}" fill="none" stroke="#d40000" stroke-width="0.1"/>`;
    })
    .join('\n');
  const centers = layout.cutOrder
    .map((id) => placed.get(id))
    .filter((shape): shape is Shape => !!shape);
  const route = ['0,0', ...centers.map((shape) => `${fmt(shape.x)},${fmt(shape.y)}`)].join(' ');
  const labels = centers
    .map(
      (shape, i) =>
        `    <text x="${fmt(shape.x)}" y="${fmt(shape.y)}" font-size="6" text-anchor="middle" dominant-baseline="central" fill="#1f4fbf">${i + 1}</text>`,
    )
    .join('\n');
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rollWidth}mm" height="${length}mm" viewBox="0 0 ${rollWidth} ${length}">`,
    `  <title>${escape(title)}: plan de corte</title>`,
    `  <rect width="${rollWidth}" height="${length}" fill="none" stroke="#999999" stroke-width="0.2"/>`,
    `  <g id="corte">`,
    cuts,
    `  </g>`,
    `  <g id="orden">`,
    `    <polyline points="${route}" fill="none" stroke="#1f4fbf" stroke-width="0.3" stroke-dasharray="2 1.5"/>`,
    labels,
    `  </g>`,
    `</svg>`,
    '',
  ].join('\n');
}
