/**
 * Draws a Barniz de Pasto design from a parsed brief: it lays the motifs out on
 * the wooden object (a hero at the center, rings of repeats, a rim, corners,
 * flanking pairs), picks a lamina color for every part and orders the laminas
 * so that details always sit on top of what they decorate.
 *
 * Everything is computed in the browser from the shared motif drawings.
 */

import { C, buildBarnizDoc, curved, dot } from './barniz-drawing';
import {
  DesignBrief,
  MotifKind,
  MotifRequest,
  Placement,
  colorName,
  parseDescription,
} from './design-brief';
import {
  BarnizLayer,
  BarnizObject,
  MAX_LAYERS,
  PatternDocument,
  RadialGroup,
  Shape,
} from './document';
import {
  HUMMINGBIRD_EYE,
  fretParts,
  frailejonParts,
  hummingbirdParts,
  polarSun,
} from './motif-library';
import {
  Pt,
  circle,
  flower,
  leafShape,
  mirrorX,
  place,
  polar,
  ribbon,
  smoothClosed,
} from './motifs';

type Role = 'main' | 'second' | 'accent' | 'detail';

interface Part {
  name: string;
  role: Role;
  pts: Pt[];
  /** Cut as a round dot (an ellipse piece) instead of a path. */
  round?: boolean;
  /** Stacking inside the motif; defaults to the role order. */
  z?: number;
}

interface Variant {
  seed: number;
  petals: number;
  rich: boolean;
}

const ROLE_Z: Record<Role, number> = { main: 1, second: 2, accent: 3, detail: 4 };
const WHITE = '#f3ead8';
const BROWN = '#8a5230';
const PINK = '#d9668c';

// ---------- Motif drawings, each roughly within ±50 mm of its own origin ----------

