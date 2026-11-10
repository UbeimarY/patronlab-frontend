/**
 * Reads a design request written in everyday Spanish ("un plato con un colibrí
 * azul al centro y ocho flores rojas alrededor") into a structured brief:
 * the wooden object, its gold or silver leaf, the background enamel and, for
 * each motif, how many, which colors and where.
 *
 * It is a small rule-based parser that runs in the browser: a lexicon of
 * motifs, colors, number words and placement phrases, plus a few rules about
 * which words belong to which motif. No external service or API key is used.
 */

import { BarnizLeaf, BarnizObjectKind } from './document';

export const MOTIF_KINDS = [
  'colibri',
  'flor',
  'hoja',
  'estrella',
  'sol',
  'luna',
  'mariposa',
  'pez',
  'cuy',
  'mazorca',
  'corazon',
  'frailejon',
  'espiral',
  'punto',
  'greca',
] as const;
export type MotifKind = (typeof MOTIF_KINDS)[number];

export type Placement =
  | 'centro'
  | 'alrededor'
  | 'borde'
  | 'esquinas'
  | 'lados'
  | 'arriba'
  | 'abajo'
  | 'izquierda'
  | 'derecha';

export interface MotifRequest {
  kind: MotifKind;
  /** How many copies; `countGiven` is false when the count was inferred from a plural. */
  count: number;
  countGiven: boolean;
  /** Requested colors (hex), in the order they were written. Empty means "choose for me". */
  colors: string[];
  placement: Placement | null;
  /** 0.7 for "pequeñas", 1.25 for "grande", 1 otherwise. */
  scale: number;
  /** Lobes for a flower: margaritas have more petals than roses. */
  petals?: number;
  /** The words of the request that produced this motif, for the summary. */
  words: string;
}

export interface DesignBrief {
  object: BarnizObjectKind;
  /** Millimeters; plates and bowls are round, so width equals height. */
  width: number;
  height: number;
  sizeGiven: boolean;
  leaf: BarnizLeaf;
  baseColor: string;
  baseColorName: string | null;
  motifs: MotifRequest[];
  /** Words that looked meaningful but are not in the vocabulary, for honest feedback. */
  unknown: string[];
}

export const MAX_COUNT = 36;

/** Colors a mopa-mopa sheet can be dyed with, keyed by the stem of their Spanish name. */
export const COLOR_WORDS: { stem: string; hex: string; name: string }[] = [
  { stem: 'roj', hex: '#c0262f', name: 'Rojo cochinilla' },
  { stem: 'carmin', hex: '#c0262f', name: 'Rojo cochinilla' },
  { stem: 'azul', hex: '#2a6fb8', name: 'Azul añil' },
  { stem: 'celeste', hex: '#5aa6d6', name: 'Azul celeste' },
  { stem: 'verde', hex: '#2f8a3f', name: 'Verde mopa-mopa' },
  { stem: 'oliva', hex: '#7d8f3a', name: 'Verde oliva' },
  { stem: 'amarill', hex: '#e0a526', name: 'Amarillo sol' },
  { stem: 'dorad', hex: '#e0a526', name: 'Amarillo sol' },
  { stem: 'oro', hex: '#e0a526', name: 'Amarillo sol' },
  { stem: 'naranj', hex: '#e0642a', name: 'Naranja fuego' },
  { stem: 'anaranjad', hex: '#e0642a', name: 'Naranja fuego' },
  { stem: 'turquesa', hex: '#1f9a90', name: 'Turquesa andino' },
  { stem: 'morad', hex: '#632b6c', name: 'Morado obispo' },
  { stem: 'violeta', hex: '#632b6c', name: 'Morado obispo' },
  { stem: 'lila', hex: '#8a5aa8', name: 'Lila' },
  { stem: 'purpura', hex: '#632b6c', name: 'Morado obispo' },
  { stem: 'fucsia', hex: '#a83a7c', name: 'Fucsia' },
  { stem: 'magenta', hex: '#a83a7c', name: 'Fucsia' },
  { stem: 'rosad', hex: '#d9668c', name: 'Rosado' },
  { stem: 'blanc', hex: '#f3ead8', name: 'Blanco hueso' },
  { stem: 'negr', hex: '#2b2420', name: 'Negro' },
  { stem: 'cafe', hex: '#8a5230', name: 'Café' },
  { stem: 'marron', hex: '#8a5230', name: 'Café' },
];

