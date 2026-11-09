import { describe, expect, it } from 'vitest';

import {
  PatternDocument,
  Shape,
  buildRadialCopies,
  createPathShape,
  migrateDocument,
  syncRadialGroups,
} from './document';
import {
  area,
  findPathSegment,
  handlePositions,
  hitTest,
  outline,
  pointInPolygon,
  toDocument,
  toLocal,
} from './geometry';

const rect = (changes: Partial<Shape> = {}): Shape => ({
  id: 'r',
  kind: 'rect',
  x: 50,
  y: 50,
  width: 40,
  height: 20,
  rotation: 0,
  fill: '#000000',
  stroke: '#000000',
  ...changes,
});

describe('geometry & document v2', () => {
  it('matches the API outline area for a rotated rectangle', () => {
    expect(area(outline(rect({ rotation: 30 })))).toBeCloseTo(800, 6);
  });

  it('builds the same outlines as the Python module', () => {
    const sizes = (['ellipse', 'star', 'leaf', 'hexagon', 'triangle'] as const).map(
      (kind) => outline(rect({ kind })).length,
    );
    expect(sizes).toEqual([48, 10, 48, 6, 3]);
  });

  it('computes outline, area and hitTest for a closed path shape', () => {
    const pathShape = createPathShape(
      [
        [100, 100],
        [140, 100],
        [140, 130],
        [100, 130],
      ],
      '#b3202a',
      'l-1',
    )!;
    expect(pathShape.kind).toBe('path');
    expect(pathShape.x).toBe(120);
    expect(pathShape.y).toBe(115);
    expect(area(outline(pathShape))).toBeCloseTo(1200, 5);

    const doc: PatternDocument = {
      schemaVersion: 2,
      mode: 'barniz',
      width: 300,
      height: 300,
      background: '#1b1512',
      shapes: [pathShape],
    };
    expect(hitTest(doc, [120, 115])?.id).toBe(pathShape.id);
    expect(hitTest(doc, [50, 50])).toBeNull();
  });

  it('finds the closest segment on a path shape for inserting a node', () => {
    const pathShape = createPathShape(
      [
        [100, 100],
        [140, 100],
        [120, 140],
      ],
      '#1f5fa0',
    )!;
    const hit = findPathSegment(pathShape, [120, 101], 5);
    expect(hit).not.toBeNull();
    expect(hit!.insertIndex).toBe(1);
  });

  it('migrates a v1 document to schemaVersion 2 with defaults', () => {
    const v1: PatternDocument = {
      width: 400,
      height: 400,
      background: '#f6efe3',
      shapes: [rect({ id: 's-1' })],
    };
    const migrated = migrateDocument(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.mode).toBe('pattern');
    expect(migrated.object).toBeNull();
    expect(migrated.layers).toEqual([]);
    expect(migrated.groups).toEqual([]);
    expect(migrated.shapes[0].layerId).toBeNull();
    expect(migrated.shapes[0].groupId).toBeNull();
  });

  it('generates and regenerates radial symmetry copies with optional mirror', () => {
    const source = rect({ id: 's-1', kind: 'leaf', x: 200, y: 80, width: 30, height: 60 });
    const copies = buildRadialCopies(
      source,
      { id: 'g-1', kind: 'radial', count: 6, mirror: true, sourceId: 's-1' },
      200,
      200,
    );
    expect(copies.length).toBe(5);
    expect(copies[0].groupId).toBe('g-1');
    // 180 deg copy (index 2, i=3) sits at (200, 320)
    expect(copies[2].x).toBeCloseTo(200, 1);
    expect(copies[2].y).toBeCloseTo(320, 1);

    const synced = syncRadialGroups(
      {
        schemaVersion: 2,
        mode: 'barniz',
        width: 400,
        height: 400,
        background: '#1b1512',
        groups: [{ id: 'g-1', kind: 'radial', count: 4, mirror: false, sourceId: 's-1' }],
        shapes: [source],
      },
      's-1',
    );
    expect(synced.shapes.length).toBe(4);
  });

  it('hits the topmost shape and skips hidden or locked layers', () => {
    const document: PatternDocument = {
      schemaVersion: 2,
      mode: 'barniz',
      width: 100,
      height: 100,
      background: '#ffffff',
      layers: [
        { id: 'l-1', name: 'Base', color: '#b3202a', visible: true, locked: false },
        { id: 'l-2', name: 'Oculta', color: '#1f5fa0', visible: false, locked: false },
      ],
      shapes: [
        rect({ id: 'below', layerId: 'l-1' }),
        rect({ id: 'hidden-top', x: 50, layerId: 'l-2' }),
      ],
    };
    expect(hitTest(document, [50, 50])?.id).toBe('below');
  });

  it('respects rotation when testing points', () => {
    const turned = outline(rect({ rotation: 90 })); // now 20 wide, 40 tall
    expect(pointInPolygon([50, 68], turned)).toBe(true);
    expect(pointInPolygon([68, 50], turned)).toBe(false);
  });

  it('converts to the shape frame and back', () => {
    const shape = rect({ rotation: 37 });
    const [x, y] = toDocument(shape, toLocal(shape, [61, 44]));
    expect(x).toBeCloseTo(61, 9);
    expect(y).toBeCloseTo(44, 9);
  });

  it('puts the resize handle on the corner and the rotate handle above', () => {
    const handles = handlePositions(rect(), 10);
    expect(handles.resize).toEqual([70, 60]);
    expect(handles.rotate).toEqual([50, 30]);
  });
});
