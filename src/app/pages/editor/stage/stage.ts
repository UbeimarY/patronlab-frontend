import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { Shape, clampShape, round } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { Point, handlePositions, hitTest, toLocal } from '../../../core/editor/geometry';
import {
  BASE_PX_PER_MM,
  drawBackground,
  drawSelection,
  drawShape,
  drawShapes,
} from '../../../core/editor/render';

type Gesture =
  | { kind: 'move'; start: Point; shape: Shape; moved: boolean }
  | { kind: 'resize'; shape: Shape; proportional: boolean }
  | { kind: 'rotate'; shape: Shape }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 6;
/** Screen pixels: distance of the rotate handle and how close a pointer must be to a handle. */
const HANDLE_OFFSET_PX = 26;
const HANDLE_HIT_PX = 12;

/**
 * The cutting mat. Three stacked canvases, each redrawn only when what it shows changes:
 *
 *  background   material color and millimeter grid: on resize or zoom settle
 *  shapes       every piece: when the document changes
 *  interaction  selection, handles and the piece being dragged: every frame of a gesture
 *
 * While dragging, the moving piece is lifted out of the shapes layer once, and only
 * the small interaction layer is repainted, at most once per animation frame.
 * Pan and zoom move the whole sheet with a CSS transform, which the browser's
 * compositor applies without repainting; the canvases are re-rasterized at the new
 * resolution only after zooming stops, so text and edges stay sharp.
 */
@Component({
  selector: 'app-stage',
  templateUrl: './stage.html',
  styleUrl: './stage.scss',
})
export class Stage {
  private readonly store = inject(EditorStore);

  private readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  private readonly sheet = viewChild.required<ElementRef<HTMLDivElement>>('sheet');
  private readonly backgroundLayer =
    viewChild.required<ElementRef<HTMLCanvasElement>>('background');
  private readonly shapesLayer = viewChild.required<ElementRef<HTMLCanvasElement>>('shapes');
  private readonly interactionLayer =
    viewChild.required<ElementRef<HTMLCanvasElement>>('interaction');

  /** Current zoom (CSS transform) and the zoom the canvases are rasterized at. */
  readonly zoom = signal(1);
  private readonly rasterZoom = signal(1);
  private pan = { x: 24, y: 24 };
  private readonly dpr = signal(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  /** Canvas pixels per millimeter. */
  private readonly rasterScale = computed(
    () => BASE_PX_PER_MM * this.dpr() * Math.min(4, Math.max(0.5, this.rasterZoom())),
  );
  private readonly liftedId = signal<string | null>(null);

  private gesture: Gesture | null = null;
  private pendingPointer: PointerEvent | null = null;
  private frame = 0;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private spaceDown = false;
  readonly cursor = signal('default');

  readonly sheetWidth = computed(() => this.store.document().width * BASE_PX_PER_MM);
  readonly sheetHeight = computed(() => this.store.document().height * BASE_PX_PER_MM);
  private readonly sheetKey = computed(() => {
    const d = this.store.document();
    return `${d.width}x${d.height}:${d.background}`;
  });
  readonly hint = computed(() =>
    this.store.tool()
      ? 'Haz clic en la mesa para colocar la pieza. Esc para cancelar.'
      : 'Arrastra para mover. Rueda para desplazarte, Ctrl + rueda para acercar.',
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Background layer: only when the sheet's size or color, or the raster scale, change.
    effect(() => {
      this.sheetKey();
      const scale = this.rasterScale();
      const canvas = this.backgroundLayer().nativeElement;
      untracked(() => {
        this.resize(canvas, scale);
        drawBackground(canvas.getContext('2d')!, this.store.document(), scale);
      });
    });

    // Shapes layer: when the document changes, or a piece is lifted for dragging.
    effect(() => {
      const document = this.store.document();
      const scale = this.rasterScale();
      const lifted = this.liftedId();
      const canvas = this.shapesLayer().nativeElement;
      this.resize(canvas, scale);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawShapes(ctx, document, scale, lifted);
    });

    // Interaction layer outside gestures: selection changes, undo, inspector edits.
    effect(() => {
      this.store.selected();
      this.rasterScale();
      this.zoom();
      this.store.document();
      untracked(() => {
        this.resize(this.interactionLayer().nativeElement, this.rasterScale());
        if (!this.gesture) this.drawInteraction(this.store.selected(), false);
      });
    });

    afterNextRender(() => {
      const viewport = this.viewport().nativeElement;
      // Wheel must be non-passive to stop the page from scrolling while zooming.
      const onWheel = (event: WheelEvent) => this.onWheel(event);
      viewport.addEventListener('wheel', onWheel, { passive: false });
      const onKey = (event: KeyboardEvent) => {
        if (event.code === 'Space' && !isTyping(event)) {
          this.spaceDown = event.type === 'keydown';
          if (this.spaceDown) event.preventDefault();
          this.cursor.set(this.spaceDown ? 'grab' : 'default');
        }
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      const media = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onDpr = () => this.dpr.set(window.devicePixelRatio || 1);
      media.addEventListener('change', onDpr);
      this.fit();
      // The panel layout changes with the window: keep the whole sheet in view.
      let lastWidth = viewport.clientWidth;
      const resizeObserver = new ResizeObserver(() => {
        if (Math.abs(viewport.clientWidth - lastWidth) > 40) this.fit();
        lastWidth = viewport.clientWidth;
      });
      resizeObserver.observe(viewport);
      destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        viewport.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        media.removeEventListener('change', onDpr);
        cancelAnimationFrame(this.frame);
        clearTimeout(this.settleTimer);
      });
    });
  }

