import {
  BarnizLayer,
  BarnizObject,
  PatternDocument,
  PatternMode,
  Shape,
  migrateDocument,
} from './document';
import { C, buildBarnizDoc, curved, dot, shape } from './barniz-drawing';
import {
  HUMMINGBIRD_EYE,
  fretParts,
  frailejonParts,
  hummingbirdParts,
  polarSun,
  rosette as rosetteMotif,
} from './motif-library';
import {
  Pt,
  flower,
  leafShape,
  mirrorX,
  place,
  ribbon,
  roundCorners,
  smoothClosed,
  smoothOpen,
} from './motifs';

export interface Template {
  id: string;
  mode: PatternMode;
  label: string;
  description: string;
  build: (customObject?: Partial<BarnizObject>) => PatternDocument;
}

export const TEMPLATES: Template[] = [
  // ---------- Pattern mode templates ----------
  {
    id: 'blank',
    mode: 'pattern',
    label: 'En blanco',
    description: 'Pieza de 300 × 300 mm sin figuras.',
    build: () => migrateDocument({ width: 300, height: 300, background: '#f4f1ec', shapes: [] }),
  },
  {
    id: 'leaf-cushion',
    mode: 'pattern',
    label: 'Cojín de hojas',
    description: 'Hexágono central con ocho hojas, 400 × 400 mm.',
    build: () => {
      const shapes: Shape[] = [
        shape({
          id: 'base',
          kind: 'rect',
          x: 200,
          y: 200,
          width: 300,
          height: 300,
          rotation: 0,
          fill: '#e8dcc4',
        }),
        shape({
          id: 'center',
          kind: 'hexagon',
          x: 200,
          y: 200,
          width: 90,
          height: 90,
          rotation: 0,
          fill: '#7a2e1f',
        }),
      ];
      const leaves: [number, number, number][] = [
        [0, -95, 0],
        [95, 0, 90],
        [0, 95, 180],
        [-95, 0, 270],
        [-70, -70, 315],
        [70, -70, 45],
        [70, 70, 135],
        [-70, 70, 225],
      ];
      leaves.forEach(([dx, dy, angle], i) =>
        shapes.push(
          shape({
            id: `leaf-${i + 1}`,
            kind: 'leaf',
            x: 200 + dx,
            y: 200 + dy,
            width: 38,
            height: 80,
            rotation: angle > 180 ? angle - 360 : angle,
            fill: i < 4 ? '#3f6b3a' : '#9cae5b',
          }),
        ),
      );
      return migrateDocument({ width: 400, height: 400, background: '#f6efe3', shapes });
    },
  },
  {
    id: 'star-garland',
    mode: 'pattern',
    label: 'Guirnalda de estrellas',
    description: 'Siete estrellas alternas para cortar en fieltro, 600 × 200 mm.',
    build: () =>
      migrateDocument({
        width: 600,
        height: 200,
        background: '#eef1f4',
        shapes: Array.from({ length: 7 }, (_, i) =>
          shape({
            id: `star-${i + 1}`,
            kind: 'star',
            x: 60 + i * 80,
            y: i % 2 ? 120 : 80,
            width: 64,
            height: 64,
            rotation: i % 2 ? 18 : 0,
            fill: i % 2 ? '#d9a441' : '#2e5e8c',
          }),
        ),
      }),
  },

  // ---------- Barniz de Pasto templates ("inspiradas en la región") ----------
  {
    id: 'barniz-blank',
    mode: 'barniz',
    label: 'Objeto en blanco (Barniz)',
    description: 'Madera esmaltada con tres láminas listas para cortar a bisturí.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'plate',
        width: custom?.width ?? 300,
        height: custom?.height ?? 300,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'gold',
      };
      return buildBarnizDoc(
        obj,
        [
          { id: 'l-1', name: 'Amarillo ocre', color: '#d99b1e', visible: true, locked: false },
          { id: 'l-2', name: 'Rojo cochinilla', color: '#b3202a', visible: true, locked: false },
          { id: 'l-3', name: 'Verde mopa-mopa', color: '#286b35', visible: true, locked: false },
        ],
        [],
      );
    },
  },
  {
    id: 'barniz-hummingbird',
    mode: 'barniz',
    label: 'Plato con colibrí y flores (inspirado en la región)',
    description:
      'Plato de 300 mm con pan de oro: colibrí libando una flor de tubo y corona de flores y enredadera.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'plate',
        width: custom?.width ?? 300,
        height: custom?.width ?? 300,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'gold',
      };
      const s = obj.width / 300;
      const cx = obj.width / 2;
      const cy = obj.width / 2;
      /** Design units (300 mm plate, origin at the center) to document millimeters. */
      const T = (pts: readonly Pt[], dx = 0, dy = 0, rot = 0, k = 1) =>
        place(place(pts, dx, dy, rot, k), cx, cy, 0, s);
      const at = (x: number, y: number) => [cx + x * s, cy + y * s] as const;

      // Bottom to top: leaves and body, wing, flowers and throat, gold details.
      const layers: BarnizLayer[] = [
        { id: 'l-green', name: 'Verde mopa-mopa', color: C.green, visible: true, locked: false },
        { id: 'l-blue', name: 'Azul añil', color: C.blue, visible: true, locked: false },
        { id: 'l-red', name: 'Rojo cochinilla', color: C.red, visible: true, locked: false },
        { id: 'l-gold', name: 'Amarillo sol', color: C.gold, visible: true, locked: false },
      ];

      // Hummingbird drawn facing right in its own frame, then placed on the plate.
      const bird = { dx: -16, dy: 22, rot: -8, k: 0.9 };
      const B = (pts: readonly Pt[]) => T(pts, bird.dx, bird.dy, bird.rot, bird.k);
      const { body, throat, wing, tail, beak } = hummingbirdParts();

      // Trumpet flower (local frame: tube up, mouth down), turned toward the beak.
      const trumpet = smoothClosed(
        [
          [0, -24],
          [4, -20],
          [5, -6],
          [10, 8],
          [16, 18],
          [7, 15],
          [0, 21],
          [-7, 15],
          [-16, 18],
          [-10, 8],
          [-5, -6],
          [-4, -20],
        ],
        8,
      );
      const fl = { dx: 77, dy: -40, rot: 35, k: 0.95 };
      const sepal = leafShape(16, 12, 0, 8).map(([x, y]) => [x, y - 22] as const);
      const stamen = ribbon(
        [
          [0, 14],
          [-2, 24],
          [-1, 32],
        ],
        1.6,
        1.2,
        6,
      );

      const ringR = 118;
      const vineAngle = 11.25;
      const vineRad = (vineAngle * Math.PI) / 180;
      const dotAngle = 7.5;
      const dotRad = (dotAngle * Math.PI) / 180;

      const shapes: Shape[] = [
        // Crown: eight flowers, a vine of alternating leaves and a ring of gold dots.
        curved(
          'vine-leaf',
          T(leafShape(30, 12, 0.28), ringR * Math.sin(vineRad), -ringR * Math.cos(vineRad), 72),
          C.green,
          'l-green',
          'g-vine',
        ),
        curved('crown-flower', T(flower(15, 5, 0.42), 0, -ringR), C.red, 'l-red', 'g-flowers'),
        dot('crown-flower-eye', ...at(0, -ringR), 7 * s, C.gold, 'l-gold', 'g-flower-eyes'),
        dot(
          'rim-dot',
          ...at(138 * Math.sin(dotRad), -138 * Math.cos(dotRad)),
          4.5 * s,
          C.gold,
          'l-gold',
          'g-rim',
        ),

        // Hummingbird
        curved('bird-tail', B(tail), C.blue, 'l-blue'),
        curved('bird-body', B(body), C.green, 'l-green'),
        curved('bird-wing', B(wing), C.blue, 'l-blue'),
        curved('bird-throat', B(throat), C.red, 'l-red'),
        curved('bird-beak', B(beak), C.gold, 'l-gold'),
        dot(
          'bird-eye',
          ...(B([HUMMINGBIRD_EYE])[0] as [number, number]),
          5.5 * s,
          C.gold,
          'l-gold',
        ),

        // Flower the bird is feeding on
        curved('flower-sepal', T(sepal, fl.dx, fl.dy, fl.rot, fl.k), C.green, 'l-green'),
        curved('flower-tube', T(trumpet, fl.dx, fl.dy, fl.rot, fl.k), C.red, 'l-red'),
        curved('flower-stamen', T(stamen, fl.dx, fl.dy, fl.rot, fl.k), C.gold, 'l-gold'),
      ];
      return buildBarnizDoc(obj, layers, shapes, [
        { id: 'g-vine', kind: 'radial', count: 16, mirror: true, sourceId: 'vine-leaf' },
        { id: 'g-flowers', kind: 'radial', count: 8, mirror: false, sourceId: 'crown-flower' },
        {
          id: 'g-flower-eyes',
          kind: 'radial',
          count: 8,
          mirror: false,
          sourceId: 'crown-flower-eye',
        },
        { id: 'g-rim', kind: 'radial', count: 24, mirror: false, sourceId: 'rim-dot' },
      ]);
    },
  },
  {
    id: 'barniz-fret-box',
    mode: 'barniz',
    label: 'Caja con greca andina (inspirada en la región)',
    description:
      'Tapa de caja de 240 × 180 mm: sol de ocho rayos al centro y greca escalonada con espirales.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'box',
        width: custom?.width ?? 240,
        height: custom?.height ?? 180,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'gold',
      };
      const W = obj.width;
      const H = obj.height;
      const s = Math.min(W / 240, H / 180);
      const cx = W / 2;
      const cy = H / 2;

      // Bottom to top: sun rays, steps and sun disc, spirals and sun heart.
      const layers: BarnizLayer[] = [
        { id: 'l-1', name: 'Amarillo ocre', color: C.gold, visible: true, locked: false },
        { id: 'l-2', name: 'Rojo cochinilla', color: C.red, visible: true, locked: false },
        { id: 'l-3', name: 'Turquesa andino', color: C.turquoise, visible: true, locked: false },
      ];

      // Sun of eight long rays with eight short ones between them.
      const R = 50;
      const sunRays = Array.from({ length: 192 }, (_, i) => {
        const t = (2 * Math.PI * i) / 192;
        const long = 0.46 + 0.54 * Math.pow(Math.abs(Math.cos(4 * t)), 5);
        const short = 0.46 + 0.22 * Math.pow(Math.abs(Math.sin(4 * t)), 5);
        const r = R * Math.max(long, short);
        return [r * Math.sin(t), -r * Math.cos(t)] as const;
      });

      // Stepped pyramid frets with softened corners and coiled spiral hooks.
      const { pyramid, spiral } = fretParts();
      const rosette = rosetteMotif();

      const T = (pts: readonly Pt[], x: number, y: number, rot = 0) => place(pts, x, y, rot, s);
      const margin = 12 * s;
      const corner = 26 * s;
      const unit = 46 * s;
      const span = W - 2 * (margin + corner);
      const count = Math.max(2, Math.floor(span / unit));
      const start = cx - ((count - 1) * unit) / 2;

      const shapes: Shape[] = [
        curved('sun-rays', T(sunRays, cx, cy), C.gold, 'l-1'),
        curved('sun-disc', T(flower(25, 16, 0.12, 160), cx, cy), C.red, 'l-2'),
        curved('sun-heart', T(flower(12, 8, 0.45, 120), cx, cy), C.turquoise, 'l-3'),
      ];
      const topY = margin + 22 * s;
      const bottomY = H - margin - 22 * s;
      for (let i = 0; i < count; i++) {
        const x = start + i * unit;
        shapes.push(
          curved(`fret-top-${i + 1}`, T(pyramid, x, topY), C.red, 'l-2'),
          curved(`fret-bottom-${i + 1}`, T(pyramid, x, bottomY, 180), C.red, 'l-2'),
        );
        if (i < count - 1) {
          const sx = x + unit / 2;
          const right = i % 2 === 0;
          const sp = right ? spiral : mirrorX(spiral);
          shapes.push(
            curved(`spiral-top-${i + 1}`, T(sp, sx, topY - 8 * s), C.turquoise, 'l-3'),
            curved(`spiral-bottom-${i + 1}`, T(sp, sx, bottomY + 8 * s, 180), C.turquoise, 'l-3'),
          );
        }
      }
      const cornerX = margin + 12 * s;
      const cornerY = margin + 12 * s;
      (
        [
          [cornerX, cornerY],
          [W - cornerX, cornerY],
          [cornerX, H - cornerY],
          [W - cornerX, H - cornerY],
        ] as const
      ).forEach(([x, y], i) =>
        shapes.push(curved(`corner-${i + 1}`, T(rosette, x, y, 45), C.gold, 'l-1')),
      );
      // Side diamonds framing the sun
      [-1, 1].forEach((side, i) => {
        const x = cx + side * (W / 2 - margin - 12 * s);
        shapes.push(
          curved(
            `side-${i + 1}`,
            T(
              roundCorners(
                [
                  [0, -14],
                  [8, 0],
                  [0, 14],
                  [-8, 0],
                ],
                2,
              ),
              x,
              cy,
            ),
            C.turquoise,
            'l-3',
          ),
        );
      });
      return buildBarnizDoc(obj, layers, shapes);
    },
  },
  {
    id: 'barniz-galeras-tray',
    mode: 'barniz',
    label: 'Bandeja Galeras y frailejones (inspirada en la región)',
    description:
      'Bandeja de 360 × 240 mm: volcán Galeras con fumarola, sol andino, lomas y frailejones de páramo.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'tray',
        width: custom?.width ?? 360,
        height: custom?.height ?? 240,
        baseColor: custom?.baseColor ?? '#15191d',
        leaf: custom?.leaf ?? 'gold',
      };
      const sx = obj.width / 360;
      const sy = obj.height / 240;
      const k = Math.min(sx, sy);
      /** Scene coordinates (360 × 240) to document millimeters. */
      const S = (pts: readonly Pt[]) => pts.map(([x, y]) => [x * sx, y * sy] as const);
      /** A motif drawn in its own frame, placed at a scene point without distortion. */
      const M = (pts: readonly Pt[], x: number, y: number, rot = 0, scale = 1) =>
        place(pts, x * sx, y * sy, rot, k * scale);

      // Bottom to top: volcano, hills, páramo, fumarole, sun and flowers.
      const layers: BarnizLayer[] = [
        { id: 'l-mountain', name: 'Azul Galeras', color: C.blue, visible: true, locked: false },
        {
          id: 'l-hills',
          name: 'Verde oliva natural',
          color: C.olive,
          visible: true,
          locked: false,
        },
        { id: 'l-paramo', name: 'Verde frailejón', color: C.green, visible: true, locked: false },
        { id: 'l-lava', name: 'Rojo cochinilla', color: C.red, visible: true, locked: false },
        { id: 'l-sky', name: 'Amarillo alborada', color: C.gold, visible: true, locked: false },
      ];

      // Smooth skyline profiles closed with straight edges flush with the tray.
      const ground = (profile: readonly Pt[]): Pt[] => [
        ...smoothOpen(profile, 8),
        [360, 240],
        [0, 240],
      ];
      const volcano = ground([
        [0, 190],
        [30, 176],
        [80, 140],
        [122, 104],
        [148, 82],
        [162, 74],
        [172, 82],
        [186, 82],
        [196, 72],
        [214, 84],
        [246, 110],
        [290, 146],
        [334, 172],
        [360, 180],
      ]);
      const hills = ground([
        [0, 198],
        [40, 186],
        [96, 192],
        [150, 210],
        [204, 204],
        [256, 186],
        [312, 182],
        [360, 190],
      ]);
      // Fumarole: a short column of smoke that billows into puffs drifting west.
      const smokeColumn = ribbon(
        [
          [180, 80],
          [178, 70],
          [181, 62],
        ],
        6,
        10,
        6,
      );
      const puffs: [number, number, number][] = [
        [181, 58, 8],
        [171, 44, 11],
        [186, 30, 12],
        [163, 22, 10],
        [146, 26, 7],
      ];
      // Sun with wavy flame rays
      const sun = polarSun(30);

      const { trunk, rosette, stalk } = frailejonParts();
      const shapes: Shape[] = [
        curved('volcano', S(volcano), C.blue, 'l-mountain'),
        curved(
          'crater-rim',
          S(
            smoothClosed(
              [
                [150, 84],
                [162, 76],
                [172, 86],
                [186, 86],
                [196, 76],
                [208, 86],
                [192, 96],
                [176, 92],
                [160, 96],
              ],
              6,
            ),
          ),
          C.olive,
          'l-hills',
        ),
        curved('hills', S(hills), C.olive, 'l-hills'),
        curved('fumarole-column', S(smokeColumn), C.red, 'l-lava'),
        ...puffs.map(([x, y, r], i) =>
          curved(
            `fumarole-puff-${i + 1}`,
            M(flower(r, 7, 0.14, 84), x, y, i * 17),
            C.red,
            'l-lava',
          ),
        ),
        curved('sun', M(sun, 296, 58), C.gold, 'l-sky'),
      ];
      (
        [
          ['left', 62, 214, 1.15],
          ['mid', 112, 222, 0.8],
          ['right', 292, 212, 1.05],
        ] as const
      ).forEach(([name, x, y, scale]) => {
        shapes.push(
          curved(`frailejon-${name}-trunk`, M(trunk, x, y, 0, scale), C.green, 'l-paramo'),
          curved(`frailejon-${name}-rosette`, M(rosette, x, y, 0, scale), C.green, 'l-paramo'),
          curved(`frailejon-${name}-stalk-l`, M(stalk(-1), x, y, 0, scale), C.gold, 'l-sky'),
          curved(`frailejon-${name}-stalk-r`, M(stalk(1), x, y, 0, scale), C.gold, 'l-sky'),
          curved(
            `frailejon-${name}-flower-l`,
            M(place(flower(5.5, 6, 0.4, 48), -13, -74), x, y, 0, scale),
            C.gold,
            'l-sky',
          ),
          curved(
            `frailejon-${name}-flower-r`,
            M(place(flower(5.5, 6, 0.4, 48), 13, -74), x, y, 0, scale),
            C.gold,
            'l-sky',
          ),
        );
      });
      return buildBarnizDoc(obj, layers, shapes);
    },
  },
  {
    id: 'barniz-radial-bowl',
    mode: 'barniz',
    label: 'Cuenco radial de mopa-mopa (inspirado en la región)',
    description:
      'Cuenco circular de 260 mm: mandala de 12 llamas en espejo, corona de pétalos y flor central.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'bowl',
        width: custom?.width ?? 260,
        height: custom?.width ?? 260,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'silver',
      };
      const s = obj.width / 260;
      const cx = obj.width / 2;
      const cy = obj.width / 2;
      const T = (pts: readonly Pt[], dx = 0, dy = 0, rot = 0) =>
        place(place(pts, dx, dy, rot), cx, cy, 0, s);
      const polarAt = (r: number, deg: number) => {
        const a = (deg * Math.PI) / 180;
        return [r * Math.sin(a), -r * Math.cos(a)] as const;
      };

      // Bottom to top: flames, petals and dots, leaves and center.
      const layers: BarnizLayer[] = [
        { id: 'l-1', name: 'Naranja fuego', color: C.orange, visible: true, locked: false },
        { id: 'l-2', name: 'Amarillo ocre', color: C.gold, visible: true, locked: false },
        { id: 'l-3', name: 'Verde mopa-mopa', color: C.green, visible: true, locked: false },
      ];
      const [dotX, dotY] = polarAt(112, 15);
      const [leafX, leafY] = polarAt(60, 15);
      const shapes: Shape[] = [
        curved('outer-flame', T(leafShape(50, 19, 0.4), 0, -88), C.orange, 'l-1', 'g-rays'),
        curved('inner-petal', T(leafShape(32, 15, 0), 0, -44), C.gold, 'l-2', 'g-inner'),
        dot('rim-dot', cx + dotX * s, cy + dotY * s, 7 * s, C.gold, 'l-2', 'g-dots'),
        curved('ring-leaf', T(leafShape(16, 7, 0), leafX, leafY, 15), C.green, 'l-3', 'g-leaves'),
        curved('bowl-core', T(flower(22, 8, 0.38)), C.green, 'l-3'),
      ];
      return buildBarnizDoc(obj, layers, shapes, [
        { id: 'g-rays', kind: 'radial', count: 12, mirror: true, sourceId: 'outer-flame' },
        { id: 'g-inner', kind: 'radial', count: 12, mirror: false, sourceId: 'inner-petal' },
        { id: 'g-dots', kind: 'radial', count: 12, mirror: false, sourceId: 'rim-dot' },
        { id: 'g-leaves', kind: 'radial', count: 12, mirror: false, sourceId: 'ring-leaf' },
      ]);
    },
  },
];
