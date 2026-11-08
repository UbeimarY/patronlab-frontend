import { describe, expect, it } from 'vitest';

import { PatternDocument } from './document';
import { EditorStore } from './editor-store';

function loaded(): EditorStore {
  const store = new EditorStore();
  const document: PatternDocument = { width: 200, height: 200, background: '#ffffff', shapes: [] };
  store.load({ id: 'p1', name: 'Cojín', material: 'felt', currentVersion: 4, document });
  return store;
}

describe('EditorStore', () => {
  it('is clean after loading and dirty after an edit', () => {
    const store = loaded();
    expect(store.saveState()).toBe('saved');
    store.addShape('star', 50, 50);
    expect(store.dirty()).toBe(true);
  });

  it('counts undoing back to the saved state as clean', () => {
    const store = loaded();
    store.addShape('leaf', 20, 20);
    store.undo();
    expect(store.dirty()).toBe(false);
    expect(store.selectedId()).toBeNull();
  });

  it('treats a material change as unsaved', () => {
    const store = loaded();
    store.material.set('leather');
    expect(store.dirty()).toBe(true);
    store.markSaved(store.document(), 'leather', 5);
    expect(store.dirty()).toBe(false);
    expect(store.baseVersion()).toBe(5);
  });

  it('commits a whole drag as one undo step, and skips clicks that did not move', () => {
    const store = loaded();
    const shape = store.addShape('rect', 50, 50)!;
    const before = store.document();
    store.draft.set(shape);
    store.commitDraft();
    expect(store.document()).toBe(before);

    store.draft.set({ ...shape, x: 80 });
    expect(store.liveDocument().shapes[0].x).toBe(80);
    expect(store.document().shapes[0].x).toBe(50);
    store.commitDraft();
    expect(store.document().shapes[0].x).toBe(80);
    store.undo();
    expect(store.document().shapes[0].x).toBe(50);
  });

  it('keeps values inside what the API accepts', () => {
    const store = loaded();
    store.addShape('rect', 10, 10);
    store.updateSelected({ width: -5, rotation: 270 });
    expect(store.selected()!.width).toBe(2);
    expect(store.selected()!.rotation).toBe(-90);
  });

  it('duplicates, reorders and deletes the selection', () => {
    const store = loaded();
    const first = store.addShape('rect', 10, 10)!;
    store.duplicateSelected();
    const copy = store.selected()!;
    expect(copy.x).toBe(20);
    store.reorderSelected('back');
    expect(store.document().shapes[0].id).toBe(copy.id);
    store.deleteSelected();
    expect(store.document().shapes.map((s) => s.id)).toEqual([first.id]);
  });
});
