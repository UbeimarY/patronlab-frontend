import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MATERIALS, materialOf } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { materialTexture } from '../../../core/editor/material-texture';
import { PaperSize, buildTiledPrintHtml } from '../../../core/editor/print-scale';
import { drawBackground, drawShapes } from '../../../core/editor/render';
import { download, slug } from '../../../core/editor/svg-export';

type Mode = 'piece' | 'repeat' | '3d';

/**
 * Live preview of the design on its material or as a rotatable 3D lacquered wooden
 * object with dynamic lighting and gold leaf specular reflection. Also provides
 * 1:1 tiled printing on A4 or Letter sheets with registration marks.
 */
@Component({
  selector: 'app-preview',
  imports: [FormsModule],
  template: `
    <section class="block">
      <div class="head">
        <h3>Así se verá</h3>
        <div class="modes" role="radiogroup" aria-label="Tipo de vista">
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="mode() === '3d'"
            (click)="mode.set('3d')"
          >
            Objeto 3D
          </button>
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
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
      ></canvas>
      @if (mode() === '3d') {
        <div class="row-between">
          <small class="muted">Arrastra sobre el objeto para girarlo bajo la luz.</small>
          <button class="btn quiet small" type="button" (click)="reset3d()">Centrar giro</button>
        </div>
      }
      <label class="material">
        Material
        <select [value]="store.material()" (change)="store.material.set($any($event.target).value)">
          @for (option of materials; track option.id) {
            <option [value]="option.id">{{ option.label }}</option>
          }
        </select>
      </label>
    </section>

    <section class="block">
      <h3>Imprimir a escala real (1:1) para calcar</h3>
      <p class="muted">
        Divide el diseño en hojas A4 o Carta con marcas de unión (+) en las esquinas para armar la
        plantilla y calcarla sobre la madera.
      </p>
      <div class="print-row">
        <label class="material">
          Hoja
          <select [(ngModel)]="paperSize" name="paperSize">
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="LETTER">Carta (216 × 279 mm)</option>
          </select>
        </label>
        <button class="btn small primary" type="button" (click)="downloadPrintableSheets()">
          Descargar hojas para imprimir
        </button>
      </div>
    </section>
  `,
  styles: `
    .block {
      display: grid;
      gap: 0.6rem;
      padding: 1rem;
      border-bottom: 1px solid var(--line);
    }
    .head,
    .row-between,
    .print-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    canvas {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 6px;
      border: 1px solid var(--line);
      touch-action: none;
      cursor: grab;
    }
    canvas:active {
      cursor: grabbing;
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
      padding: 0.25rem 0.55rem;
      font-size: 0.8rem;
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
  readonly mode = signal<Mode>('3d');
  paperSize: PaperSize = 'A4';
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private frame = 0;

  // 3D rotation angles in radians
  private readonly tiltX = signal(0.38);
  private readonly tiltY = signal(-0.28);
  private dragging3d = false;
  private dragStart = { x: 0, y: 0, tx: 0, ty: 0 };

  materialLabel(): string {
    return materialOf(this.store.material()).label;
  }

  constructor() {
    effect(() => {
      this.store.liveDocument();
      this.store.material();
      this.mode();
      this.tiltX();
      this.tiltY();
      if (!this.frame) this.frame = requestAnimationFrame(() => this.render());
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  reset3d(): void {
    this.tiltX.set(0.38);
    this.tiltY.set(-0.28);
  }

  onPointerDown(event: PointerEvent): void {
    if (this.mode() !== '3d') return;
    this.dragging3d = true;
    this.dragStart = {
      x: event.clientX,
      y: event.clientY,
      tx: this.tiltX(),
      ty: this.tiltY(),
    };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging3d) return;
    const dx = (event.clientX - this.dragStart.x) * 0.01;
    const dy = (event.clientY - this.dragStart.y) * 0.01;
    this.tiltY.set(Math.max(-1.1, Math.min(1.1, this.dragStart.ty + dx)));
    this.tiltX.set(Math.max(0.05, Math.min(1.15, this.dragStart.tx + dy)));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging3d) return;
    this.dragging3d = false;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
  }

  downloadPrintableSheets(): void {
    const doc = this.store.document();
    const name = this.store.name() || 'Diseno';
    const { html } = buildTiledPrintHtml(doc, name, this.paperSize);
    download(`${slug(name)}-escala-1a1-${this.paperSize.toLowerCase()}.html`, html, 'text/html');
  }

  private render(): void {
    this.frame = 0;
    const canvas = this.canvas().nativeElement;
    const size = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)) || 300;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const document = this.store.liveDocument();
    const material = materialOf(this.store.material());

    if (this.mode() === '3d') {
      this.render3dObject(ctx, size, document);
      return;
    }

    ctx.fillStyle = ctx.createPattern(materialTexture(material.id, material.color), 'repeat')!;
    ctx.fillRect(0, 0, size, size);

    const tiles = this.mode() === 'repeat' ? 3 : 1;
    const tileSize = (size / tiles) * (tiles === 1 ? 0.86 : 1);
    const scale = tileSize / Math.max(document.width, document.height);
    const tile = window.document.createElement('canvas');
    tile.width = Math.max(1, Math.round(document.width * scale));
    tile.height = Math.max(1, Math.round(document.height * scale));
    const tileCtx = tile.getContext('2d')!;
    if (document.mode === 'barniz') {
      drawBackground(tileCtx, document, scale);
    }
    drawShapes(tileCtx, document, scale);

    if (tiles === 1) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = size / 50;
      ctx.drawImage(tile, (size - tile.width) / 2, (size - tile.height) / 2);
      ctx.restore();
    } else {
      ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
      ctx.fillRect(0, 0, size, size);
    }
  }

  private render3dObject(
    ctx: CanvasRenderingContext2D,
    size: number,
    document: ReturnType<EditorStore['liveDocument']>,
  ): void {
    // Studio background
    const bg = ctx.createRadialGradient(
      size * 0.5,
      size * 0.4,
      size * 0.05,
      size * 0.5,
      size * 0.5,
      size * 0.7,
    );
    bg.addColorStop(0, '#2a211c');
    bg.addColorStop(1, '#120e0c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    const tileScale = (size * 0.76) / Math.max(document.width, document.height);
    const tile = window.document.createElement('canvas');
    tile.width = Math.max(1, Math.round(document.width * tileScale));
    tile.height = Math.max(1, Math.round(document.height * tileScale));
    const tileCtx = tile.getContext('2d')!;
    drawBackground(tileCtx, document, tileScale);
    drawShapes(tileCtx, document, tileScale);

    const rx = this.tiltX();
    const ry = this.tiltY();
    const cosX = Math.max(0.28, Math.cos(rx));
    const sinY = Math.sin(ry);
    const cosY = Math.cos(ry);

    // Cast shadow on the workshop table
    ctx.save();
    ctx.translate(size / 2 + sinY * 18, size * 0.56 + Math.sin(rx) * 28);
    ctx.scale(1, cosX * 0.85);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(tile.width, tile.height) * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();
    ctx.restore();

    // Wooden depth rim (extrusion layers)
    const depthSteps = 10;
    for (let d = depthSteps; d >= 1; d--) {
      ctx.save();
      ctx.translate(size / 2 - sinY * d * 1.4, size / 2 + d * 1.8);
      ctx.scale(1, cosX);
      ctx.rotate(ry * 0.65);
      ctx.globalAlpha = 0.22;
      ctx.drawImage(tile, -tile.width / 2, -tile.height / 2);
      ctx.restore();
    }

    // Top face of the lacquered wooden object
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(1, cosX);
    ctx.rotate(ry * 0.65);
    ctx.drawImage(tile, -tile.width / 2, -tile.height / 2);

    // Dynamic specular reflection from light source (gold leaf + lacquer gloss)
    const lightX = -sinY * tile.width * 0.42;
    const lightY = -Math.sin(rx) * tile.height * 0.35;
    const spec = ctx.createRadialGradient(
      lightX,
      lightY,
      tile.width * 0.04,
      lightX,
      lightY,
      tile.width * 0.65,
    );
    const isGold = document.object?.leaf === 'gold';
    spec.addColorStop(0, isGold ? 'rgba(255, 232, 145, 0.38)' : 'rgba(255, 255, 255, 0.28)');
    spec.addColorStop(0.45, 'rgba(255, 245, 215, 0.06)');
    spec.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = spec;
    ctx.fillRect(-tile.width / 2, -tile.height / 2, tile.width, tile.height);
    ctx.restore();

    void cosY;
  }
}