const DRAW: Record<MotifKind, (v: Variant) => Part[]> = {
  colibri: () => {
    const bird = hummingbirdParts();
    return [
      { name: 'tail', role: 'second', pts: bird.tail },
      { name: 'body', role: 'main', pts: bird.body },
      { name: 'wing', role: 'second', pts: bird.wing },
      { name: 'throat', role: 'accent', pts: bird.throat },
      { name: 'beak', role: 'detail', pts: bird.beak },
      { name: 'eye', role: 'detail', pts: place(circle(3.2), ...HUMMINGBIRD_EYE), round: true },
    ];
  },
  flor: (v) => {
    const parts: Part[] = [
      { name: 'petals', role: 'main', pts: flower(40, v.petals, 0.42, 120) },
      { name: 'eye', role: 'detail', pts: circle(13), round: true },
    ];
    if (v.rich) {
      parts.unshift(
        { name: 'leaf-l', role: 'second', pts: place(leafShape(40, 17, 0.2), -34, 40, -140), z: 0 },
        { name: 'leaf-r', role: 'second', pts: place(leafShape(40, 17, -0.2), 34, 40, 140), z: 0 },
      );
    }
    return parts;
  },
  hoja: (v) => [{ name: 'leaf', role: 'main', pts: leafShape(90, 36, v.seed % 2 ? -0.18 : 0.18) }],
  estrella: (v) => {
    const points = v.rich ? 8 : 5;
    const star = polar(
      (t) => 46 * (0.44 + 0.56 * Math.abs(Math.cos((points * t) / 2)) ** 2.2),
      120,
    );
    return [{ name: 'star', role: 'main', pts: star }];
  },
  sol: (v) => {
    const parts: Part[] = [
      { name: 'rays', role: 'main', pts: polarSun(46) },
      { name: 'face', role: 'accent', pts: flower(24, 16, 0.1, 120) },
    ];
    if (v.rich) parts.push({ name: 'heart', role: 'detail', pts: flower(11, 8, 0.45, 96) });
    return parts;
  },
  luna: () => [{ name: 'moon', role: 'main', pts: crescent() }],
  mariposa: () => {
    const upper = smoothClosed(
      [
        [2, -4],
        [12, -30],
        [32, -46],
        [48, -38],
        [46, -16],
        [24, -4],
      ],
      8,
    );
    const lower = smoothClosed(
      [
        [2, 2],
        [24, 4],
        [38, 18],
        [32, 38],
        [16, 40],
        [4, 16],
      ],
      8,
    );
    const antenna = ribbon(
      [
        [1, -24],
        [6, -38],
        [13, -48],
      ],
      2,
      1.6,
      6,
    );
    return [
      { name: 'wing-ul', role: 'main', pts: mirrorX(upper) },
      { name: 'wing-ur', role: 'main', pts: upper },
      { name: 'wing-ll', role: 'second', pts: mirrorX(lower) },
      { name: 'wing-lr', role: 'second', pts: lower },
      { name: 'spot-l', role: 'accent', pts: place(circle(6), -30, -28), round: true },
      { name: 'spot-r', role: 'accent', pts: place(circle(6), 30, -28), round: true },
      {
        name: 'body',
        role: 'detail',
        pts: ribbon(
          [
            [0, -26],
            [0, 2],
            [0, 34],
          ],
          7,
          3,
          6,
        ),
      },
      { name: 'antenna-l', role: 'detail', pts: mirrorX(antenna) },
      { name: 'antenna-r', role: 'detail', pts: antenna },
    ];
  },
  pez: () => [
    {
      name: 'tail',
      role: 'second',
      pts: smoothClosed(
        [
          [-26, 0],
          [-46, -22],
          [-56, -18],
          [-46, 0],
          [-56, 18],
          [-46, 22],
        ],
        8,
      ),
    },
    {
      name: 'fin',
      role: 'second',
      pts: smoothClosed(
        [
          [-2, -18],
          [8, -34],
          [20, -30],
          [18, -18],
        ],
        8,
      ),
    },
    {
      name: 'body',
      role: 'main',
      pts: smoothClosed(
        [
          [50, 0],
          [38, -16],
          [14, -24],
          [-10, -20],
          [-28, -8],
          [-34, 0],
          [-28, 8],
          [-10, 20],
          [14, 24],
          [38, 16],
        ],
        8,
      ),
    },
    {
      name: 'gill',
      role: 'accent',
      pts: ribbon(
        [
          [20, -13],
          [24, 0],
          [20, 13],
        ],
        3.4,
        3.4,
        8,
      ),
    },
    { name: 'eye', role: 'detail', pts: place(circle(4.5), 34, -5), round: true },
  ],
  cuy: () => [
    {
      name: 'body',
      role: 'main',
      pts: smoothClosed(
        [
          [-48, 8],
          [-44, -10],
          [-28, -24],
          [-4, -30],
          [20, -28],
          [38, -18],
          [50, -4],
          [50, 8],
          [40, 18],
          [16, 24],
          [-20, 24],
          [-40, 20],
        ],
        8,
      ),
    },
    {
      name: 'patch',
      role: 'second',
      pts: smoothClosed(
        [
          [-32, -14],
          [-14, -24],
          [4, -18],
          [0, -2],
          [-18, 6],
          [-36, 2],
        ],
        8,
      ),
    },
    {
      name: 'ear',
      role: 'accent',
      pts: smoothClosed(
        [
          [22, -26],
          [26, -40],
          [38, -38],
          [36, -24],
        ],
        8,
      ),
    },
    { name: 'nose', role: 'accent', pts: place(circle(3.4), 50, 2), round: true },
    { name: 'eye', role: 'detail', pts: place(circle(4), 36, -9), round: true },
  ],
  mazorca: () => {
    const husk = place(leafShape(74, 24, -0.25), -16, 14, -14);
    const groove = (x: number) =>
      ribbon(
        [
          [x, -38],
          [x * 1.25, -6],
          [x, 26],
        ],
        2.4,
        2.4,
        8,
      );
    return [
      {
        name: 'cob',
        role: 'main',
        pts: smoothClosed(
          [
            [0, -52],
            [12, -44],
            [18, -20],
            [18, 10],
            [12, 30],
            [0, 36],
            [-12, 30],
            [-18, 10],
            [-18, -20],
            [-12, -44],
          ],
          8,
        ),
      },
      { name: 'groove-l', role: 'accent', pts: groove(-7) },
      { name: 'groove-r', role: 'accent', pts: groove(7) },
      { name: 'husk-l', role: 'second', pts: husk },
      { name: 'husk-r', role: 'second', pts: mirrorX(husk) },
    ];
  },
  corazon: (v) => {
    const parts: Part[] = [{ name: 'heart', role: 'main', pts: heart(3) }];
    if (v.rich) parts.push({ name: 'inner', role: 'accent', pts: heart(1.4) });
    return parts;
  },
  frailejon: () => {
    const f = frailejonParts();
    return [
      { name: 'trunk', role: 'second', pts: f.trunk, z: 0 },
      { name: 'rosette', role: 'main', pts: f.rosette },
      { name: 'stalk-l', role: 'detail', pts: f.stalk(-1) },
      { name: 'stalk-r', role: 'detail', pts: f.stalk(1) },
      { name: 'flower-l', role: 'detail', pts: place(flower(5.5, 6, 0.4, 48), -13, -74) },
      { name: 'flower-r', role: 'detail', pts: place(flower(5.5, 6, 0.4, 48), 13, -74) },
    ];
  },
  espiral: () => [{ name: 'spiral', role: 'main', pts: fretParts().spiral }],
  punto: () => [{ name: 'dot', role: 'main', pts: circle(10), round: true }],
  greca: () => [{ name: 'fret', role: 'main', pts: fretParts().pyramid }],
};

