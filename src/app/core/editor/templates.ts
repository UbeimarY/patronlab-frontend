import { PatternDocument, Shape } from './document';

export interface Template {
  id: string;
  label: string;
  description: string;
  build: () => PatternDocument;
}

const STROKE = '#2b2420';

function shape(partial: Omit<Shape, 'stroke'>): Shape {
  return { ...partial, stroke: STROKE };
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    label: 'En blanco',
    description: 'Pieza de 300 × 300 mm sin figuras.',
    build: () => ({ width: 300, height: 300, background: '#f4f1ec', shapes: [] }),
  },
  {
    id: 'leaf-cushion',
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
      return { width: 400, height: 400, background: '#f6efe3', shapes };
    },
  },
  {
    id: 'star-garland',
    label: 'Guirnalda de estrellas',
    description: 'Siete estrellas alternas para cortar en fieltro, 600 × 200 mm.',
    build: () => ({
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
];
