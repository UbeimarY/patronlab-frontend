import { describe, expect, it } from 'vitest';

import { normalize, parseDescription } from './design-brief';

describe('parseDescription', () => {
  it('reads motifs with their count, colors and placement', () => {
    const brief = parseDescription(
      'Un plato con un colibrí azul al centro y ocho flores rojas alrededor, con puntos dorados en el borde',
    );
    expect(brief.object).toBe('plate');
    expect(brief.motifs.map((m) => [m.kind, m.count, m.colors, m.placement])).toEqual([
      ['colibri', 1, ['#2a6fb8'], 'centro'],
      ['flor', 8, ['#c0262f'], 'alrededor'],
      ['punto', 24, ['#e0a526'], 'borde'],
    ]);
  });

  it('keeps a color list together and finds the placement after it', () => {
    const [, hearts] = parseDescription(
      'una mazorca al centro y corazones rojos y rosados alrededor',
    ).motifs;
    expect(hearts.colors).toEqual(['#c0262f', '#d9668c']);
    expect(hearts.placement).toBe('alrededor');
  });

  it('understands "rodeado de" and "alrededor de" around the anchor motif', () => {
    const rodeado = parseDescription('un sol rodeado de doce estrellas').motifs;
    expect(rodeado.map((m) => m.placement)).toEqual([null, 'alrededor']);
    expect(rodeado[1].count).toBe(12);
    const alrededor = parseDescription('flores moradas alrededor de un colibrí').motifs;
    expect(alrededor.map((m) => m.placement)).toEqual(['alrededor', null]);
  });

  it('reads the object, its size, leaf and background without mistaking them for motifs', () => {
    const tray = parseDescription(
      'Una bandeja de 40 x 25 cm sin pan de oro, fondo rojo, con hojas',
    );
    expect([tray.object, tray.width, tray.height, tray.leaf, tray.baseColorName]).toEqual([
      'tray',
      400,
      250,
      'none',
      'rojo',
    ]);
    expect(tray.motifs.map((m) => m.kind)).toEqual(['hoja']);
    const bowl = parseDescription('cuenco de 300 mm con hoja de plata y una estrella');
    expect([bowl.object, bowl.width, bowl.height, bowl.leaf]).toEqual(['bowl', 300, 300, 'silver']);
    expect(bowl.motifs.map((m) => m.kind)).toEqual(['estrella']);
  });

  it('infers counts from plurals, sizes from adjectives and caps big numbers', () => {
    const [stars, dots, flowers] = parseDescription(
      'estrellas pequeñas, 50 puntos y tres margaritas grandes',
    ).motifs;
    expect([stars.count, stars.countGiven, stars.scale]).toEqual([8, false, 0.7]);
    expect(dots.count).toBe(36);
    expect([flowers.count, flowers.scale, flowers.petals]).toEqual([3, 1.25, 9]);
  });

  it('treats "una greca" as a whole border', () => {
    const [fret] = parseDescription('una caja con una greca roja').motifs;
    expect([fret.placement, fret.countGiven]).toEqual(['borde', false]);
  });

  it('reports the words it could not draw', () => {
    const brief = parseDescription('un dragón dorado volando sobre el volcán');
    expect(brief.motifs).toEqual([]);
    expect(brief.unknown).toEqual(['dragon', 'volcan']);
  });

  it('normalizes accents, case and punctuation', () => {
    expect(normalize('¡Colibrí, PEQUEÑO!')).toBe(', colibri , pequeno ,');
  });
});