/** A crescent moon: the part of a disc not covered by a second, offset disc. */
function crescent(): Pt[] {
  const r1 = 50;
  const d = 24;
  const r2 = 44;
  const ix = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const iy = Math.sqrt(r1 * r1 - ix * ix);
  const a1 = Math.atan2(iy, ix);
  const b1 = Math.atan2(iy, ix - d);
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = a1 + ((2 * Math.PI - 2 * a1) * i) / 40;
    pts.push([r1 * Math.cos(a), -r1 * Math.sin(a)]);
  }
  for (let i = 1; i < 40; i++) {
    const b = -b1 - ((2 * Math.PI - 2 * b1) * i) / 40;
    pts.push([d + r2 * Math.cos(b), -r2 * Math.sin(b)]);
  }
  return pts;
}

function heart(k: number): Pt[] {
  return Array.from({ length: 96 }, (_, i) => {
    const t = (2 * Math.PI * i) / 96;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x * k, -y * k] as const;
  });
}

// ---------- Colors ----------

interface Palette {
  main: string;
  second: string[];
  accent: string[];
}

const DEFAULTS: Record<MotifKind, Palette> = {
  colibri: { main: C.green, second: [C.blue, C.turquoise], accent: [C.red, C.orange] },
  flor: { main: C.red, second: [C.green, C.olive], accent: [C.gold] },
  hoja: { main: C.green, second: [], accent: [] },
  estrella: { main: C.gold, second: [], accent: [] },
  sol: { main: C.gold, second: [], accent: [C.red, C.orange] },
  luna: { main: WHITE, second: [], accent: [] },
  mariposa: { main: C.orange, second: [C.magenta, C.blue], accent: [C.gold, C.turquoise] },
  pez: { main: C.turquoise, second: [C.orange, C.blue], accent: [C.red, C.gold] },
  cuy: { main: BROWN, second: [WHITE, C.gold], accent: [PINK, C.red] },
  mazorca: { main: C.gold, second: [C.green, C.olive], accent: [C.orange, C.red] },
  corazon: { main: C.red, second: [], accent: [C.gold, PINK] },
  frailejon: { main: C.green, second: [C.olive, BROWN], accent: [] },
  espiral: { main: C.turquoise, second: [], accent: [] },
  punto: { main: C.gold, second: [], accent: [] },
  greca: { main: C.red, second: [], accent: [] },
};
const DETAILS = [C.gold, C.red, WHITE, C.blue, C.green, C.orange];
const FALLBACK = [C.gold, C.red, C.green, C.blue, C.turquoise, C.orange, WHITE, C.magenta];

/**
 * Lamina order as a graph: "a must be cut below b" for every part painted on top of
 * another part of a different color. Colors that were not requested are chosen so the
 * graph stays acyclic, so a flower's gold eye and a sun's red face can both be on top.
 */
class LaminaOrder {
  private readonly below = new Map<string, Set<string>>();
  readonly firstSeen: string[] = [];

  see(color: string): void {
    if (!this.firstSeen.includes(color)) this.firstSeen.push(color);
  }

