import {
  ColorAnalysis,
  EvolvedVariations,
  LayerLayout,
  ParetoPoint,
  ParetoVariationsResult,
  VectorizeResult,
  WeightsInput,
} from '../api/patronlab-api';
import { ANILINE_COLORS, BarnizLayer, PatternDocument, Shape, clampShape, round } from './document';
import { area, boundingBox, outline } from './geometry';

/**
 * Computes client-side layer material statistics when the API's `optimizeLayout`
 * does not return `layers` or when running offline/fallback.
 */
export function computeLayerLayouts(
  document: PatternDocument,
  sheetWidth: number,
  sheetHeight: number,
  spacing: number,
): LayerLayout[] {
  const layers: BarnizLayer[] =
    document.layers && document.layers.length > 0
      ? document.layers
      : [...new Set(document.shapes.map((s) => s.fill))].map((color, i) => ({
          id: `l-${i + 1}`,
          name: `Color ${i + 1}`,
          color,
          visible: true,
          locked: false,
        }));

  const sheetAreaMm2 = Math.max(100, sheetWidth * sheetHeight);
  return layers.map((layer) => {
    const shapes = document.shapes.filter((s) =>
      document.layers?.length ? s.layerId === layer.id : s.fill === layer.color,
    );
    let totalAreaMm2 = 0;
    let curX = spacing;
    let curY = spacing;
    let rowH = 0;
    const placements = shapes.map((s) => {
      const poly = outline(s);
      totalAreaMm2 += area(poly);
      const box = boundingBox(s);
      const w = Math.max(4, round(box.width));
      const h = Math.max(4, round(box.height));
      if (curX + w + spacing > sheetWidth && curX > spacing) {
        curX = spacing;
        curY += rowH + spacing;
        rowH = 0;
      }
      const p = {
        shapeId: s.id,
        x: round(curX),
        y: round(curY),
        width: w,
        height: h,
        rotated: false,
      };
      curX += w + spacing;
      rowH = Math.max(rowH, h);
      return p;
    });
    const usedLength = shapes.length === 0 ? 0 : round(curY + rowH + spacing);
    const usedBoxArea = Math.max(totalAreaMm2, sheetWidth * usedLength);
    const wastePercent =
      shapes.length === 0 || usedBoxArea === 0
        ? 0
        : round(Math.max(0, Math.min(0.95, 1 - totalAreaMm2 / usedBoxArea)), 3);
    const sheets =
      shapes.length === 0
        ? 0
        : Math.max(1, Math.ceil(totalAreaMm2 / (1 - Math.min(0.7, wastePercent)) / sheetAreaMm2));
    return {
      layerId: layer.id,
      color: layer.color,
      areaCm2: round(totalAreaMm2 / 100, 1),
      usedLength,
      wastePercent,
      sheets,
      placements,
    };
  });
}

/** Perceptual color distance ΔE (CIE76 approximation in Lab space). */
export function deltaE(hexA: string, hexB: string): number {
  const [l1, a1, b1] = hexToLab(hexA);
  const [l2, a2, b2] = hexToLab(hexB);
  return round(Math.hypot(l1 - l2, a1 - a2, b1 - b2), 1);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean.length === 6 ? clean : '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s > 0.04045 ? ((s + 0.055) / 1.055) ** 2.4 : s / 12.92;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function nameSpanishColor(hex: string): string {
  const preset = ANILINE_COLORS.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  if (preset) return preset.name;
  let best = ANILINE_COLORS[0];
  let bestDist = Infinity;
  for (const c of ANILINE_COLORS) {
    const d = deltaE(hex, c.hex);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist < 22 ? best.name : `Tono ${hex.toUpperCase()}`;
}

export function fallbackAnalyzeColors(document: PatternDocument): ColorAnalysis {
  const colors = [
    ...new Set([
      ...(document.layers ?? []).map((l) => l.color.toLowerCase()),
      ...document.shapes.map((s) => s.fill.toLowerCase()),
    ]),
  ].slice(0, 8);
  const pairs: ColorAnalysis['pairs'] = [];
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const de = deltaE(colors[i], colors[j]);
      pairs.push({
        a: colors[i],
        b: colors[j],
        deltaE: de,
        tooSimilar: de < 14,
      });
    }
  }
  const names = colors.map((hex) => ({ hex, name: nameSpanishColor(hex) }));
  const harmonies: string[][] = [
    ['#d99b1e', '#b3202a', '#286b35', '#1f5fa0'],
    ['#d45b24', '#d99b1e', '#1e7f7a', '#632b6c'],
    ['#b3202a', '#d99b1e', '#6c7a36', '#1b1512'],
  ];
  return { pairs, names, harmonies };
}

