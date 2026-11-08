import { describe, expect, it } from 'vitest';

import { PatternDocument } from './document';
import { History } from './history';

const doc = (shapes: number): PatternDocument => ({
  width: 100,
  height: 100,
  background: '#ffffff',
  shapes: Array.from({ length: shapes }, (_, i) => ({
    id: `s${i}`,
    kind: 'rect' as const,
    x: 10,
    y: 10,
    width: 5,
    height: 5,
    rotation: 0,
    fill: '#000000',
    stroke: '#000000',
  })),
});

describe('History', () => {
  it('undoes and redoes exact snapshots', () => {
    const history = new History();
    const a = doc(1);
    const b = doc(2);
    history.reset(a);
    history.push(b);
    history.undo();
    expect(history.present()).toBe(a);
    history.redo();
    expect(history.present()).toBe(b);
  });

  it('drops the redo branch after a new edit', () => {
    const history = new History();
    history.reset(doc(0));
    history.push(doc(1));
    history.undo();
    history.push(doc(3));
    expect(history.canRedo()).toBe(false);
    expect(history.present().shapes).toHaveLength(3);
  });

  it('keeps at most 100 steps', () => {
    const history = new History();
    history.reset(doc(0));
    for (let i = 0; i < 150; i++) history.push(doc(1));
    let steps = 0;
    while (history.canUndo()) {
      history.undo();
      steps++;
    }
    expect(steps).toBe(100);
  });

  it('starts over when another pattern loads', () => {
    const history = new History();
    history.reset(doc(0));
    history.push(doc(1));
    history.reset(doc(5));
    expect(history.canUndo()).toBe(false);
  });
});
