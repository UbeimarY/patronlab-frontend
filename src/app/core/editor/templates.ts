import {
  BarnizLayer,
  BarnizObject,
  PatternDocument,
  PatternMode,
  Shape,
  migrateDocument,
  syncRadialGroups,
} from './document';

export interface Template {
  id: string;
  mode: PatternMode;
  label: string;
  description: string;
  build: (customObject?: Partial<BarnizObject>) => PatternDocument;
}

const STROKE = '#2b2420';

function shape(partial: Omit<Shape, 'stroke'>): Shape {
  return { ...partial, stroke: STROKE };
}

function buildBarnizDoc(
  object: BarnizObject,
  layers: BarnizLayer[],
  shapes: Shape[],
  groups: PatternDocument['groups'] = [],
): PatternDocument {
  const width = object.width;
  const height = object.kind === 'plate' || object.kind === 'bowl' ? object.width : object.height;
  return syncRadialGroups(
    migrateDocument({
      schemaVersion: 2,
      mode: 'barniz',
      width,
      height,
      background: object.baseColor,
      object: { ...object, height },
      layers,
      groups,
      shapes,
    }),
  );
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
    description: 'Plato de 300 mm con pan de oro, colibrí central a bisturí y corona floral.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'plate',
        width: custom?.width ?? 300,
        height: custom?.width ?? 300,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'gold',
      };
      const scale = obj.width / 300;
      const cx = obj.width / 2;
      const cy = obj.width / 2;
      const layers: BarnizLayer[] = [
        { id: 'l-gold', name: 'Amarillo sol', color: '#d99b1e', visible: true, locked: false },
        { id: 'l-green', name: 'Verde mopa-mopa', color: '#286b35', visible: true, locked: false },
        { id: 'l-red', name: 'Rojo cochinilla', color: '#b3202a', visible: true, locked: false },
        { id: 'l-blue', name: 'Azul añil', color: '#1f5fa0', visible: true, locked: false },
      ];
      const shapes: Shape[] = [
        shape({
          id: 'petal-src',
          kind: 'leaf',
          x: cx,
          y: cy - 102 * scale,
          width: 24 * scale,
          height: 54 * scale,
          rotation: 0,
          fill: '#b3202a',
          layerId: 'l-red',
          groupId: 'g-petals',
        }),
        shape({
          id: 'leaf-ring-src',
          kind: 'leaf',
          x: cx + 46 * scale,
          y: cy - 88 * scale,
          width: 18 * scale,
          height: 44 * scale,
          rotation: 30,
          fill: '#286b35',
          layerId: 'l-green',
          groupId: 'g-leaves',
        }),
        shape({
          id: 'hummingbird-body',
          kind: 'path',
          x: cx - 6 * scale,
          y: cy + 6 * scale,
          width: 0,
          height: 0,
          rotation: -12,
          fill: '#286b35',
          layerId: 'l-green',
          points: [
            [0, -36],
            [18, -14],
            [22, 16],
            [8, 46],
            [-8, 52],
            [-14, 20],
            [-18, -10],
          ],
        }),
        shape({
          id: 'hummingbird-wing',
          kind: 'path',
          x: cx - 28 * scale,
          y: cy - 18 * scale,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#1f5fa0',
          layerId: 'l-blue',
          points: [
            [22, 10],
            [-42, -32],
            [-54, -8],
            [-24, 18],
            [8, 24],
          ],
        }),
        shape({
          id: 'hummingbird-beak',
          kind: 'path',
          x: cx + 32 * scale,
          y: cy - 26 * scale,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#d99b1e',
          layerId: 'l-gold',
          points: [
            [-22, 4],
            [28, -12],
            [-18, 12],
          ],
        }),
        shape({
          id: 'flower-center',
          kind: 'star',
          x: cx + 62 * scale,
          y: cy - 36 * scale,
          width: 38 * scale,
          height: 38 * scale,
          rotation: 15,
          fill: '#d99b1e',
          layerId: 'l-gold',
        }),
      ];
      return buildBarnizDoc(obj, layers, shapes, [
        { id: 'g-petals', kind: 'radial', count: 8, mirror: false, sourceId: 'petal-src' },
        { id: 'g-leaves', kind: 'radial', count: 8, mirror: true, sourceId: 'leaf-ring-src' },
      ]);
    },
  },
  {
    id: 'barniz-fret-box',
    mode: 'barniz',
    label: 'Caja con greca andina (inspirada en la región)',
    description: 'Tapa de caja de 240 × 180 mm con greca escalonada y sol de los Pastos.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'box',
        width: custom?.width ?? 240,
        height: custom?.height ?? 180,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'gold',
      };
      const cx = obj.width / 2;
      const cy = obj.height / 2;
      const layers: BarnizLayer[] = [
        { id: 'l-1', name: 'Amarillo ocre', color: '#d99b1e', visible: true, locked: false },
        { id: 'l-2', name: 'Rojo cochinilla', color: '#b3202a', visible: true, locked: false },
        { id: 'l-3', name: 'Turquesa andino', color: '#1e7f7a', visible: true, locked: false },
      ];
      const shapes: Shape[] = [
        shape({
          id: 'sun-center',
          kind: 'star',
          x: cx,
          y: cy,
          width: 76,
          height: 76,
          rotation: 0,
          fill: '#d99b1e',
          layerId: 'l-1',
        }),
        shape({
          id: 'inner-diamond',
          kind: 'hexagon',
          x: cx,
          y: cy,
          width: 36,
          height: 36,
          rotation: 30,
          fill: '#b3202a',
          layerId: 'l-2',
        }),
        shape({
          id: 'step-fret-tl',
          kind: 'path',
          x: 48,
          y: 42,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#1e7f7a',
          layerId: 'l-3',
          points: [
            [-24, -18],
            [24, -18],
            [24, -6],
            [4, -6],
            [4, 6],
            [-10, 6],
            [-10, 18],
            [-24, 18],
          ],
        }),
        shape({
          id: 'step-fret-tr',
          kind: 'path',
          x: obj.width - 48,
          y: 42,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#1e7f7a',
          layerId: 'l-3',
          points: [
            [-24, -18],
            [24, -18],
            [24, 18],
            [10, 18],
            [10, 6],
            [-4, 6],
            [-4, -6],
            [-24, -6],
          ],
        }),
        shape({
          id: 'step-fret-bl',
          kind: 'path',
          x: 48,
          y: obj.height - 42,
          width: 0,
          height: 0,
          rotation: 180,
          fill: '#b3202a',
          layerId: 'l-2',
          points: [
            [-24, -18],
            [24, -18],
            [24, 18],
            [10, 18],
            [10, 6],
            [-4, 6],
            [-4, -6],
            [-24, -6],
          ],
        }),
        shape({
          id: 'step-fret-br',
          kind: 'path',
          x: obj.width - 48,
          y: obj.height - 42,
          width: 0,
          height: 0,
          rotation: 180,
          fill: '#b3202a',
          layerId: 'l-2',
          points: [
            [-24, -18],
            [24, -18],
            [24, -6],
            [4, -6],
            [4, 6],
            [-10, 6],
            [-10, 18],
            [-24, 18],
          ],
        }),
      ];
      return buildBarnizDoc(obj, layers, shapes);
    },
  },
  {
    id: 'barniz-galeras-tray',
    mode: 'barniz',
    label: 'Bandeja Galeras y frailejones (inspirada en la región)',
    description: 'Bandeja de 360 × 240 mm con silueta del volcán Galeras y rosetas de páramo.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'tray',
        width: custom?.width ?? 360,
        height: custom?.height ?? 240,
        baseColor: custom?.baseColor ?? '#15191d',
        leaf: custom?.leaf ?? 'gold',
      };
      const layers: BarnizLayer[] = [
        { id: 'l-sky', name: 'Amarillo alborada', color: '#d99b1e', visible: true, locked: false },
        { id: 'l-mountain', name: 'Azul Galeras', color: '#1f5fa0', visible: true, locked: false },
        { id: 'l-paramo', name: 'Verde frailejón', color: '#286b35', visible: true, locked: false },
        { id: 'l-lava', name: 'Rojo cochinilla', color: '#b3202a', visible: true, locked: false },
      ];
      const shapes: Shape[] = [
        shape({
          id: 'sun-disc',
          kind: 'ellipse',
          x: 235,
          y: 72,
          width: 58,
          height: 58,
          rotation: 0,
          fill: '#d99b1e',
          layerId: 'l-sky',
        }),
        shape({
          id: 'volcano-peak',
          kind: 'path',
          x: 180,
          y: 138,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#1f5fa0',
          layerId: 'l-mountain',
          points: [
            [-150, 56],
            [-42, -48],
            [-12, -40],
            [18, -52],
            [150, 56],
          ],
        }),
        shape({
          id: 'plume',
          kind: 'path',
          x: 176,
          y: 62,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#b3202a',
          layerId: 'l-lava',
          points: [
            [-8, 22],
            [-24, -6],
            [0, -24],
            [28, -10],
            [8, 20],
          ],
        }),
        shape({
          id: 'frailejon-left',
          kind: 'star',
          x: 82,
          y: 175,
          width: 62,
          height: 62,
          rotation: 12,
          fill: '#286b35',
          layerId: 'l-paramo',
        }),
        shape({
          id: 'frailejon-right',
          kind: 'star',
          x: 282,
          y: 178,
          width: 56,
          height: 56,
          rotation: -15,
          fill: '#286b35',
          layerId: 'l-paramo',
        }),
      ];
      return buildBarnizDoc(obj, layers, shapes);
    },
  },
  {
    id: 'barniz-radial-bowl',
    mode: 'barniz',
    label: 'Cuenco radial de mopa-mopa (inspirado en la región)',
    description: 'Cuenco circular de 260 mm con simetría radial de 12 pétalos y espejo.',
    build: (custom) => {
      const obj: BarnizObject = {
        kind: custom?.kind ?? 'bowl',
        width: custom?.width ?? 260,
        height: custom?.width ?? 260,
        baseColor: custom?.baseColor ?? '#1b1512',
        leaf: custom?.leaf ?? 'silver',
      };
      const cx = obj.width / 2;
      const cy = obj.width / 2;
      const layers: BarnizLayer[] = [
        { id: 'l-1', name: 'Naranja fuego', color: '#d45b24', visible: true, locked: false },
        { id: 'l-2', name: 'Amarillo ocre', color: '#d99b1e', visible: true, locked: false },
        { id: 'l-3', name: 'Verde mopa-mopa', color: '#286b35', visible: true, locked: false },
      ];
      const shapes: Shape[] = [
        shape({
          id: 'outer-ray',
          kind: 'leaf',
          x: cx,
          y: cy - 78,
          width: 22,
          height: 62,
          rotation: 10,
          fill: '#d45b24',
          layerId: 'l-1',
          groupId: 'g-rays',
        }),
        shape({
          id: 'inner-petal',
          kind: 'path',
          x: cx,
          y: cy - 42,
          width: 0,
          height: 0,
          rotation: 0,
          fill: '#d99b1e',
          layerId: 'l-2',
          groupId: 'g-inner',
          points: [
            [0, -22],
            [12, 0],
            [0, 22],
            [-12, 0],
          ],
        }),
        shape({
          id: 'bowl-core',
          kind: 'hexagon',
          x: cx,
          y: cy,
          width: 34,
          height: 34,
          rotation: 0,
          fill: '#286b35',
          layerId: 'l-3',
        }),
      ];
      return buildBarnizDoc(obj, layers, shapes, [
        { id: 'g-rays', kind: 'radial', count: 12, mirror: true, sourceId: 'outer-ray' },
        { id: 'g-inner', kind: 'radial', count: 6, mirror: false, sourceId: 'inner-petal' },
      ]);
    },
  },
];