/** Enamel colors for the wooden object, after "fondo". */
const BASE_COLORS: { stem: string; hex: string; name: string }[] = [
  { stem: 'negr', hex: '#1b1512', name: 'negro' },
  { stem: 'roj', hex: '#5a1418', name: 'rojo' },
  { stem: 'verde', hex: '#1d3a24', name: 'verde' },
  { stem: 'azul', hex: '#14243d', name: 'azul' },
  { stem: 'blanc', hex: '#efe6d2', name: 'blanco' },
  { stem: 'crema', hex: '#efe6d2', name: 'crema' },
  { stem: 'natural', hex: '#7a4a2a', name: 'madera natural' },
  { stem: 'madera', hex: '#7a4a2a', name: 'madera natural' },
  { stem: 'cafe', hex: '#5b3820', name: 'café' },
];

const MOTIF_WORDS: Record<string, MotifKind> = {};
const addWords = (kind: MotifKind, ...words: string[]) =>
  words.forEach((word) => (MOTIF_WORDS[word] = kind));
addWords('colibri', 'colibri', 'colibries', 'picaflor', 'picaflores', 'pajaro', 'pajaros');
addWords('colibri', 'pajarito', 'pajaritos', 'ave', 'aves');
addWords('flor', 'flor', 'flores', 'florecita', 'florecitas', 'rosa', 'rosas', 'margarita');
addWords('flor', 'margaritas', 'orquidea', 'orquideas', 'girasol', 'girasoles');
addWords('hoja', 'hoja', 'hojas', 'hojita', 'hojitas', 'rama', 'ramas', 'enredadera');
addWords('estrella', 'estrella', 'estrellas', 'estrellita', 'estrellitas', 'lucero', 'luceros');
addWords('sol', 'sol', 'soles', 'inti');
addWords('luna', 'luna', 'lunas', 'lunita', 'creciente');
addWords('mariposa', 'mariposa', 'mariposas');
addWords('pez', 'pez', 'peces', 'pescado', 'pescados', 'pececito', 'pececitos');
addWords('cuy', 'cuy', 'cuyes', 'cuys', 'cuyecito', 'cuyecitos');
addWords('mazorca', 'mazorca', 'mazorcas', 'maiz', 'choclo', 'choclos');
addWords('corazon', 'corazon', 'corazones');
addWords('frailejon', 'frailejon', 'frailejones');
addWords('espiral', 'espiral', 'espirales', 'caracol', 'caracoles', 'churo', 'churos');
addWords('punto', 'punto', 'puntos', 'puntito', 'puntitos', 'bolita', 'bolitas');
addWords('greca', 'greca', 'grecas', 'escalonada', 'escalonado', 'chakana');

/** Plural or singular, for counting when no number is written. */
const SINGULAR = new Set([
  'colibri',
  'picaflor',
  'pajaro',
  'pajarito',
  'ave',
  'flor',
  'florecita',
  'rosa',
  'margarita',
  'orquidea',
  'girasol',
  'hoja',
  'hojita',
  'rama',
  'estrella',
  'estrellita',
  'lucero',
  'sol',
  'inti',
  'luna',
  'mariposa',
  'pez',
  'pescado',
  'pececito',
  'cuy',
  'cuyecito',
  'mazorca',
  'maiz',
  'choclo',
  'corazon',
  'frailejon',
  'espiral',
  'caracol',
  'churo',
  'punto',
  'puntito',
  'bolita',
  'greca',
  'escalonada',
  'escalonado',
  'chakana',
]);

/** How many to draw when the request uses a plural without a number ("flores alrededor"). */
const DEFAULT_PLURAL: Record<MotifKind, number> = {
  colibri: 2,
  flor: 8,
  hoja: 12,
  estrella: 8,
  sol: 2,
  luna: 2,
  mariposa: 4,
  pez: 6,
  cuy: 2,
  mazorca: 4,
  corazon: 8,
  frailejon: 3,
  espiral: 8,
  punto: 24,
  greca: 12,
};

const NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  par: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  docena: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciocho: 18,
  veinte: 20,
  veinticuatro: 24,
  treinta: 30,
  treintaiseis: 36,
  varias: 0,
  varios: 0,
  muchas: 0,
  muchos: 0,
};