  private reaches(from: string, to: string): boolean {
    const stack = [from];
    const seen = new Set<string>();
    while (stack.length) {
      const node = stack.pop()!;
      if (node === to) return true;
      if (seen.has(node)) continue;
      seen.add(node);
      stack.push(...(this.below.get(node) ?? []));
    }
    return false;
  }

  /** Whether `color` can sit above `under` and below `over` without contradicting earlier motifs. */
  fits(color: string, under: readonly string[], over: readonly string[] = []): boolean {
    return (
      under.every((u) => u === color || !this.reaches(color, u)) &&
      over.every((o) => o === color || !this.reaches(o, color))
    );
  }

  add(under: string, over: string): void {
    if (under === over || this.reaches(over, under)) return;
    if (!this.below.has(under)) this.below.set(under, new Set());
    this.below.get(under)!.add(over);
  }

  /** Bottom to top: a topological order that prefers the order colors were first used. */
  sorted(): string[] {
    const indegree = new Map(this.firstSeen.map((c) => [c, 0]));
    for (const overs of this.below.values()) {
      for (const over of overs) indegree.set(over, (indegree.get(over) ?? 0) + 1);
    }
    const out: string[] = [];
    const ready = () => this.firstSeen.filter((c) => !out.includes(c) && indegree.get(c) === 0);
    while (out.length < this.firstSeen.length) {
      const next = ready()[0] ?? this.firstSeen.find((c) => !out.includes(c))!;
      out.push(next);
      for (const over of this.below.get(next) ?? []) {
        indegree.set(over, (indegree.get(over) ?? 1) - 1);
      }
    }
    return out;
  }
}

/** Resolves the four role colors of one motif instance. */
function roleColors(
  kind: MotifKind,
  requested: readonly string[],
  parts: readonly Part[],
  order: LaminaOrder,
): Record<Role, string> {
  const defaults = DEFAULTS[kind];
  const main = requested[0] ?? defaults.main;
  const roles: Role[] = ['main', 'second', 'accent', 'detail'];
  const used = roles.filter((role) => parts.some((part) => part.role === role));
  const zOf = (role: Role) =>
    Math.min(...parts.filter((p) => p.role === role).map((p) => p.z ?? ROLE_Z[p.role]));
  const chosen: Partial<Record<Role, string>> = { main };
  let extra = 1;
  for (const role of used.slice(1)) {
    const given = requested[extra];
    if (given) {
      chosen[role] = given;
      extra++;
      continue;
    }
    const candidates =
      role === 'second'
        ? [...defaults.second, ...FALLBACK]
        : role === 'accent'
          ? [...defaults.accent, ...DETAILS]
          : DETAILS;
    const taken = Object.values(chosen) as string[];
    const others = (Object.keys(chosen) as Role[]).filter((r) => zOf(r) !== zOf(role));
    const under = others.filter((r) => zOf(r) < zOf(role)).map((r) => chosen[r]!);
    const over = others.filter((r) => zOf(r) > zOf(role)).map((r) => chosen[r]!);
    chosen[role] =
      candidates.find((c) => !taken.includes(c) && order.fits(c, under, over)) ??
      candidates.find((c) => c !== main && order.fits(c, under, over)) ??
      candidates.find((c) => c !== main) ??
      C.gold;
  }
  return {
    main,
    second: chosen.second ?? main,
    accent: chosen.accent ?? main,
    detail: chosen.detail ?? main,
  };
}

// ---------- Placement ----------

interface Spot {
  x: number;
  y: number;
  /** Longest side of the motif's bounding box, in millimeters. */
  box: number;
  rotation: number;
  mirror: boolean;
  colors: string[];
}

interface Ring {
  spots: Spot[];
  /** Radial repeat: only the first spot is drawn and the editor makes the copies. */
  radial?: number;
}

const PLURAL: Record<MotifKind, [string, string]> = {
  colibri: ['colibrí', 'colibríes'],
  flor: ['flor', 'flores'],
  hoja: ['hoja', 'hojas'],
  estrella: ['estrella', 'estrellas'],
  sol: ['sol', 'soles'],
  luna: ['luna', 'lunas'],
  mariposa: ['mariposa', 'mariposas'],
  pez: ['pez', 'peces'],
  cuy: ['cuy', 'cuyes'],
  mazorca: ['mazorca', 'mazorcas'],
  corazon: ['corazón', 'corazones'],
  frailejon: ['frailejón', 'frailejones'],
  espiral: ['espiral', 'espirales'],
  punto: ['punto', 'puntos'],
  greca: ['greca', 'grecas'],
};

