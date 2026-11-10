/**
 * Curve toolkit for drawing organic motifs (petals, birds, volcano slopes, spirals).
 *
 * The document contract only stores closed polygons for `path` shapes, so every
 * curve here is sampled into a dense polygon: smooth on screen, in the SVG export
 * and in the cutting plan, without changing the API.
 */

export type Pt = readonly [number, number];

/** Closed Catmull-Rom spline through the control points, sampled `samples` times per span. */
export function smoothClosed(ctrl: readonly Pt[], samples = 8): Pt[] {
  const n = ctrl.length;
  if (n < 3) return [...ctrl];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    for (let s = 0; s < samples; s++) out.push(catmull(p0, p1, p2, p3, s / samples));
  }
  return out;
}

/** Open Catmull-Rom spline from the first to the last control point. */
export function smoothOpen(ctrl: readonly Pt[], samples = 8): Pt[] {
  const n = ctrl.length;
  if (n < 2) return [...ctrl];
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let s = 0; s < samples; s++) out.push(catmull(p0, p1, p2, p3, s / samples));
  }
  out.push(ctrl[n - 1]);
  return out;
}

function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/**
 * Outline of a tapered stroke along a smooth spine (beaks, stems, spirals, rays):
 * the width goes linearly from `startWidth` to `endWidth`.
 */
export function ribbon(
  spine: readonly Pt[],
  startWidth: number,
  endWidth: number,
  samples = 8,
): Pt[] {
  const pts = smoothOpen(spine, samples);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const last = pts.length - 1;
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)];
    const [bx, by] = pts[Math.min(last, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const half = (startWidth + (endWidth - startWidth) * (i / last)) / 2;
    left.push([x + nx * half, y + ny * half]);
    right.push([x - nx * half, y - ny * half]);
  });
  return [...left, ...right.reverse()];
}

/** Chaikin corner cutting: keeps a geometric outline (step frets) but softens its corners. */
export function roundCorners(poly: readonly Pt[], iterations = 2): Pt[] {
  let pts: Pt[] = [...poly];
  for (let k = 0; k < iterations; k++) {
    const next: Pt[] = [];
    pts.forEach(([x1, y1], i) => {
      const [x2, y2] = pts[(i + 1) % pts.length];
      next.push([0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2]);
      next.push([0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2]);
    });
    pts = next;
  }
  return pts;
}

/** Closed polar curve r(θ), θ = 0 pointing up. */
export function polar(radius: (theta: number) => number, count = 96): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (2 * Math.PI * i) / count;
    const r = radius(t);
    return [r * Math.sin(t), -r * Math.cos(t)] as const;
  });
}

export function circle(r: number, count = 36): Pt[] {
  return polar(() => r, count);
}

/** A flower with `petals` rounded lobes and soft notches between them. */
export function flower(r: number, petals = 5, depth = 0.42, count = 120): Pt[] {
  return polar(
    (t) => r * (1 - depth + depth * Math.pow(Math.abs(Math.cos((petals * t) / 2)), 0.65)),
    count,
  );
}

/**
 * A pointed leaf / petal along the vertical axis, base at y = +length/2, tip at y = -length/2.
 * `bend` curves the midrib sideways (as a fraction of the width), for flame and vine leaves.
 */
export function leafShape(length: number, width: number, bend = 0, samples = 10): Pt[] {
  const h = length / 2;
  const w = width / 2;
  const b = bend * width;
  return smoothClosed(
    [
      [b * 0.9, -h],
      [w * 0.75 + b * 0.6, -h * 0.45],
      [w, h * 0.2],
      [w * 0.45, h * 0.8],
      [0, h],
      [-w * 0.45, h * 0.8],
      [-w, h * 0.2],
      [-w * 0.75 + b * 0.6, -h * 0.45],
    ],
    samples,
  );
}

/** Rotates (degrees, clockwise), scales and moves a polygon. */
export function place(pts: readonly Pt[], dx = 0, dy = 0, rotation = 0, scale = 1): Pt[] {
  const a = (rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return pts.map(([x, y]) => [dx + (x * cos - y * sin) * scale, dy + (x * sin + y * cos) * scale]);
}

/** Mirrors a polygon across the vertical axis, keeping its winding order. */
export function mirrorX(pts: readonly Pt[]): Pt[] {
  return pts.map(([x, y]) => [-x, y] as const).reverse();
}
