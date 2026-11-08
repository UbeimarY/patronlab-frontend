import { Injectable, computed, signal } from '@angular/core';

import { PaletteColor } from '../api/patronlab-api';
import {
  MAX_SHAPES,
  PatternDocument,
  Shape,
  ShapeKind,
  clampShape,
  createShape,
  newShapeId,
  updateShape,
} from './document';
import { History } from './history';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

/** State of one open pattern, shared by the stage, the inspector and the side panels. */
@Injectable()
export class EditorStore {
  readonly history = new History();
  readonly document = this.history.present;

  // Pattern metadata, as last loaded or saved.
  readonly patternId = signal('');
  readonly name = signal('');
  readonly material = signal('felt');
  readonly baseVersion = signal(1);
  private readonly savedDocument = signal<PatternDocument | null>(null);
  private readonly savedMaterial = signal('felt');
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(
    () => this.document().shapes.find((shape) => shape.id === this.selectedId()) ?? null,
  );
  /** The shape being dragged, resized or rotated: not in the history until released. */
  readonly draft = signal<Shape | null>(null);
  /** The document as it looks right now, including a gesture in progress. */
  readonly liveDocument = computed(() => {
    const draft = this.draft();
    return draft ? updateShape(this.document(), draft.id, draft) : this.document();
  });
  readonly liveSelected = computed(() => this.draft() ?? this.selected());

  readonly tool = signal<ShapeKind | null>(null);
  readonly fill = signal('#3f6b3a');
  readonly palette = signal<PaletteColor[]>([]);

  /** Undo back to the saved state counts as clean: snapshots are compared by identity. */
  readonly dirty = computed(
    () => this.document() !== this.savedDocument() || this.material() !== this.savedMaterial(),
  );
  readonly saveState = computed<SaveState>(() =>
    this.saving() ? 'saving' : this.saveError() ? 'error' : this.dirty() ? 'dirty' : 'saved',
  );

  load(pattern: {
    id: string;
    name: string;
    material: string;
    currentVersion: number;
    document: PatternDocument;
  }): void {
    this.patternId.set(pattern.id);
    this.name.set(pattern.name);
    this.material.set(pattern.material);
    this.savedMaterial.set(pattern.material);
    this.baseVersion.set(pattern.currentVersion);
    this.history.reset(pattern.document);
    this.savedDocument.set(pattern.document);
    this.selectedId.set(null);
    this.draft.set(null);
    this.saveError.set(null);
  }

  markSaved(document: PatternDocument, material: string, version: number): void {
    this.savedDocument.set(document);
    this.savedMaterial.set(material);
    this.baseVersion.set(version);
    this.saveError.set(null);
  }

  apply(document: PatternDocument): void {
    this.history.push(document);
  }

  commitDraft(): void {
    const draft = this.draft();
    this.draft.set(null);
    if (!draft) return;
    const current = this.document().shapes.find((shape) => shape.id === draft.id);
    if (!current || sameGeometry(current, draft)) return;
    this.apply(updateShape(this.document(), draft.id, clampShape(draft)));
  }

  updateSelected(changes: Partial<Shape>): void {
    const shape = this.selected();
    if (!shape) return;
    this.apply(updateShape(this.document(), shape.id, clampShape({ ...shape, ...changes })));
  }

  updateDocument(changes: Partial<Omit<PatternDocument, 'shapes'>>): void {
    this.apply({ ...this.document(), ...changes });
  }

  addShape(kind: ShapeKind, x: number, y: number): Shape | null {
    if (this.document().shapes.length >= MAX_SHAPES) return null;
    const shape = createShape(kind, x, y, this.fill());
    this.apply({ ...this.document(), shapes: [...this.document().shapes, shape] });
    this.selectedId.set(shape.id);
    return shape;
  }

  deleteSelected(): void {
    const id = this.selectedId();
    if (!id) return;
    this.apply({ ...this.document(), shapes: this.document().shapes.filter((s) => s.id !== id) });
    this.selectedId.set(null);
  }

  duplicateSelected(): void {
    const shape = this.selected();
    if (!shape || this.document().shapes.length >= MAX_SHAPES) return;
    const copy = clampShape({ ...shape, id: newShapeId(), x: shape.x + 10, y: shape.y + 10 });
    this.apply({ ...this.document(), shapes: [...this.document().shapes, copy] });
    this.selectedId.set(copy.id);
  }

  moveSelected(dx: number, dy: number): void {
    const shape = this.selected();
    if (shape) this.updateSelected({ x: shape.x + dx, y: shape.y + dy });
  }

  reorderSelected(direction: 'front' | 'back'): void {
    const shape = this.selected();
    if (!shape) return;
    const others = this.document().shapes.filter((s) => s.id !== shape.id);
    const shapes = direction === 'front' ? [...others, shape] : [shape, ...others];
    this.apply({ ...this.document(), shapes });
  }

  undo(): void {
    this.history.undo();
    this.dropMissingSelection();
  }

  redo(): void {
    this.history.redo();
    this.dropMissingSelection();
  }

  private dropMissingSelection(): void {
    if (!this.selected()) this.selectedId.set(null);
  }
}

function sameGeometry(a: Shape, b: Shape): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation
  );
}
