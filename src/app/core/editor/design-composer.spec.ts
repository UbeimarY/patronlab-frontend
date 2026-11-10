import { describe, expect, it } from 'vitest';

import { MAX_LAYERS, MAX_PATH_POINTS } from './document';
import { designFromText } from './design-composer';
import { boundingBox } from './geometry';

const PHRASES = [
  'Un plato con un colibrí azul al centro y ocho flores rojas alrededor, con puntos dorados en el borde',
  'Una bandeja de 40 x 25 cm con tres frailejones, un sol arriba y una greca roja en el borde',
  'cuenco con un sol al centro rodeado de doce estrellas amarillas y hojas verdes',
  'caja con una mariposa naranja al centro, flores en las esquinas y fondo rojo',
  'plato con dos cuyes, una mazorca al centro y corazones rojos y rosados alrededor',
  'un pez turquesa rodeado de espirales y peces pequeños, luna arriba, corazón abajo',
];

describe('designFromText', () => {
  it('returns null when no motif is named', () => {
    expect(designFromText('algo bonito por favor')).toBeNull();
  });

  it('builds valid Barniz documents that stay on the object', () => {
    for (const phrase of PHRASES) {
      for (const seed of [0, 1, 2]) {
        const { document } = designFromText(phrase, seed)!;
        expect(document.mode).toBe('barniz');
        expect(document.layers!.length).toBeLessThanOrEqual(MAX_LAYERS);
        const layerIds = new Set(document.layers!.map((l) => l.id));
        for (const shape of document.shapes) {
          expect(layerIds.has(shape.layerId!)).toBe(true);
          expect(shape.id.length).toBeLessThanOrEqual(40);
          if (shape.kind === 'path') {
            expect(shape.points!.length).toBeGreaterThanOrEqual(3);
            expect(shape.points!.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
          }
          const box = boundingBox(shape);
          expect(box.minX).toBeGreaterThanOrEqual(-1);
          expect(box.minY).toBeGreaterThanOrEqual(-1);
          expect(box.maxX).toBeLessThanOrEqual(document.width + 1);
          expect(box.maxY).toBeLessThanOrEqual(document.height + 1);
        }
        // Every lamina has something to cut.
        for (const layer of document.layers!) {
          expect(document.shapes.some((s) => s.layerId === layer.id)).toBe(true);
        }
      }
    }
  });

  it('turns single-color rings on round objects into radial groups', () => {
    const { document } = designFromText('plato con ocho flores rojas alrededor de un colibrí')!;
    const petals = document.groups!.find((g) => g.sourceId.startsWith('flor'));
    expect(petals?.count).toBe(8);
    expect(document.shapes.filter((s) => s.groupId === petals!.id)).toHaveLength(8);
  });

  it('alternates the colors of a ring when several are asked for', () => {
    const { document } = designFromText('flores rojas y azules alrededor de un sol')!;
    const petals = document.shapes.filter(
      (s) => s.id.startsWith('flor') && s.id.includes('petals'),
    );
    expect(new Set(petals.map((s) => s.fill))).toEqual(new Set(['#c0262f', '#2a6fb8']));
  });

  it('stacks details above what they decorate', () => {
    const { document } = designFromText('un sol al centro y flores rojas alrededor')!;
    const layerIndex = (id: string) =>
      document.layers!.findIndex((l) => l.id === document.shapes.find((s) => s.id === id)!.layerId);
    expect(layerIndex('sol1-face-1')).toBeGreaterThan(layerIndex('sol1-rays-1'));
    expect(layerIndex('flor2-eye')).toBeGreaterThan(layerIndex('flor2-petals'));
  });

  it('explains what it understood', () => {
    const { notes } = designFromText('un plato con un colibrí azul al centro y dragones')!;
    expect(notes[0]).toBe('Plato de 30 cm, fondo negro, pan de oro.');
    expect(notes).toContain('1 colibrí en azul añil, al centro.');
    expect(notes).toContain('No usé estas palabras: «dragones».');
  });
});
