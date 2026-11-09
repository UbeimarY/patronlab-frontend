import { PatternDocument, Shape } from './document';

export interface Guides {
  /** Vertical guide at this x (mm), or null. */
  x: number | null;
  /** Horizontal guide at this y (mm), or null. */
  y: number | null;
}

export const NO_GUIDES: Guides = { x: null, y: null };

/**
 * Smart guides: while a piece moves, its center snaps to the center of the
 * material or to the center of another piece when it comes close, so motifs
 * line up without measuring. Returns the snapped position and the guides to draw.
 */
export function snapToGuides(
  moving: Shape,
  document: PatternDocument,
  tolerance: number,
): { x: number; y: number; guides: Guides } {
  const others = document.shapes.filter((shape) => shape.id !== moving.id);
  const nearest = (value: number, targets: number[]): number | null => {
    let best: number | null = null;
    for (const target of targets) {
      const distance = Math.abs(target - value);
      if (distance <= tolerance && (best === null || distance < Math.abs(best - value))) {
        best = target;
      }
    }
    return best;
  };
  const gx = nearest(moving.x, [document.width / 2, ...others.map((shape) => shape.x)]);
  const gy = nearest(moving.y, [document.height / 2, ...others.map((shape) => shape.y)]);
  return { x: gx ?? moving.x, y: gy ?? moving.y, guides: { x: gx, y: gy } };
}