  // ---------- View: pan and zoom (compositor only) ----------

  fit(): void {
    const viewport = this.viewport().nativeElement;
    const margin = 40;
    const zoom = Math.min(
      (viewport.clientWidth - margin * 2) / this.sheetWidth(),
      (viewport.clientHeight - margin * 2) / this.sheetHeight(),
    );
    this.setZoom(clampZoom(zoom));
    this.pan = {
      x: (viewport.clientWidth - this.sheetWidth() * this.zoom()) / 2,
      y: (viewport.clientHeight - this.sheetHeight() * this.zoom()) / 2,
    };
    this.applyTransform();
  }

  zoomBy(factor: number, origin?: { x: number; y: number }): void {
    const viewport = this.viewport().nativeElement;
    const point = origin ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    const before = this.zoom();
    const after = clampZoom(before * factor);
    this.pan = {
      x: point.x - ((point.x - this.pan.x) * after) / before,
      y: point.y - ((point.y - this.pan.y) * after) / before,
    };
    this.setZoom(after);
    this.applyTransform();
  }

  private setZoom(zoom: number): void {
    this.zoom.set(zoom);
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.rasterZoom.set(zoom), 180);
  }

  private applyTransform(): void {
    this.sheet().nativeElement.style.transform = `translate3d(${this.pan.x}px, ${this.pan.y}px, 0) scale(${this.zoom()})`;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const rect = this.viewport().nativeElement.getBoundingClientRect();
      this.zoomBy(Math.exp(-event.deltaY * 0.0025), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    } else {
      this.pan = { x: this.pan.x - event.deltaX, y: this.pan.y - event.deltaY };
      this.applyTransform();
    }
  }

  // ---------- Pointer gestures ----------

  onPointerDown(event: PointerEvent): void {
    if (event.button === 2) return;
    this.viewport().nativeElement.focus({ preventScroll: true });
    const point = this.toMillimeters(event);

    if (event.button === 1 || this.spaceDown) return this.startPan(event);

    const tool = this.store.tool();
    if (tool) {
      this.store.addShape(tool, point[0], point[1]);
      if (!event.shiftKey) this.store.tool.set(null); // Shift keeps placing pieces
      return;
    }

    const selected = this.store.selected();
    const handle = selected ? this.handleAt(selected, point) : null;
    if (selected && handle) {
      this.gesture =
        handle === 'resize'
          ? { kind: 'resize', shape: selected, proportional: event.shiftKey }
          : { kind: 'rotate', shape: selected };
      this.lift(selected, event);
      return;
    }

    const hit = hitTest(this.store.document(), point);
    if (!hit) {
      this.store.selectedId.set(null);
      return this.startPan(event);
    }
    this.store.selectedId.set(hit.id);
    this.gesture = { kind: 'move', start: point, shape: hit, moved: false };
    this.lift(hit, event);
  }

  onPointerMove(event: PointerEvent): void {
    // Pointer events can arrive faster than the screen refreshes: keep only the
    // latest one and do the work once per frame.
    this.pendingPointer = event;
    if (!this.frame) this.frame = requestAnimationFrame(() => this.onFrame());
  }

  onPointerUp(event: PointerEvent): void {
    const gesture = this.gesture;
    this.gesture = null;
    this.pendingPointer = null;
    if (!gesture) return;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    if (gesture.kind === 'pan') {
      this.cursor.set(this.spaceDown ? 'grab' : 'default');
      return;
    }
    this.store.commitDraft();
    this.liftedId.set(null);
    this.drawInteraction(this.store.selected(), false);
  }

  private startPan(event: PointerEvent): void {
    this.gesture = {
      kind: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      panX: this.pan.x,
      panY: this.pan.y,
    };
    this.cursor.set('grabbing');
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  private lift(shape: Shape, event: PointerEvent): void {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.store.draft.set(shape);
    this.liftedId.set(shape.id); // the shapes layer redraws once, without this piece
  }

  private onFrame(): void {
    this.frame = 0;
    const event = this.pendingPointer;
    if (!event) return;
    const gesture = this.gesture;
    if (!gesture) return this.updateHoverCursor(event);

    if (gesture.kind === 'pan') {
      this.pan = {
        x: gesture.panX + event.clientX - gesture.startX,
        y: gesture.panY + event.clientY - gesture.startY,
      };
      this.applyTransform();
      return;
    }

    const point = this.toMillimeters(event);
    const draft = clampShape(this.transform(gesture, point, event));
    this.store.draft.set(draft);
    this.drawInteraction(draft, true);
  }

  private transform(
    gesture: Exclude<Gesture, { kind: 'pan' }>,
    point: Point,
    event: PointerEvent,
  ): Shape {
    const shape = gesture.shape;
    switch (gesture.kind) {
      case 'move': {
        const dx = point[0] - gesture.start[0];
        const dy = point[1] - gesture.start[1];
        gesture.moved ||= Math.hypot(dx, dy) > 0.5;
        // Snap to whole millimeters; Alt moves freely.
        const snap = (value: number) => (event.altKey ? round(value, 1) : Math.round(value));
        return { ...shape, x: snap(shape.x + dx), y: snap(shape.y + dy) };
      }
      case 'resize': {
        const [lx, ly] = toLocal(shape, point);
        let width = Math.max(4, Math.abs(lx) * 2);
        let height = Math.max(4, Math.abs(ly) * 2);
        if (gesture.proportional || event.shiftKey) {
          const factor = Math.max(width / shape.width, height / shape.height);
          width = shape.width * factor;
          height = shape.height * factor;
        }
        return { ...shape, width: Math.round(width), height: Math.round(height) };
      }
      case 'rotate': {
        const angle = (Math.atan2(point[1] - shape.y, point[0] - shape.x) * 180) / Math.PI + 90;
        // Shift snaps to 15 degrees, like most design tools.
        const step = event.shiftKey ? 15 : 1;
        return { ...shape, rotation: Math.round(angle / step) * step };
      }
    }
  }

  private updateHoverCursor(event: PointerEvent): void {
    if (this.spaceDown) return this.cursor.set('grab');
    if (this.store.tool()) return this.cursor.set('crosshair');
    const point = this.toMillimeters(event);
    const selected = this.store.selected();
    const handle = selected ? this.handleAt(selected, point) : null;
    if (handle === 'resize') return this.cursor.set('nwse-resize');
    if (handle === 'rotate') return this.cursor.set('alias');
    this.cursor.set(hitTest(this.store.document(), point) ? 'move' : 'default');
  }

  // ---------- Drawing helpers ----------

  private drawInteraction(shape: Shape | null, includeShape: boolean): void {
    const canvas = this.interactionLayer().nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!shape) return;
    const scale = this.rasterScale();
    if (includeShape) drawShape(ctx, shape, scale);
    drawSelection(
      ctx,
      shape,
      scale,
      this.canvasPixelsPerScreenPixel(),
      this.screenToMm(HANDLE_OFFSET_PX),
    );
  }

  private handleAt(shape: Shape, point: Point): 'resize' | 'rotate' | null {
    const handles = handlePositions(shape, this.screenToMm(HANDLE_OFFSET_PX));
    const radius = this.screenToMm(HANDLE_HIT_PX);
    for (const name of ['rotate', 'resize'] as const) {
      const [hx, hy] = handles[name];
      if (Math.hypot(point[0] - hx, point[1] - hy) <= radius) return name;
    }
    return null;
  }

  private toMillimeters(event: PointerEvent): Point {
    const rect = this.interactionLayer().nativeElement.getBoundingClientRect();
    const document = this.store.document();
    return [
      ((event.clientX - rect.left) / rect.width) * document.width,
      ((event.clientY - rect.top) / rect.height) * document.height,
    ];
  }

  private screenToMm(pixels: number): number {
    return pixels / (BASE_PX_PER_MM * this.zoom());
  }

  private canvasPixelsPerScreenPixel(): number {
    return this.rasterScale() / (BASE_PX_PER_MM * this.zoom());
  }

  private resize(canvas: HTMLCanvasElement, scale: number): void {
    const document = this.store.document();
    const width = Math.round(document.width * scale);
    const height = Math.round(document.height * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    !!target &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  );
}