const PLACEMENT_TEXT: Record<Placement, string> = {
  centro: 'al centro',
  alrededor: 'alrededor',
  borde: 'en el borde',
  esquinas: 'en las esquinas',
  lados: 'a los lados',
  arriba: 'arriba',
  abajo: 'abajo',
  izquierda: 'a la izquierda',
  derecha: 'a la derecha',
};

const OBJECT_TEXT: Record<BarnizObject['kind'], string> = {
  plate: 'Plato',
  bowl: 'Cuenco',
  box: 'Caja',
  tray: 'Bandeja',
};

/** Motifs that read well as the single big figure at the center. */
const SMALL_ONLY = new Set<MotifKind>(['punto', 'greca', 'espiral']);

export interface ComposedDesign {
  document: PatternDocument;
  brief: DesignBrief;
  /** What was understood and decided, in Spanish, for the artisan. */
  notes: string[];
}

/** Parses and draws in one step; `null` when the text names no motif. */
export function designFromText(text: string, seed = 0): ComposedDesign | null {
  const brief = parseDescription(text);
  return brief.motifs.length ? composeDesign(brief, seed) : null;
}

export function composeDesign(brief: DesignBrief, seed = 0): ComposedDesign {
  const round = brief.object === 'plate' || brief.object === 'bowl';
  const W = brief.width;
  const H = brief.height;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) / 2;
  const notes: string[] = [];

  /** A point at `r` (fraction of the half size) and `deg` clockwise from the top. */
  const at = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    const rx = round ? R : W / 2;
    const ry = round ? R : H / 2;
    return [cx + r * rx * Math.sin(a), cy - r * ry * Math.cos(a)];
  };

  // 1. Who goes where
  const motifs = brief.motifs.map((m) => ({ ...m }));
  const heroIndex = (() => {
    const centered = motifs.findIndex((m) => m.placement === 'centro' && m.count === 1);
    if (centered >= 0) return centered;
    return motifs.findIndex(
      (m) => m.placement === null && m.count === 1 && !SMALL_ONLY.has(m.kind),
    );
  })();
  const free: Placement[] = ['arriba', 'abajo', 'izquierda', 'derecha'];
  motifs.forEach((m, i) => {
    if (i === heroIndex) m.placement = 'centro';
    else if (m.placement === null) {
      if (SMALL_ONLY.has(m.kind) && m.kind !== 'espiral') m.placement = 'borde';
      // Plants grow from the ground: a row along the bottom.
      else if (m.kind === 'frailejon' && m.count <= 5) m.placement = 'abajo';
      else if (m.count >= 3) m.placement = 'alrededor';
      else if (m.count === 2) m.placement = 'lados';
      else m.placement = free.find((p) => !motifs.some((o) => o.placement === p)) ?? 'arriba';
    } else if (m.placement === 'centro' && i !== heroIndex && heroIndex >= 0 && m.count === 1) {
      m.placement = 'alrededor';
    }
  });
  const rings = motifs.filter((m) => m.placement === 'alrededor');
  const rims = motifs.filter((m) => m.placement === 'borde');
  const secondary = motifs.some((m) =>
    ['lados', 'arriba', 'abajo', 'izquierda', 'derecha'].includes(m.placement!),
  );
  const cornersOnRound = round && motifs.some((m) => m.placement === 'esquinas');

  const outer = rims.length ? 0.76 : 0.93;
  const hasCenter = motifs.some((m) => m.placement === 'centro');
  let inner = rings.length === 0 ? outer : secondary ? 0.6 : hasCenter ? 0.42 : 0.22;
  if (rings.length && (outer - inner) / rings.length < 0.13) {
    inner = Math.max(0.22, outer - 0.13 * rings.length);
  }
  const band = rings.length ? (outer - inner) / rings.length : 0;
  // Without a center figure the side and top/bottom motifs share the whole area.
  const secondaryR = hasCenter ? Math.min(inner, cornersOnRound ? 0.8 : 1) * 0.74 : inner * 0.5;
  const secondaryBox = (hasCenter ? inner * 0.48 : inner * 0.85) * R;
  const heroBox = (secondary ? inner * 0.75 : inner * 1.4) * R;

  const tilt = seed % 3 === 1 ? -8 : seed % 3 === 2 ? 8 : 0;
  const phaseHalf = seed % 2 === 1;
  const placed = new Map<MotifRequest, Ring>();
  const colorAt = (m: MotifRequest, i: number) =>
    m.colors.length > 1 && m.count > 1 ? [m.colors[i % m.colors.length]] : m.colors;

  let ringIndex = 0;
  for (const m of motifs) {
    const spots: Spot[] = [];
    let radial: number | undefined;
    const scale = Math.min(1.25, m.scale);
    switch (m.placement) {
      case 'centro': {
        if (m.count === 1) {
          spots.push({
            x: cx,
            y: cy,
            box: heroBox * Math.min(1, scale),
            rotation: tilt,
            mirror: false,
            colors: m.colors,
          });
        } else {
          const r = (hasCenter && heroIndex >= 0 ? inner : Math.max(inner, 0.4)) * 0.45;
          const chord = (2 * Math.PI * r) / m.count;
          const box = Math.min(r * 1.1, chord * 0.9) * R * scale;
          for (let i = 0; i < m.count; i++) {
            const deg = (360 / m.count) * i;
            spots.push({
              ...xy(at(r, deg)),
              box,
              rotation: deg,
              mirror: false,
              colors: colorAt(m, i),
            });
          }
        }
        break;
      }
      case 'alrededor': {
        const r = inner + band * (ringIndex + 0.5);
        ringIndex++;
        const chord = (2 * Math.PI * r) / m.count;
        const box = Math.min(band * 0.92, chord * 0.86 * scale, band * 0.92 * scale) * R;
        const phase = phaseHalf ? 180 / m.count : 0;
        for (let i = 0; i < m.count; i++) {
          const deg = phase + (360 / m.count) * i;
          spots.push({
            ...xy(at(r, deg)),
            box,
            rotation: deg,
            mirror: false,
            colors: colorAt(m, i),
          });
        }
        if (round && m.colors.length <= 1 && m.count >= 2 && m.count <= 24) radial = m.count;
        break;
      }
      case 'borde': {
        if (round) {
          const r = 0.87;
          const chord = (2 * Math.PI * r) / m.count;
          const box = Math.min(0.15, chord * 0.8) * R * Math.min(1, scale);
          for (let i = 0; i < m.count; i++) {
            const deg = (360 / m.count) * i;
            spots.push({
              ...xy(at(r, deg)),
              box,
              rotation: deg,
              mirror: false,
              colors: colorAt(m, i),
            });
          }
          if (m.colors.length <= 1 && m.count >= 2 && m.count <= 24) radial = m.count;
        } else {
          spots.push(...rimSpots(m, W, H, R, colorAt));
        }
        break;
      }
      case 'esquinas': {
        if (m.countGiven && m.count !== 4) {
          notes.push(`Las esquinas son 4: dibujé 4 ${PLURAL[m.kind][1]} en lugar de ${m.count}.`);
        }
        m.count = 4;
        const box = (round ? 0.24 : 0.36) * R * Math.min(1, scale);
        const inset = box * 0.75;
        const corners: [number, number, number][] = round
          ? [45, 135, 225, 315].map((deg) => [...at(0.74, deg), deg] as [number, number, number])
          : [
              [inset, inset, -45],
              [W - inset, inset, 45],
              [W - inset, H - inset, 135],
              [inset, H - inset, 225],
            ];
        corners.forEach(([x, y, deg], i) =>
          spots.push({ x, y, box, rotation: deg, mirror: false, colors: colorAt(m, i) }),
        );
        break;
      }
      case 'lados': {
        const per = Math.max(1, Math.ceil(m.count / 2));
        const box = (secondaryBox / Math.max(1, per * 0.7)) * Math.min(1, scale);
        let k = 0;
        for (const side of [-1, 1]) {
          for (let j = 0; j < per && k < m.count; j++, k++) {
            const [x, y] = at(secondaryR, side < 0 ? 270 : 90);
            const dy = (j - (per - 1) / 2) * box * 1.1;
            spots.push({ x, y: y + dy, box, rotation: 0, mirror: side > 0, colors: colorAt(m, k) });
          }
        }
        break;
      }
      default: {
        // arriba, abajo, izquierda, derecha: upright, in a row when there are several.
        const deg = { arriba: 0, abajo: 180, izquierda: 270, derecha: 90 }[
          m.placement as 'arriba' | 'abajo' | 'izquierda' | 'derecha'
        ];
        const horizontal = deg === 0 || deg === 180;
        const room =
          (horizontal ? (round ? 1.2 * R : W * 0.6) : round ? 1.2 * R : H * 0.6) / m.count;
        const box = Math.min(secondaryBox, room * 0.9) * Math.min(1, scale);
        const [x0, y0] = at(secondaryR, deg);
        for (let i = 0; i < m.count; i++) {
          const offset = (i - (m.count - 1) / 2) * box * 1.1;
          spots.push({
            x: horizontal ? x0 + offset : x0,
            y: horizontal ? y0 : y0 + offset,
            box,
            rotation: 0,
            mirror: deg === 90,
            colors: colorAt(m, i),
          });
        }
      }
    }
    placed.set(m, { spots, radial });
  }

  // 2. Draw: colors, laminas and pieces
  const order = new LaminaOrder();
  const pieces: { shape: Omit<Shape, 'layerId'>; color: string; group: string | null }[] = [];
  const groups: RadialGroup[] = [];
  motifs.forEach((m, mi) => {
    const ring = placed.get(m)!;
    const variant: Variant = {
      seed,
      petals: m.petals ?? [5, 6, 8][seed % 3],
      rich: m.placement === 'centro' && m.count === 1,
    };
    const unit = DRAW[m.kind](variant);
    const fitted = fit(unit);
    const drawn = ring.radial ? ring.spots.slice(0, 1) : ring.spots;
    const palettes = new Map<string, Record<Role, string>>();
    drawn.forEach((spot, si) => {
      // Every copy with the same requested colors gets the same laminas.
      const key = spot.colors.join();
      if (!palettes.has(key)) palettes.set(key, roleColors(m.kind, spot.colors, unit, order));
      const colors = palettes.get(key)!;
      // Colors seen in stacking order so first appearance favors bottom laminas.
      [...unit]
        .sort((a, b) => (a.z ?? ROLE_Z[a.role]) - (b.z ?? ROLE_Z[b.role]))
        .forEach((part) => order.see(colors[part.role]));
      for (const a of unit) {
        for (const b of unit) {
          if ((a.z ?? ROLE_Z[a.role]) < (b.z ?? ROLE_Z[b.role])) {
            order.add(colors[a.role], colors[b.role]);
          }
        }
      }
      fitted.forEach((part, pi) => {
        const pts0 = spot.mirror ? mirrorX(part.pts) : part.pts;
        const pts = place(pts0, spot.x, spot.y, spot.rotation, spot.box / 100);
        const base = `${m.kind}${mi + 1}-${unit[pi].name}`;
        const id = ring.radial ? base : `${base}-${si + 1}`;
        const color = colors[unit[pi].role];
        let group: string | null = null;
        if (ring.radial) {
          group = `g-${base}`;
          groups.push({
            id: group,
            kind: 'radial',
            count: ring.radial,
            mirror: false,
            sourceId: id,
          });
        }
        const shape = part.round
          ? roundPiece(id, pts, color, group)
          : curved(id, pts, color, '', group);
        pieces.push({ shape, color, group });
      });
    });
  });

  // 3. Laminas, bottom to top, at most MAX_LAYERS of them
  let colors = order.sorted();
  if (colors.length > MAX_LAYERS) {
    const keep = colors.slice(0, MAX_LAYERS);
    const merged = colors.slice(MAX_LAYERS);
    notes.push(
      `Una pieza admite ${MAX_LAYERS} láminas: junté ${merged.length} colores con el más parecido.`,
    );
    const nearest = (hex: string) =>
      keep.reduce((best, c) => (distance(c, hex) < distance(best, hex) ? c : best), keep[0]);
    for (const piece of pieces) {
      if (!keep.includes(piece.color)) {
        piece.color = nearest(piece.color);
        piece.shape = { ...piece.shape, fill: piece.color };
      }
    }
    colors = keep;
  }
  const layers: BarnizLayer[] = colors.map((hex, i) => ({
    id: `l-${i + 1}`,
    name: colorName(hex),
    color: hex,
    visible: true,
    locked: false,
  }));
  const layerOf = new Map(colors.map((hex, i) => [hex, `l-${i + 1}`]));
  const shapes: Shape[] = pieces.map(({ shape, color }) => ({
    ...shape,
    layerId: layerOf.get(color)!,
  }));

  const object: BarnizObject = {
    kind: brief.object,
    width: W,
    height: H,
    baseColor: brief.baseColor,
    leaf: brief.leaf,
  };
  const document = buildBarnizDoc(object, layers, shapes, groups);

  // 4. What was understood
  const size = round ? `de ${W / 10} cm` : `de ${W / 10} × ${H / 10} cm`;
  const leafText = { gold: 'pan de oro', silver: 'pan de plata', none: 'sin pan de oro' }[
    brief.leaf
  ];
  notes.unshift(
    `${OBJECT_TEXT[brief.object]} ${size}, fondo ${brief.baseColorName ?? 'negro'}, ${leafText}.`,
    ...motifs.map((m) => {
      const name = PLURAL[m.kind][m.count === 1 ? 0 : 1];
      const chosen = m.colors.length
        ? m.colors.map((c) => colorName(c).toLowerCase()).join(' y ')
        : `${colorName(DEFAULTS[m.kind].main).toLowerCase()} (elegido por mí)`;
      const where = PLACEMENT_TEXT[m.placement!];
      const radial = placed.get(m)!.radial ? ', en repetición radial' : '';
      return `${m.count} ${name} en ${chosen}, ${where}${radial}.`;
    }),
  );
  if (brief.unknown.length) {
    notes.push(`No usé estas palabras: ${brief.unknown.map((w) => `«${w}»`).join(', ')}.`);
  }
  notes.push(`${layers.length} láminas y ${document.shapes.length} piezas para cortar.`);
  return { document, brief, notes };
}

