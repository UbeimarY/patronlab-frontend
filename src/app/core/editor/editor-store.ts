import { Injectable, computed, signal } from '@angular/core';

import { PaletteColor } from '../api/patronlab-api';
import {
  ANILINE_COLORS,
  BarnizLayer,
  MAX_LAYERS,
  MIN_PATH_POINTS,
  PatternDocument,
  RadialGroup,
  Shape,
  ShapeKind,
  clampShape,
  createPathShape,
  createShape,
  maxShapesFor,
  migrateDocument,
  newGroupId,
  newLayerId,
  newShapeId,
  round,
  syncRadialGroups,
  updateShape,
} from './document';
import { Point, boundingBox } from './geometry';
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
  /** Additional selected shape IDs when Shift-clicking or marquee-selecting. */
  readonly extraSelectedIds = signal<string[]>([]);

  readonly selectedIds = computed<string[]>(() => {
    const primary = this.selectedId();
    const extra = this.extraSelectedIds().filter((id) => id !== primary);
    return primary ? [primary, ...extra] : extra;
  });

  readonly selected = computed(
    () => this.document().shapes.find((shape) => shape.id === this.selectedId()) ?? null,
  );

  readonly selectedShapes = computed(() => {
    const ids = new Set(this.selectedIds());
    return this.document().shapes.filter((s) => ids.has(s.id));
  });

  /** The shape being dragged, resized or rotated: not in the history until released. */
  readonly draft = signal<Shape | null>(null);
  /** Index of the path node currently selected for editing or deletion. */
  readonly selectedNodeIndex = signal<number | null>(null);
  /** When > 0, limits how many layers are rendered (used during the AI sheet-by-sheet animation). */
  readonly animatedLayerLimit = signal<number | undefined>(undefined);

  /** The document as it looks right now, including a gesture in progress and radial copies. */
  readonly liveDocument = computed(() => {
    const draft = this.draft();
    return draft ? updateShape(this.document(), draft.id, draft) : this.document();
  });
  readonly liveSelected = computed(() => this.draft() ?? this.selected());

  readonly activeLayerId = signal<string | null>(null);
  readonly activeLayer = computed(() => {
    const layers = this.document().layers ?? [];
    if (layers.length === 0) return null;
    return layers.find((l) => l.id === this.activeLayerId()) ?? layers[layers.length - 1];
  });

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
    const migrated = migrateDocument(pattern.document);
    this.patternId.set(pattern.id);
    this.name.set(pattern.name);
    this.material.set(pattern.material);
    this.savedMaterial.set(pattern.material);
    this.baseVersion.set(pattern.currentVersion);
    this.history.reset(migrated);
    this.savedDocument.set(migrated);
    this.selectedId.set(null);
    this.extraSelectedIds.set([]);
    this.selectedNodeIndex.set(null);
    this.draft.set(null);
    this.saveError.set(null);
    const layers = migrated.layers ?? [];
    if (layers.length > 0) {
      const top = layers[layers.length - 1];
      this.activeLayerId.set(top.id);
      this.fill.set(top.color);
    } else {
      this.activeLayerId.set(null);
    }
  }

  markSaved(document: PatternDocument, material: string, version: number): void {
    this.savedDocument.set(document);
    this.savedMaterial.set(material);
    this.baseVersion.set(version);
    this.saveError.set(null);
  }

  apply(document: PatternDocument): void {
    this.history.push(migrateDocument(document));
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
    const doc = this.document();
    if (doc.shapes.length >= maxShapesFor(doc)) return null;
    const layer = doc.mode === 'barniz' ? this.activeLayer() : null;
    if (layer?.locked) return null;
    const color = layer ? layer.color : this.fill();
    const shape = createShape(kind, x, y, color, layer?.id ?? null);
    this.apply({ ...doc, shapes: [...doc.shapes, shape] });
    this.selectedId.set(shape.id);
    this.extraSelectedIds.set([]);
    return shape;
  }

  /** Adds a closed path cut with the Bisturí tool. */
  addPath(points: readonly Point[]): Shape | null {
    const doc = this.document();
    if (doc.shapes.length >= maxShapesFor(doc)) return null;
    const layer = doc.mode === 'barniz' ? this.activeLayer() : null;
    if (layer?.locked) return null;
    const color = layer ? layer.color : this.fill();
    const shape = createPathShape(points, color, layer?.id ?? null);
    if (!shape) return null;
    this.apply({ ...doc, shapes: [...doc.shapes, shape] });
    this.selectedId.set(shape.id);
    this.extraSelectedIds.set([]);
    return shape;
  }

  // ---------- Path node editing ----------

  insertPathNode(insertIndex: number, localPoint: Point): void {
    const shape = this.selected();
    if (!shape || shape.kind !== 'path' || !shape.points) return;
    const pts = [...shape.points];
    pts.splice(insertIndex, 0, [round(localPoint[0]), round(localPoint[1])]);
    this.updateSelected({ points: pts });
    this.selectedNodeIndex.set(insertIndex);
  }

  deletePathNode(nodeIndex: number): void {
    const shape = this.selected();
    if (!shape || shape.kind !== 'path' || !shape.points) return;
    if (shape.points.length <= MIN_PATH_POINTS) return;
    const pts = shape.points.filter((_, idx) => idx !== nodeIndex);
    this.updateSelected({ points: pts });
    this.selectedNodeIndex.set(null);
  }

  // ---------- Selection & Multi-selection ----------

  selectOne(id: string | null): void {
    this.selectedId.set(id);
    this.extraSelectedIds.set([]);
    this.selectedNodeIndex.set(null);
  }

  toggleSelection(id: string): void {
    const current = this.selectedIds();
    if (current.includes(id)) {
      const remaining = current.filter((item) => item !== id);
      this.selectedId.set(remaining[0] ?? null);
      this.extraSelectedIds.set(remaining.slice(1));
    } else {
      if (!this.selectedId()) {
        this.selectedId.set(id);
      } else {
        this.extraSelectedIds.update((list) => [...list, id]);
      }
    }
    this.selectedNodeIndex.set(null);
  }

  selectMany(ids: string[]): void {
    this.selectedId.set(ids[0] ?? null);
    this.extraSelectedIds.set(ids.slice(1));
    this.selectedNodeIndex.set(null);
  }

  deleteSelected(): void {
    const ids = new Set(this.selectedIds());
    if (ids.size === 0) return;
    const doc = this.document();
    // If deleting a radial source, also delete its radial group and copies
    const groupsToRemove = new Set(
      (doc.groups ?? []).filter((g) => ids.has(g.sourceId)).map((g) => g.id),
    );
    const shapes = doc.shapes.filter(
      (s) => !ids.has(s.id) && !(s.groupId && groupsToRemove.has(s.groupId)),
    );
    const groups = (doc.groups ?? []).filter((g) => !groupsToRemove.has(g.id));
    this.apply({ ...doc, shapes, groups });
    this.selectedId.set(null);
    this.extraSelectedIds.set([]);
  }

  duplicateSelected(): void {
    const shape = this.selected();
    const doc = this.document();
    if (!shape || doc.shapes.length >= maxShapesFor(doc)) return;
    const copy = clampShape({
      ...shape,
      id: newShapeId(),
      x: shape.x + 10,
      y: shape.y + 10,
      groupId: null,
    });
    this.apply({ ...doc, shapes: [...doc.shapes, copy] });
    this.selectedId.set(copy.id);
    this.extraSelectedIds.set([]);
  }

  moveSelected(dx: number, dy: number): void {
    const ids = this.selectedIds();
    if (ids.length === 0) return;
    if (ids.length === 1) {
      const shape = this.selected();
      if (shape) this.updateSelected({ x: shape.x + dx, y: shape.y + dy });
      return;
    }
    const idSet = new Set(ids);
    const doc = this.document();
    const shapes = doc.shapes.map((s) =>
      idSet.has(s.id) ? clampShape({ ...s, x: s.x + dx, y: s.y + dy }) : s,
    );
    this.apply(syncRadialGroups({ ...doc, shapes }));
  }

  reorderSelected(direction: 'front' | 'back'): void {
    const shape = this.selected();
    if (!shape) return;
    const others = this.document().shapes.filter((s) => s.id !== shape.id);
    const shapes = direction === 'front' ? [...others, shape] : [shape, ...others];
    this.apply({ ...this.document(), shapes });
  }

  // ---------- Flip, Align, Distribute, Group ----------

  flipSelected(axis: 'horizontal' | 'vertical'): void {
    const ids = new Set(this.selectedIds());
    if (ids.size === 0) return;
    const doc = this.document();
    const selected = doc.shapes.filter((s) => ids.has(s.id));
    const avgX = selected.reduce((sum, s) => sum + s.x, 0) / selected.length;
    const avgY = selected.reduce((sum, s) => sum + s.y, 0) / selected.length;

    const shapes = doc.shapes.map((s) => {
      if (!ids.has(s.id)) return s;
      const nx = axis === 'horizontal' && selected.length > 1 ? round(2 * avgX - s.x) : s.x;
      const ny = axis === 'vertical' && selected.length > 1 ? round(2 * avgY - s.y) : s.y;
      const rot = axis === 'horizontal' ? -s.rotation : 180 - s.rotation;
      if (s.kind === 'path' && s.points) {
        const pts = s.points
          .map(([px, py]) =>
            axis === 'horizontal'
              ? ([round(-px), round(py)] as const)
              : ([round(px), round(-py)] as const),
          )
          .reverse();
        return clampShape({ ...s, x: nx, y: ny, points: pts });
      }
      return clampShape({ ...s, x: nx, y: ny, rotation: rot });
    });
    this.apply(syncRadialGroups({ ...doc, shapes }));
  }

  alignSelected(mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'): void {
    const selected = this.selectedShapes();
    if (selected.length === 0) return;
    const doc = this.document();
    const ids = new Set(selected.map((s) => s.id));
    const boxes = new Map(selected.map((s) => [s.id, boundingBox(s)]));

    const minX =
      selected.length === 1 ? 0 : Math.min(...selected.map((s) => boxes.get(s.id)!.minX));
    const maxX =
      selected.length === 1 ? doc.width : Math.max(...selected.map((s) => boxes.get(s.id)!.maxX));
    const minY =
      selected.length === 1 ? 0 : Math.min(...selected.map((s) => boxes.get(s.id)!.minY));
    const maxY =
      selected.length === 1 ? doc.height : Math.max(...selected.map((s) => boxes.get(s.id)!.maxY));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const shapes = doc.shapes.map((s) => {
      if (!ids.has(s.id)) return s;
      const box = boxes.get(s.id)!;
      switch (mode) {
        case 'left':
          return clampShape({ ...s, x: s.x + (minX - box.minX) });
        case 'center-x':
          return clampShape({ ...s, x: round(midX) });
        case 'right':
          return clampShape({ ...s, x: s.x + (maxX - box.maxX) });
        case 'top':
          return clampShape({ ...s, y: s.y + (minY - box.minY) });
        case 'center-y':
          return clampShape({ ...s, y: round(midY) });
        case 'bottom':
          return clampShape({ ...s, y: s.y + (maxY - box.maxY) });
      }
    });
    this.apply(syncRadialGroups({ ...doc, shapes }));
  }

  distributeSelected(axis: 'x' | 'y'): void {
    const selected = this.selectedShapes();
    if (selected.length < 3) return;
    const sorted = [...selected].sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
    const first = axis === 'x' ? sorted[0].x : sorted[0].y;
    const last = axis === 'x' ? sorted[sorted.length - 1].x : sorted[sorted.length - 1].y;
    const step = (last - first) / (sorted.length - 1);
    const targetById = new Map(sorted.map((s, i) => [s.id, round(first + step * i)]));
    const doc = this.document();
    const shapes = doc.shapes.map((s) => {
      const target = targetById.get(s.id);
      if (target === undefined) return s;
      return clampShape(axis === 'x' ? { ...s, x: target } : { ...s, y: target });
    });
    this.apply(syncRadialGroups({ ...doc, shapes }));
  }

  groupSelected(): void {
    const selected = this.selectedShapes();
    if (selected.length < 2) return;
    const groupId = newGroupId();
    const ids = new Set(selected.map((s) => s.id));
    const doc = this.document();
    const shapes = doc.shapes.map((s) => (ids.has(s.id) ? { ...s, groupId } : s));
    this.apply({ ...doc, shapes });
  }

  ungroupSelected(): void {
    const selected = this.selectedShapes();
    if (selected.length === 0) return;
    const groupIds = new Set(selected.map((s) => s.groupId).filter((g): g is string => Boolean(g)));
    if (groupIds.size === 0) return;
    const doc = this.document();
    const shapes = doc.shapes.map((s) =>
      s.groupId && groupIds.has(s.groupId) ? { ...s, groupId: null } : s,
    );
    const groups = (doc.groups ?? []).filter((g) => !groupIds.has(g.id));
    this.apply({ ...doc, shapes, groups });
  }

  // ---------- Radial Symmetry ----------

  radialGroupOf(shape: Shape | null): RadialGroup | null {
    if (!shape) return null;
    const groups = this.document().groups ?? [];
    return (
      groups.find(
        (g) => g.kind === 'radial' && (g.sourceId === shape.id || g.id === shape.groupId),
      ) ?? null
    );
  }

  setRadialSymmetry(count: number | null, mirror = false): void {
    const shape = this.selected();
    if (!shape) return;
    const doc = this.document();
    const existing = this.radialGroupOf(shape);
    const sourceId = existing ? existing.sourceId : shape.id;

    if (count === null || count < 2) {
      if (!existing) return;
      const shapes = doc.shapes
        .filter((s) => s.groupId !== existing.id || s.id === sourceId)
        .map((s) => (s.id === sourceId ? { ...s, groupId: null } : s));
      const groups = (doc.groups ?? []).filter((g) => g.id !== existing.id);
      this.apply({ ...doc, shapes, groups });
      this.selectedId.set(sourceId);
      return;
    }

    const clampedCount = Math.min(24, Math.max(2, Math.round(count)));
    const group: RadialGroup = existing
      ? { ...existing, count: clampedCount, mirror }
      : { id: newGroupId(), kind: 'radial', count: clampedCount, mirror, sourceId };
    const groups = existing
      ? (doc.groups ?? []).map((g) => (g.id === existing.id ? group : g))
      : [...(doc.groups ?? []), group];
    const shapes = doc.shapes.map((s) => (s.id === sourceId ? { ...s, groupId: group.id } : s));
    this.apply(syncRadialGroups({ ...doc, shapes, groups }, sourceId));
    this.selectedId.set(sourceId);
  }

  // ---------- Barniz Layers ----------

  selectLayer(layerId: string): void {
    const layer = (this.document().layers ?? []).find((l) => l.id === layerId);
    if (!layer) return;
    this.activeLayerId.set(layer.id);
    this.fill.set(layer.color);
  }

  addLayer(name?: string, color?: string): BarnizLayer | null {
    const doc = this.document();
    const layers = doc.layers ?? [];
    if (layers.length >= MAX_LAYERS) return null;
    const preset = ANILINE_COLORS[layers.length % ANILINE_COLORS.length];
    const layer: BarnizLayer = {
      id: newLayerId(),
      name: name?.trim() || preset.name,
      color: (color || preset.hex).toLowerCase(),
      visible: true,
      locked: false,
    };
    this.apply({ ...doc, layers: [...layers, layer] });
    this.activeLayerId.set(layer.id);
    this.fill.set(layer.color);
    return layer;
  }

  updateLayer(layerId: string, changes: Partial<BarnizLayer>): void {
    const doc = this.document();
    const layers = (doc.layers ?? []).map((l) => (l.id === layerId ? { ...l, ...changes } : l));
    this.apply({ ...doc, layers });
  }

  applyColorToLayer(layerId: string, color: string): void {
    const hex = color.toLowerCase();
    const doc = this.document();
    const layers = (doc.layers ?? []).map((l) => (l.id === layerId ? { ...l, color: hex } : l));
    const shapes = doc.shapes.map((s) => (s.layerId === layerId ? { ...s, fill: hex } : s));
    this.apply({ ...doc, layers, shapes });
    if (this.activeLayerId() === layerId) this.fill.set(hex);
  }

  moveLayer(layerId: string, delta: -1 | 1): void {
    const doc = this.document();
    const layers = [...(doc.layers ?? [])];
    const index = layers.findIndex((l) => l.id === layerId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= layers.length) return;
    const [moved] = layers.splice(index, 1);
    layers.splice(target, 0, moved);
    this.apply({ ...doc, layers });
  }

  deleteLayer(layerId: string): void {
    const doc = this.document();
    const layers = (doc.layers ?? []).filter((l) => l.id !== layerId);
    const fallbackLayerId = layers[layers.length - 1]?.id ?? null;
    const shapes = doc.shapes.filter((s) => s.layerId !== layerId);
    this.apply({ ...doc, layers, shapes });
    if (this.activeLayerId() === layerId) {
      this.activeLayerId.set(fallbackLayerId);
    }
    this.dropMissingSelection();
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
    const existing = new Set(this.document().shapes.map((s) => s.id));
    this.extraSelectedIds.update((ids) => ids.filter((id) => existing.has(id)));
  }
}

function sameGeometry(a: Shape, b: Shape): boolean {
  if (
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height ||
    a.rotation !== b.rotation
  ) {
    return false;
  }
  if (a.kind === 'path' || b.kind === 'path') {
    const pa = a.points ?? [];
    const pb = b.points ?? [];
    if (pa.length !== pb.length) return false;
    return pa.every(([ax, ay], i) => ax === pb[i][0] && ay === pb[i][1]);
  }
  return true;
}
