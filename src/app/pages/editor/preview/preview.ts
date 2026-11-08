import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { MATERIALS, materialOf } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { materialTexture } from '../../../core/editor/material-texture';
import { drawShapes } from '../../../core/editor/render';

type Mode = 'piece' | 'repeat';

/**
 * Live preview of the design on its material, updated while you drag.
 * The design is rendered once per change into an offscreen tile; the repeat
 * view then fills the canvas with that tile as a pattern, so it stays cheap.
 */
@Component({
  selector: 'app-preview',
  template: `
    <section class="block">
      <div class="head">
        <h3>Así se verá</h3>
        <div class="modes" role="radiogroup" aria-label="Tipo de vista">
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="mode() === 'piece'"
            (click)="mode.set('piece')"
          >
            Pieza
          </button>
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="mode() === 'repeat'"
            (click)="mode.set('repeat')"
          >
            Estampado
          </button>
        </div>
      </div>
      <canvas
        #canvas
        role="img"
        [attr.aria-label]="'Vista previa sobre ' + materialLabel()"
      ></canvas>
      <label class="material">
        Material
        <select [value]="store.material()" (change)="store.material.set($any($event.target).value)">
          @for (option of materials; track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
      </label>
      <p class="muted">
        Se actualiza en vivo mientras mueves las piezas. El material se guarda con el patrón.
      </p>
    </section>
  `,
  styles: `
    .block {
      display: grid;
      gap: 0.6rem;
      padding: 1rem;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    canvas {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 6px;
      border: 1px solid var(--line);
    }
    .modes {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .modes button {
      border: 0;
      background: transparent;
      padding: 0.25rem 0.6rem;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .modes button[aria-checked='true'] {
      background: var(--mat);
      color: #fff;
    }
    .material {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .material select {
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--paper);
      color: var(--ink);
      padding: 0 0.4rem;
    }
    .muted {
      color: var(--muted);
      font-size: 0.82rem;
    }
  `,
})
export class Preview {
  readonly store = inject(EditorStore);
  readonly materials = MATERIALS;
  readonly mode = signal<Mode>('piece');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private frame = 0;

  materialLabel(): string {
    return materialOf(this.store.material()).label;
  }

  constructor() {
    effect(() => {
      // Reading the signals subscribes; the drawing itself waits for the next frame,
      // so several changes within one frame cost a single render.
      this.store.liveDocument();
      this.store.material();
      this.mode();
      if (!this.frame) this.frame = requestAnimationFrame(() => this.render());
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  private render(): void {
    this.frame = 0;
    const canvas = this.canvas().nativeElement;
    const size = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)) || 300;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const document = this.store.liveDocument();
    const material = materialOf(this.store.material());

    ctx.fillStyle = ctx.createPattern(materialTexture(material.id, material.color), 'repeat')!;
    ctx.fillRect(0, 0, size, size);

    const tiles = this.mode() === 'repeat' ? 3 : 1;
    const tileSize = (size / tiles) * (tiles === 1 ? 0.86 : 1);
    const scale = tileSize / Math.max(document.width, document.height);
    const tile = window.document.createElement('canvas');
    tile.width = Math.max(1, Math.round(document.width * scale));
    tile.height = Math.max(1, Math.round(document.height * scale));
    const tileCtx = tile.getContext('2d')!;
    drawShapes(tileCtx, document, scale);

    if (tiles === 1) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = size / 60;
      ctx.drawImage(tile, (size - tile.width) / 2, (size - tile.height) / 2);
      ctx.restore();
    } else {
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
      ctx.fillRect(0, 0, size, size);
    }
  }
}
