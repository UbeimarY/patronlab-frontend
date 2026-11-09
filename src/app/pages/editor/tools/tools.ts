import { Component, inject } from '@angular/core';

import {
  PRIMITIVE_SHAPE_KINDS,
  PrimitiveShapeKind,
  SHAPE_LABELS,
  ShapeKind,
} from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { outline } from '../../../core/editor/geometry';

/** Shape and Bisturí tools. Icons are drawn from the same outlines the canvas uses. */
@Component({
  selector: 'app-tools',
  template: `
    <div
      class="rail"
      role="toolbar"
      aria-label="Herramientas y figuras"
      aria-orientation="vertical"
    >
      <button
        type="button"
        class="tool"
        [class.active]="store.tool() === null"
        [attr.aria-pressed]="store.tool() === null"
        title="Seleccionar y mover piezas (Esc)"
        (click)="store.tool.set(null)"
      >
        <svg viewBox="-12 -12 24 24" aria-hidden="true">
          <path
            d="M-6,-9 L7,1 L1,2 L4,9 L1,10 L-2,3 L-6,7 Z"
            fill="currentColor"
            fill-opacity="0.2"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
        <span>Elegir</span>
      </button>

      <button
        type="button"
        class="tool bisturi"
        [class.active]="store.tool() === 'path'"
        [attr.aria-pressed]="store.tool() === 'path'"
        title="Bisturí (B): clic para poner puntos, arrastrar para curva suave, doble clic o clic en el inicio para cerrar el corte"
        (click)="toggle('path')"
      >
        <svg viewBox="-12 -12 24 24" aria-hidden="true">
          <path
            d="M-9,9 L-2,2 L2,5 L-9,9 Z M-2,2 L7,-7 L9,-5 L0,4 Z"
            fill="currentColor"
            fill-opacity="0.25"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linejoin="round"
          />
        </svg>
        <span>Bisturí</span>
      </button>

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
      padding: 0.42rem 0.2rem;
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
    .tool.bisturi.active {
      background: var(--barniz-wood);
      outline: 1px solid var(--gold);
      color: var(--gold-bright);
    }
    svg {
      width: 24px;
      height: 24px;
    }
    polygon {
      fill: currentColor;
      fill-opacity: 0.15;
      stroke: currentColor;
      stroke-width: 1.4;
      stroke-linejoin: round;
    }
    .tool.active polygon,
    .tool.active path {
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
    @media (max-width: 640px) {
      .rail {
        display: flex;
        align-items: center;
        overflow-x: auto;
        padding: 0.25rem 0.4rem;
        gap: 4px;
      }
      .tool,
      .fill {
        width: auto;
        min-width: 54px;
        flex: 0 0 auto;
        padding: 0.3rem 0.35rem;
      }
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
