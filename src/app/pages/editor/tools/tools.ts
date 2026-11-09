import { Component, inject } from '@angular/core';

import {
  PRIMITIVE_SHAPE_KINDS,
  PrimitiveShapeKind,
  SHAPE_LABELS,
  ShapeKind,
} from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { outline } from '../../../core/editor/geometry';

/** Shape tools. Icons are drawn from the same outlines the canvas uses. */
@Component({
  selector: 'app-tools',
  template: `
    <div class="rail" role="toolbar" aria-label="Figuras" aria-orientation="vertical">
      @for (kind of kinds; track kind) {
        <button
          type="button"
          class="tool"
          [class.active]="store.tool() === kind"
          [attr.aria-pressed]="store.tool() === kind"
          [title]="labels[kind] + ': clic en la mesa para colocar (Shift para varias)'"
          (click)="toggle(kind)"
        >
          <svg viewBox="-12 -12 24 24" aria-hidden="true">
            <polygon [attr.points]="icons[kind]" />
          </svg>
          <span>{{ labels[kind] }}</span>
        </button>
      }
      <label class="fill" title="Color para las piezas nuevas">
        <input
          type="color"
          [value]="store.fill()"
          (change)="store.fill.set($any($event.target).value)"
        />
        <span>Color</span>
      </label>
    </div>
  `,
  styles: `
    .rail {
      display: grid;
      gap: 2px;
      padding: 0.5rem 0.35rem;
    }
    .tool,
    .fill {
      display: grid;
      justify-items: center;
      gap: 2px;
      width: 64px;
      padding: 0.45rem 0.2rem;
      border: 0;
      border-radius: 6px;
      background: transparent;
      font-size: 0.72rem;
      color: var(--muted);
      cursor: pointer;
    }
    .tool:hover {
      background: var(--paper-2);
    }
    .tool.active {
      background: var(--mat);
      color: #fff;
    }
    svg {
      width: 26px;
      height: 26px;
    }
    polygon {
      fill: currentColor;
      fill-opacity: 0.15;
      stroke: currentColor;
      stroke-width: 1.4;
      stroke-linejoin: round;
    }
    .tool.active polygon {
      fill: var(--chalk);
      fill-opacity: 1;
      stroke: #1d2321;
    }
    .fill input {
      width: 30px;
      height: 26px;
      padding: 1px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--paper);
      cursor: pointer;
    }
  `,
})
export class Tools {
  readonly store = inject(EditorStore);
  readonly kinds = PRIMITIVE_SHAPE_KINDS;
  readonly labels = SHAPE_LABELS;
  readonly icons = Object.fromEntries(
    PRIMITIVE_SHAPE_KINDS.map((kind) => [
      kind,
      outline({
        id: kind,
        kind,
        x: 0,
        y: 0,
        width: kind === 'leaf' ? 12 : 20,
        height: 20,
        rotation: 0,
        fill: '',
        stroke: '',
      })
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' '),
    ]),
  ) as Record<PrimitiveShapeKind, string>;

  toggle(kind: ShapeKind): void {
    this.store.tool.update((current) => (current === kind ? null : kind));
  }
}