/**
 * Placement words. `prefix` ones only describe the motif written after them ("rodeado de
 * flores"); `suffix` ones only the motif before them ("flores rodeando un colibrí").
 */
const PLACEMENTS: {
  words: string[];
  placement: Placement;
  prefix?: boolean;
  suffix?: boolean;
}[] = [
  { words: ['centro', 'central', 'medio', 'mitad'], placement: 'centro' },
  { words: ['alrededor', 'circulo'], placement: 'alrededor' },
  { words: ['rodeando', 'girando', 'rodean'], placement: 'alrededor', suffix: true },
  {
    words: ['rodeado', 'rodeada', 'rodeados', 'rodeadas', 'corona', 'anillo', 'ronda'],
    placement: 'alrededor',
    prefix: true,
  },
  { words: ['borde', 'bordes', 'orilla', 'orillas', 'filo', 'contorno'], placement: 'borde' },
  { words: ['cenefa', 'marco', 'franja'], placement: 'borde', prefix: true },
  { words: ['esquina', 'esquinas', 'rincones'], placement: 'esquinas' },
  { words: ['lados', 'costados', 'flanco', 'flancos', 'ambos'], placement: 'lados' },
  { words: ['arriba', 'encima', 'superior', 'cielo'], placement: 'arriba' },
  { words: ['abajo', 'debajo', 'inferior', 'suelo'], placement: 'abajo' },
  { words: ['izquierda', 'izquierdo'], placement: 'izquierda' },
  { words: ['derecha', 'derecho'], placement: 'derecha' },
];
const PLACEMENT_OF = new Map<string, { placement: Placement; prefix: boolean; suffix: boolean }>();
for (const entry of PLACEMENTS) {
  for (const word of entry.words) {
    PLACEMENT_OF.set(word, {
      placement: entry.placement,
      prefix: !!entry.prefix,
      suffix: !!entry.suffix,
    });
  }
}

const OBJECTS: { words: string[]; kind: BarnizObjectKind }[] = [
  { words: ['plato', 'platos', 'platon', 'bandejita'], kind: 'plate' },
  { words: ['cuenco', 'cuencos', 'totuma', 'totumas', 'bowl', 'pocillo', 'tazon'], kind: 'bowl' },
  { words: ['caja', 'cajas', 'cofre', 'joyero', 'cajita', 'alhajero', 'tapa'], kind: 'box' },
  { words: ['bandeja', 'bandejas', 'charola', 'cuadro', 'tabla'], kind: 'tray' },
];

export const DEFAULT_SIZES: Record<BarnizObjectKind, [number, number]> = {
  plate: [300, 300],
  bowl: [260, 260],
  box: [240, 180],
  tray: [360, 240],
};

const SMALL = ['pequena', 'pequenas', 'pequeno', 'pequenos', 'chiquita', 'chiquitas', 'mini'];
const SMALL_WORDS = new Set([...SMALL, 'chiquito', 'chiquitos', 'diminuta', 'diminutas']);
const BIG_WORDS = new Set(['grande', 'grandes', 'gran', 'enorme', 'enormes', 'gigante']);

/** Words that carry no design meaning here; anything else unknown is reported back. */
const FILLER = new Set(
  (
    'de del la el los las lo un una unos unas y e o con en al a que por para sobre sus su cada ' +
    'todo toda todos todas hay quiero quisiera dibuja dibujame dibujar haz hazme pon ponle crea ' +
    'creame disena disename diseno tenga tengan lleve lleva lleno llena llenas muy mas color ' +
    'colores tono tonos se le les me mi tu sin ni como entre tambien otra otro otras otros ' +
    'bonito bonita lindo linda hermoso hermosa bello bella estilo tradicional pastuso pastusa ' +
    'narinense narino andino andina motivo motivos figura figuras forma formas decoracion ' +
    'decorado decorada adornado adornada parte lado vez veces fondo pan lamina laminas ' +
    'plata plateado plateada cm mm centimetros milimetros x tamano mide medida barniz ' +
    'pasto mopa porfa favor por gracias ademas tipo clase esta este estos estas ese esa ' +
    'volando posado posada pegado pegada junto juntos juntas uno dentro fuera'
  ).split(' '),
);

