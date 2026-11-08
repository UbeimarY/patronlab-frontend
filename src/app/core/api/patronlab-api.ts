import { Injectable, inject } from '@angular/core';

import { SessionUser } from '../auth/session.store';
import { PatternDocument } from '../editor/document';
import { GraphqlClient } from './graphql';

export interface AuthPayload {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

export interface PatternSummary {
  id: string;
  name: string;
  material: string;
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

export interface Layout {
  placements: {
    shapeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
  }[];
  usedLength: number;
  wastePercent: number;
  baselineLength: number;
  baselineWastePercent: number;
  cutOrder: string[];
  cutTravel: number;
  baselineCutTravel: number;
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

  async extractPalette(image: string, colors: number): Promise<PaletteColor[]> {
    const data = await this.graphql.request<{ extractPalette: PaletteColor[] }>(
      `mutation Palette($image: String!, $colors: Int!) { extractPalette(image: $image, colors: $colors) { hex share } }`,
      { image, colors },
    );
    return data.extractPalette;
  }

  async generateVariations(
    document: PatternDocument,
    palette: string[],
    seed: number,
  ): Promise<Variations> {
    const data = await this.graphql.request<{ generateVariations: Variations }>(
      `mutation Variations($document: JSON!, $palette: [String!]!, $seed: Int!) {
         generateVariations(document: $document, palette: $palette, count: 4, seed: $seed) {
           original { ${SCORE} } variations { document score { ${SCORE} } }
         }
       }`,
      { document, palette, seed },
    );
    return data.generateVariations;
  }

  async optimizeLayout(
    document: PatternDocument,
    rollWidth: number,
    spacing: number,
  ): Promise<Layout> {
    const data = await this.graphql.request<{ optimizeLayout: Layout }>(
      `mutation Layout($document: JSON!, $rollWidth: Float!, $spacing: Float!) {
         optimizeLayout(document: $document, rollWidth: $rollWidth, spacing: $spacing) {
           placements { shapeId x y width height rotated }
           usedLength wastePercent baselineLength baselineWastePercent
           cutOrder cutTravel baselineCutTravel
         }
       }`,
      { document, rollWidth, spacing },
    );
    return data.optimizeLayout;
  }
}
