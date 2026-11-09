import { Injectable, inject } from '@angular/core';

import { SessionUser } from '../auth/session.store';
import { PatternDocument, PatternMode, Shape } from '../editor/document';
import { GraphqlClient, RequestOptions } from './graphql';

export interface AuthPayload {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

export interface PatternSummary {
  id: string;
  name: string;
  material: string;
  mode?: PatternMode;
  pieceCount?: number;
  layerCount?: number;
  currentVersion: number;
  updatedAt: string;
  document: PatternDocument;
}

export interface PatternVersion {
  number: number;
  note: string;
  shapeCount: number;
  createdAt: string;
}

export interface PatternDetail extends PatternSummary {
  versions: PatternVersion[];
}

export interface PaletteColor {
  hex: string;
  share: number;
}

export interface Score {
  total: number;
  balance: number;
  overlap: number;
  contrast: number;
  coverage: number;
}

export interface Variations {
  original: Score;
  variations: { document: PatternDocument; score: Score }[];
}

export interface WeightsInput {
  balance?: number;
  overlap?: number;
  contrast?: number;
  coverage?: number;
}

export interface EvolvedGeneration {
  generation: number;
  best: number;
  average: number;
}

export interface EvolvedVariations extends Variations {
  history: EvolvedGeneration[];
}

export interface ParetoPoint {
  document: PatternDocument;
  balance: number;
  contrast: number;
  materialSaving: number;
}

export interface ParetoVariationsResult {
  points: ParetoPoint[];
  elapsedMs: number;
}

export interface VectorizedLayer {
  id: string;
  name: string;
  color: string;
  areaShare: number;
}

export interface VectorizeResult {
  layers: VectorizedLayer[];
  shapes: Shape[];
  elapsedMs: number;
  notes: string[];
}

export type LayoutMethod = 'SKYLINE' | 'RASTER';

export interface Placement {
  shapeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
}

export interface LayerLayout {
  layerId: string;
  color: string;
  areaCm2: number;
  usedLength: number;
  wastePercent: number;
  sheets: number;
  placements: Placement[];
}

export interface Layout {
  placements: Placement[];
  usedLength: number;
  wastePercent: number;
  baselineLength: number;
  baselineWastePercent: number;
  cutOrder: string[];
  cutTravel: number;
  baselineCutTravel: number;
  method?: LayoutMethod;
  layers?: LayerLayout[];
}

export interface OptimizeLayoutOptions {
  perLayer?: boolean;
  sheetWidth?: number;
  sheetHeight?: number;
  method?: LayoutMethod;
}

export interface ColorPairAnalysis {
  a: string;
  b: string;
  deltaE: number;
  tooSimilar: boolean;
}

export interface ColorNameEntry {
  hex: string;
  name: string;
}

export interface ColorAnalysis {
  pairs: ColorPairAnalysis[];
  names: ColorNameEntry[];
  harmonies: string[][];
}

const USER = 'user { id email fullName craft }';
const SCORE = 'total balance overlap contrast coverage';
const SUMMARY = 'id name material currentVersion updatedAt';

/** Every operation the app uses, each asking only for the fields its screen shows. */
@Injectable({ providedIn: 'root' })
export class PatronlabApi {
  private readonly graphql = inject(GraphqlClient);

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    craft: string | null;
  }): Promise<AuthPayload> {
    const data = await this.graphql.request<{ register: AuthPayload }>(
      `mutation Register($input: RegisterInput!) { register(input: $input) { token expiresAt ${USER} } }`,
      { input },
    );
    return data.register;
  }

  async login(email: string, password: string): Promise<AuthPayload> {
    const data = await this.graphql.request<{ login: AuthPayload }>(
      `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token expiresAt ${USER} } }`,
      { email, password },
    );
    return data.login;
  }

  async patterns(): Promise<PatternSummary[]> {
    const data = await this.graphql.request<{ patterns: PatternSummary[] }>(
      `query Patterns { patterns { ${SUMMARY} document } }`,
    );
    return data.patterns;
  }

  async pattern(id: string): Promise<PatternDetail> {
    const data = await this.graphql.request<{ pattern: PatternDetail }>(
      `query Pattern($id: ID!) { pattern(id: $id) { ${SUMMARY} document versions { number note shapeCount createdAt } } }`,
      { id },
    );
    return data.pattern;
  }

  async versionDocument(id: string, version: number): Promise<PatternDocument> {
    const data = await this.graphql.request<{ pattern: { document: PatternDocument } }>(
      `query Version($id: ID!, $version: Int!) { pattern(id: $id) { document(version: $version) } }`,
      { id, version },
    );
    return data.pattern.document;
  }

  async createPattern(name: string, material: string, document: PatternDocument): Promise<string> {
    const data = await this.graphql.request<{ createPattern: { id: string } }>(
      `mutation Create($input: CreatePatternInput!) { createPattern(input: $input) { id } }`,
      { input: { name, material, document } },
    );
    return data.createPattern.id;
  }

  async duplicatePattern(id: string): Promise<string> {
    const data = await this.graphql.request<{ duplicatePattern: { id: string } }>(
      `mutation Duplicate($id: ID!) { duplicatePattern(id: $id) { id } }`,
      { id },
    );
    return data.duplicatePattern.id;
  }

  async savePattern(
    id: string,
    baseVersion: number,
    document: PatternDocument,
    note: string,
    material: string,
  ): Promise<number> {
    const data = await this.graphql.request<{ savePattern: { currentVersion: number } }>(
      `mutation Save($input: SavePatternInput!) { savePattern(input: $input) { currentVersion } }`,
      { input: { id, baseVersion, document, note, material } },
    );
    return data.savePattern.currentVersion;
  }

  async restoreVersion(id: string, number: number, baseVersion: number): Promise<number> {
    const data = await this.graphql.request<{ restoreVersion: { currentVersion: number } }>(
      `mutation Restore($id: ID!, $number: Int!, $base: Int!) { restoreVersion(id: $id, number: $number, baseVersion: $base) { currentVersion } }`,
      { id, number, base: baseVersion },
    );
    return data.restoreVersion.currentVersion;
  }

  async renamePattern(id: string, name: string): Promise<string> {
    const data = await this.graphql.request<{ renamePattern: { name: string } }>(
      `mutation Rename($id: ID!, $name: String!) { renamePattern(id: $id, name: $name) { name } }`,
      { id, name },
    );
    return data.renamePattern.name;
  }

  async deletePattern(id: string): Promise<void> {
    await this.graphql.request(`mutation Delete($id: ID!) { deletePattern(id: $id) }`, { id });
  }

  async extractPalette(
    image: string,
    colors: number,
    options?: RequestOptions,
  ): Promise<PaletteColor[]> {
    const data = await this.graphql.request<{ extractPalette: PaletteColor[] }>(
      `mutation Palette($image: String!, $colors: Int!) { extractPalette(image: $image, colors: $colors) { hex share } }`,
      { image, colors },
      options,
    );
    return data.extractPalette;
  }

  async vectorizeImage(
    input: {
      image: string;
      width: number;
      height: number;
      colors?: number;
      detail?: number;
      minArea?: number;
    },
    options?: RequestOptions,
  ): Promise<VectorizeResult> {
    const data = await this.graphql.request<{ vectorizeImage: VectorizeResult }>(
      `mutation Vectorize(
         $image: String!,
         $width: Float!,
         $height: Float!,
         $colors: Int = 4,
         $detail: Float = 0.5,
         $minArea: Float = 20
       ) {
         vectorizeImage(
           image: $image,
           width: $width,
           height: $height,
           colors: $colors,
           detail: $detail,
           minArea: $minArea
         ) {
           layers { id name color areaShare }
           shapes
           elapsedMs
           notes
         }
       }`,
      {
        image: input.image,
        width: input.width,
        height: input.height,
        colors: input.colors ?? 4,
        detail: input.detail ?? 0.5,
        minArea: input.minArea ?? 20,
      },
      options,
    );
    return data.vectorizeImage;
  }

  async generateVariations(
    document: PatternDocument,
    palette: string[],
    seed: number,
    options?: RequestOptions,
  ): Promise<Variations> {
    const data = await this.graphql.request<{ generateVariations: Variations }>(
      `mutation Variations($document: JSON!, $palette: [String!]!, $seed: Int!) {
         generateVariations(document: $document, palette: $palette, count: 4, seed: $seed) {
           original { ${SCORE} } variations { document score { ${SCORE} } }
         }
       }`,
      { document, palette, seed },
      options,
    );
    return data.generateVariations;
  }

  async evolveVariations(
    input: {
      document: PatternDocument;
      palette: string[];
      favorites?: PatternDocument[];
      weights?: WeightsInput;
      seed?: number;
    },
    options?: RequestOptions,
  ): Promise<EvolvedVariations> {
    const data = await this.graphql.request<{ evolveVariations: EvolvedVariations }>(
      `mutation Evolve(
         $document: JSON!,
         $palette: [String!]!,
         $favorites: [JSON!] = [],
         $weights: WeightsInput,
         $seed: Int = 0
       ) {
         evolveVariations(
           document: $document,
           palette: $palette,
           favorites: $favorites,
           weights: $weights,
           seed: $seed
         ) {
           original { ${SCORE} }
           variations { document score { ${SCORE} } }
           history { generation best average }
         }
       }`,
      {
        document: input.document,
        palette: input.palette,
        favorites: input.favorites ?? [],
        weights: input.weights,
        seed: input.seed ?? 0,
      },
      options,
    );
    return data.evolveVariations;
  }

  async paretoVariations(
    document: PatternDocument,
    palette: string[],
    seed = 0,
    options?: RequestOptions,
  ): Promise<ParetoVariationsResult> {
    const data = await this.graphql.request<{ paretoVariations: ParetoVariationsResult }>(
      `mutation Pareto($document: JSON!, $palette: [String!]!, $seed: Int!) {
         paretoVariations(document: $document, palette: $palette, seed: $seed) {
           points { document balance contrast materialSaving }
           elapsedMs
         }
       }`,
      { document, palette, seed },
      options,
    );
    return data.paretoVariations;
  }

  async optimizeLayout(
    document: PatternDocument,
    rollWidth: number,
    spacing: number,
    extra?: OptimizeLayoutOptions,
    options?: RequestOptions,
  ): Promise<Layout> {
    if (!extra) {
      const data = await this.graphql.request<{ optimizeLayout: Layout }>(
        `mutation Layout($document: JSON!, $rollWidth: Float!, $spacing: Float!) {
           optimizeLayout(document: $document, rollWidth: $rollWidth, spacing: $spacing) {
             placements { shapeId x y width height rotated }
             usedLength wastePercent baselineLength baselineWastePercent
             cutOrder cutTravel baselineCutTravel
           }
         }`,
        { document, rollWidth, spacing },
        options,
      );
      return data.optimizeLayout;
    }
    const data = await this.graphql.request<{ optimizeLayout: Layout }>(
      `mutation Layout(
         $document: JSON!,
         $rollWidth: Float!,
         $spacing: Float!,
         $perLayer: Boolean = false,
         $sheetWidth: Float,
         $sheetHeight: Float,
         $method: LayoutMethod = SKYLINE
       ) {
         optimizeLayout(
           document: $document,
           rollWidth: $rollWidth,
           spacing: $spacing,
           perLayer: $perLayer,
           sheetWidth: $sheetWidth,
           sheetHeight: $sheetHeight,
           method: $method
         ) {
           placements { shapeId x y width height rotated }
           usedLength wastePercent baselineLength baselineWastePercent
           cutOrder cutTravel baselineCutTravel
           method
           layers {
             layerId color areaCm2 usedLength wastePercent sheets
             placements { shapeId x y width height rotated }
           }
         }
       }`,
      {
        document,
        rollWidth,
        spacing,
        perLayer: extra.perLayer ?? false,
        sheetWidth: extra.sheetWidth,
        sheetHeight: extra.sheetHeight,
        method: extra.method ?? 'SKYLINE',
      },
      options,
    );
    return data.optimizeLayout;
  }

  async analyzeColors(document: PatternDocument, options?: RequestOptions): Promise<ColorAnalysis> {
    const data = await this.graphql.request<{ analyzeColors: ColorAnalysis }>(
      `mutation AnalyzeColors($document: JSON!) {
         analyzeColors(document: $document) {
           pairs { a b deltaE tooSimilar }
           names { hex name }
           harmonies
         }
       }`,
      { document },
      options,
    );
    return data.analyzeColors;
  }
}
