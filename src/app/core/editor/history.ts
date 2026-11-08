import { computed, signal } from '@angular/core';

import { PatternDocument } from './document';

const LIMIT = 100;

/**
 * Undo/redo over immutable snapshots. Documents are small (≤ 400 shapes) and
 * shapes are shared between snapshots that did not change them, so keeping
 * the last 100 states costs little and every undo is exact.
 */
export class History {
  private readonly past = signal<PatternDocument[]>([]);
  private readonly future = signal<PatternDocument[]>([]);
  readonly present = signal<PatternDocument>({
    width: 300,
    height: 300,
    background: '#f4f1ec',
    shapes: [],
  });

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  /** Starts over from a loaded document: no undo into another pattern. */
  reset(document: PatternDocument): void {
    this.past.set([]);
    this.future.set([]);
    this.present.set(document);
  }

  push(document: PatternDocument): void {
    if (document === this.present()) return;
    this.past.update((past) => [...past, this.present()].slice(-LIMIT));
    this.future.set([]);
    this.present.set(document);
  }

  undo(): void {
    const past = this.past();
    if (past.length === 0) return;
    this.future.update((future) => [this.present(), ...future]);
    this.present.set(past[past.length - 1]);
    this.past.set(past.slice(0, -1));
  }

  redo(): void {
    const [next, ...rest] = this.future();
    if (!next) return;
    this.past.update((past) => [...past, this.present()]);
    this.present.set(next);
    this.future.set(rest);
  }
}