/** Lowercase, without accents or punctuation, keeping commas and periods as clause breaks. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[;:.!?¡¿()]/g, ' , ')
    .replace(/,/g, ' , ')
    .replace(/[^a-z0-9,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function colorOf(token: string): { hex: string; name: string } | null {
  if (token === 'rosa' || token === 'rosas') return null; // the flower, not the color
  const match = COLOR_WORDS.find((color) => token.startsWith(color.stem));
  return match ? { hex: match.hex, name: match.name } : null;
}

export function colorName(hex: string): string {
  return COLOR_WORDS.find((color) => color.hex === hex)?.name ?? hex;
}

function toMillimeters(value: string, unit: string | undefined): number {
  const n = Number(value.replace(',', '.'));
  return unit && unit.startsWith('m') ? n : n * 10;
}

/** Parses the request. Always returns a brief; `motifs` is empty when no motif was recognized. */
export function parseDescription(text: string): DesignBrief {
  let norm = normalize(text);

  // Leaf: "pan de oro", "hoja de plata", "sin pan de oro". Removed so "hoja" and "oro" are not
  // read as a motif or a color.
  let leaf = 'gold' as BarnizLeaf;
  norm = norm.replace(
    /\b(sin\s+)?(pan|hoja|lamina|laminas|panes)\s+de\s+(oro|plata)\b/g,
    (_, no, __, metal) => {
      leaf = no ? 'none' : metal === 'plata' ? 'silver' : 'gold';
      return ' , ';
    },
  );
  if (/\bsin\s+(oro|plata|pan)\b/.test(norm)) leaf = 'none';
  if (/\bplatead[oa]s?\b/.test(norm) && !/\boro\b/.test(norm)) leaf = 'silver';

  // Background enamel: "fondo negro", "fondo de color rojo".
  let baseColor = '#1b1512';
  let baseColorName = null as string | null;
  norm = norm.replace(
    /\bfondo\s+(?:de\s+)?(?:color\s+)?([a-z]+)(?:\s+natural)?/g,
    (all, word: string) => {
      const base = BASE_COLORS.find((color) => word.startsWith(color.stem));
      if (!base) return all;
      baseColor = base.hex;
      baseColorName = base.name;
      return ' , ';
    },
  );

  // Size: "40 x 30 cm", "de 32 cm", "300 mm". Removed so the numbers are not counts.
  let size = null as [number, number] | null;
  norm = norm.replace(
    /\b(\d+(?:,\d+)?)\s*(?:x|por)\s*(\d+(?:,\d+)?)\s*(cm|mm|centimetros|milimetros)?\b/g,
    (_, a: string, b: string, unit: string | undefined) => {
      size = [toMillimeters(a, unit), toMillimeters(b, unit)];
      return ' ';
    },
  );
  norm = norm.replace(
    /\b(\d+(?:,\d+)?)\s*(cm|mm|centimetros|milimetros)\b/g,
    (_, a: string, unit: string) => {
      const mm = toMillimeters(a, unit);
      size = [mm, mm];
      return ' ';
    },
  );

  const tokens = norm.split(' ').filter(Boolean);
  let object: BarnizObjectKind = 'plate';
  const objectHit = tokens.find((token) => OBJECTS.some((o) => o.words.includes(token)));
  if (objectHit) object = OBJECTS.find((o) => o.words.includes(objectHit))!.kind;

  // Motif positions
  const motifAt: number[] = [];
  tokens.forEach((token, i) => {
    if (MOTIF_WORDS[token]) motifAt.push(i);
  });

  const isBreak = (token: string) => token === ',' || token === 'y' || token === 'e';
  const motifs: MotifRequest[] = motifAt.map((at, m) => {
    const word = tokens[at];
    const kind = MOTIF_WORDS[word];
    const previous = m > 0 ? motifAt[m - 1] : -1;
    const next = m + 1 < motifAt.length ? motifAt[m + 1] : tokens.length;

    // Count: a number word or digit up to three words before ("tres flores", "un par de
    // hojas", "ocho pequeñas estrellas"), without crossing the previous motif.
    let count: number | null = null;
    let scale = 1;
    for (let j = at - 1; j > previous && j >= at - 3; j--) {
      const token = tokens[j];
      if (token === ',') break;
      if (SMALL_WORDS.has(token)) scale = 0.7;
      if (BIG_WORDS.has(token)) scale = 1.25;
      if (/^\d+$/.test(token)) {
        count = Number(token);
        break;
      }
      if (token in NUMBERS) {
        count = NUMBERS[token] || DEFAULT_PLURAL[kind];
        break;
      }
    }
    const plural = !SINGULAR.has(word);
    const countGiven = count !== null;
    if (count === null) count = plural ? DEFAULT_PLURAL[kind] : 1;
    if (plural && count === 1) count = DEFAULT_PLURAL[kind];

    // Colors: right after the motif, a list such as "rojas y amarillas" or "verde, azul".
    const colors: string[] = [];
    for (let j = at + 1; j < next; j++) {
      const token = tokens[j];
      const color = colorOf(token);
      if (color) {
        if (!colors.includes(color.hex)) colors.push(color.hex);
        continue;
      }
      if (SMALL_WORDS.has(token)) scale = 0.7;
      else if (BIG_WORDS.has(token)) scale = 1.25;
      else if (['de', 'color', 'y', 'e', ','].includes(token)) {
        // "flores de color rojo", "rojas y amarillas": keep reading only if a color follows.
        const after = tokens.slice(j + 1, Math.min(next, j + 3));
        if (!after.some((t) => colorOf(t))) break;
      } else break;
    }

    // Placement: first look after the motif ("un colibrí al centro"), up to the next clause
    // break; then before it ("al centro un colibrí", "rodeado de flores").
    let placement: Placement | null = null;
    for (let j = at + 1; j < next; j++) {
      const token = tokens[j];
      const hit = PLACEMENT_OF.get(token);
      if (hit && !hit.prefix) {
        placement = hit.placement;
        break;
      }
      // "rojos y rosados alrededor": a color list does not end the clause.
      const inColorList = isBreak(token) && token !== ',' && !!colorOf(tokens[j + 1] ?? '');
      if (isBreak(token) && !inColorList) break;
    }
    if (!placement) {
      for (let j = at - 1; j > previous && j >= at - 6; j--) {
        if (isBreak(tokens[j])) break;
        const hit = PLACEMENT_OF.get(tokens[j]);
        if (!hit) continue;
        // "alrededor de un colibrí" and "rodeando un colibrí" name the motif in the middle.
        const anchor = hit.suffix || (tokens[j] === 'alrededor' && tokens[j + 1] === 'de');
        if (!anchor) placement = hit.placement;
        break;
      }
    }
    if (!placement && kind === 'greca') placement = 'borde';
    // A fret is a band: "una greca" means one border, not one step.
    const band = kind === 'greca' && count === 1;

    let petals: number | undefined;
    if (word.startsWith('margarita')) petals = 9;
    else if (word.startsWith('girasol')) petals = 12;

    return {
      kind,
      count: band ? DEFAULT_PLURAL.greca : Math.max(1, Math.min(MAX_COUNT, count)),
      countGiven: countGiven && !band,
      colors,
      placement,
      scale,
      petals,
      words: tokens.slice(Math.max(previous + 1, at - 3), Math.min(next, at + 4)).join(' '),
    };
  });

  // Words left over: report them so the artisan knows what was not drawn.
  const known = (token: string) =>
    token === ',' ||
    /^\d+$/.test(token) ||
    FILLER.has(token) ||
    token in NUMBERS ||
    !!MOTIF_WORDS[token] ||
    PLACEMENT_OF.has(token) ||
    SMALL_WORDS.has(token) ||
    BIG_WORDS.has(token) ||
    !!colorOf(token) ||
    OBJECTS.some((o) => o.words.includes(token)) ||
    BASE_COLORS.some((c) => token.startsWith(c.stem));
  const unknown = [...new Set(tokens.filter((token) => token.length >= 4 && !known(token)))].slice(
    0,
    4,
  );

  let [width, height] = size ?? DEFAULT_SIZES[object];
  width = Math.round(Math.min(600, Math.max(100, width)));
  height = Math.round(Math.min(600, Math.max(100, height)));
  if (object === 'plate' || object === 'bowl') height = width;
  else if (height > width && object === 'tray') [width, height] = [height, width];

  return {
    object,
    width,
    height,
    sizeGiven: size !== null,
    leaf,
    baseColor,
    baseColorName,
    motifs,
    unknown,
  };
}