/** Centers a drawing on its bounding box and scales its longest side to 100. */
function fit(parts: readonly Part[]): Part[] {
  const all = parts.flatMap((p) => p.pts);
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = 100 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return parts.map((p) => ({
    ...p,
    pts: p.pts.map(([x, y]) => [(x - mx) * k, (y - my) * k] as const),
  }));
}

function roundPiece(id: string, pts: readonly Pt[], color: string, group: string | null): Shape {
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const d = Math.max(2, Math.max(...xs) - Math.min(...xs));
  return dot(
    id,
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
    d,
    color,
    '',
    group,
  );
}

/** Evenly spaced along the inside of a rectangular rim, each turned to face outward. */
function rimSpots(
  m: MotifRequest,
  W: number,
  H: number,
  R: number,
  colorAt: (m: MotifRequest, i: number) => string[],
): Spot[] {
  const box = 0.15 * R * Math.min(1, m.scale);
  const inset = box * 0.75 + 4;
  const w = W - 2 * inset;
  const h = H - 2 * inset;
  const perimeter = 2 * (w + h);
  const count = m.countGiven ? m.count : Math.max(8, Math.floor(perimeter / (box * 1.5)));
  m.count = count;
  const step = perimeter / count;
  const spots: Spot[] = [];
  for (let i = 0; i < count; i++) {
    let d = step * (i + 0.5);
    let x: number;
    let y: number;
    let rotation: number;
    if (d < w) [x, y, rotation] = [inset + d, inset, 0];
    else if ((d -= w) < h) [x, y, rotation] = [W - inset, inset + d, 90];
    else if ((d -= h) < w) [x, y, rotation] = [W - inset - d, H - inset, 180];
    else [x, y, rotation] = [inset, H - inset - (d - w), 270];
    spots.push({
      x,
      y,
      box: Math.min(box, step * 0.9),
      rotation,
      mirror: false,
      colors: colorAt(m, i),
    });
  }
  return spots;
}

function xy([x, y]: [number, number]): { x: number; y: number } {
  return { x, y };
}

function distance(a: string, b: string): number {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [p, q] = [rgb(a), rgb(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