export function fallbackVectorize(width: number, height: number, colors: number): VectorizeResult {
  const count = Math.min(8, Math.max(2, colors));
  const selected = ANILINE_COLORS.slice(0, count);
  const layers = selected.map((c, i) => ({
    id: `l-vec-${i + 1}`,
    name: c.name,
    color: c.hex,
    areaShare: round(1 / count, 2),
  }));
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.34;
  const shapes: Shape[] = [];
  layers.forEach((layer, idx) => {
    const ringCount = 4 + idx * 2;
    for (let k = 0; k < ringCount; k++) {
      const a = (2 * Math.PI * k) / ringCount + idx * 0.25;
      const dist = r * (0.3 + (idx / count) * 0.65);
      const x = round(cx + Math.cos(a) * dist);
      const y = round(cy + Math.sin(a) * dist);
      shapes.push({
        id: `s-vec-${idx + 1}-${k + 1}`,
        kind: 'path',
        x,
        y,
        width: 0,
        height: 0,
        rotation: round((a * 180) / Math.PI + 90),
        fill: layer.color,
        stroke: '#2b2420',
        layerId: layer.id,
        groupId: null,
        points: [
          [0, -18],
          [10, -4],
          [6, 16],
          [-6, 16],
          [-10, -4],
        ],
      });
    }
  });
  return {
    layers,
    shapes,
    elapsedMs: 145,
    notes: [
      `${count} láminas separadas por tono de anilina y ordenadas de fondo a superficie.`,
      'Contornos simplificados para corte limpio con bisturí.',
    ],
  };
}

export function fallbackEvolve(
  document: PatternDocument,
  palette: string[],
  weights: WeightsInput = {},
  generationStart = 1,
): EvolvedVariations {
  const colors =
    palette.length > 0
      ? palette
      : (document.layers ?? []).map((l) => l.color).concat(ANILINE_COLORS.map((c) => c.hex));
  const wBal = weights.balance ?? 0.5;
  const wCon = weights.contrast ?? 0.5;
  const baseTotal = round(0.62 + 0.08 * wBal, 2);

  const variations = [0, 1, 2, 3].map((idx) => {
    const angleShift = (idx + 1) * 12;
    const shapes = document.shapes.map((s, si) =>
      clampShape({
        ...s,
        rotation: s.rotation + (si % 2 === 0 ? angleShift : -angleShift),
        fill: colors[(si + idx) % colors.length] ?? s.fill,
      }),
    );
    const layers = (document.layers ?? []).map((l, li) => ({
      ...l,
      color: colors[(li + idx) % colors.length] ?? l.color,
    }));
    const score = {
      balance: round(Math.min(0.98, 0.72 + idx * 0.05 + wBal * 0.08), 2),
      overlap: round(0.84 - idx * 0.02, 2),
      contrast: round(Math.min(0.98, 0.76 + (3 - idx) * 0.04 + wCon * 0.08), 2),
      coverage: round(0.7 + idx * 0.03, 2),
      total: round(Math.min(0.96, baseTotal + 0.06 + idx * 0.03), 2),
    };
    return {
      document: { ...document, layers, shapes },
      score,
    };
  });

  const history = Array.from({ length: 5 }, (_, g) => ({
    generation: generationStart + g,
    best: round(Math.min(0.96, baseTotal + 0.04 * (g + 1)), 2),
    average: round(Math.min(0.9, baseTotal - 0.04 + 0.035 * (g + 1)), 2),
  }));

  return {
    original: {
      total: baseTotal,
      balance: 0.64,
      overlap: 0.78,
      contrast: 0.66,
      coverage: 0.65,
    },
    variations,
    history,
  };
}

export function fallbackPareto(
  document: PatternDocument,
  palette: string[],
): ParetoVariationsResult {
  const evolved = fallbackEvolve(document, palette);
  const points: ParetoPoint[] = evolved.variations.map((v, i) => ({
    document: v.document,
    balance: round(0.68 + i * 0.07, 2),
    contrast: round(0.88 - i * 0.05, 2),
    materialSaving: round(0.92 - i * 0.08, 2),
  }));
  return { points, elapsedMs: 95 };
}
