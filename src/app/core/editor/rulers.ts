/** Ruler steps in millimeters, from fine to coarse. */
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/**
 * Picks the ruler's tick spacing for a zoom level: minor ticks at least 6 screen
 * pixels apart, labels at least 48 pixels apart, always on round numbers.
 */
export function rulerSteps(pixelsPerMm: number): { minor: number; label: number } {
  const minor = STEPS.find((step) => step * pixelsPerMm >= 6) ?? STEPS[STEPS.length - 1];
  const label = STEPS.find((step) => step >= minor && step * pixelsPerMm >= 48) ?? minor * 10;
  return { minor, label };
}

/**
 * Draws a millimeter ruler along one edge of the work area.
 * `origin` is where the material's 0 mm sits on screen (CSS pixels).
 */
export function drawRuler(
  canvas: HTMLCanvasElement,
  axis: 'x' | 'y',
  origin: number,
  pixelsPerMm: number,
  lengthMm: number,
): void {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const span = axis === 'x' ? width : height;
  const depth = axis === 'x' ? height : width;
  const { minor, label } = rulerSteps(pixelsPerMm);

  // The part of the ruler that covers the material is lighter, like a measuring tape.
  const start = Math.max(0, origin);
  const end = Math.min(span, origin + lengthMm * pixelsPerMm);
  ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
  if (end > start) {
    if (axis === 'x') ctx.fillRect(start, 0, end - start, depth);
    else ctx.fillRect(0, start, depth, end - start);
  }

  ctx.strokeStyle = 'rgb(29 35 33 / 0.55)';
  ctx.fillStyle = 'rgb(29 35 33 / 0.8)';
  ctx.lineWidth = 1;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  const first = Math.floor(-origin / pixelsPerMm / minor) * minor;
  const last = (span - origin) / pixelsPerMm;
  ctx.beginPath();
  for (let mm = first; mm <= last; mm += minor) {
    const at = Math.round(origin + mm * pixelsPerMm) + 0.5;
    const isLabel = Math.abs(mm % label) < 1e-6;
    const tick = isLabel ? depth * 0.6 : depth * 0.28;
    if (axis === 'x') {
      ctx.moveTo(at, depth);
      ctx.lineTo(at, depth - tick);
    } else {
      ctx.moveTo(depth, at);
      ctx.lineTo(depth - tick, at);
    }
    if (isLabel) {
      if (axis === 'x') {
        ctx.fillText(String(mm), at + 3, 2);
      } else {
        ctx.save();
        ctx.translate(2, at + 3);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(String(mm), 0, -10);
        ctx.restore();
      }
    }
  }
  ctx.stroke();
}
