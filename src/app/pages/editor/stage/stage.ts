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

import { Shape, buildRadialCopies, clampShape, round } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import {
  Point,
  boundingBox,
  findPathSegment,
  handlePositions,
  hitTest,
  isShapeSelectable,
  localDimensions,
  outline,
  scalePathPoints,
  toLocal,
} from '../../../core/editor/geometry';
import { drawRuler } from '../../../core/editor/rulers';
import { Guides, NO_GUIDES, snapToGuides } from '../../../core/editor/snapping';
import {
  BASE_PX_PER_MM,
  SELECTION_COLOR,
  drawBackground,
  drawGuides,
  drawKnifeDraft,
  drawSelection,
  drawShape,
  drawShapes,
  renderThumbnail,
} from '../../../core/editor/render';

type Gesture =
  | { kind: 'move'; start: Point; shape: Shape; moved: boolean }
  | { kind: 'resize'; shape: Shape; proportional: boolean }
  | { kind: 'rotate'; shape: Shape }
  | { kind: 'node'; shape: Shape; nodeIndex: number }
  | { kind: 'marquee'; start: Point; current: Point }
  | { kind: 'knife-drag'; lastPoint: Point }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 6;
/** Screen pixels: distance of the rotate handle and how close a pointer must be to a handle. */
const HANDLE_OFFSET_PX = 26;
const HANDLE_HIT_PX = 12;
const NODE_HIT_PX = 10;
/** How close (on screen) a center must come to a guide to snap to it. */
const SNAP_PX = 6;

@Component({
  selector: 'app-stage',
  templateUrl: './stage.html',
  styleUrl: './stage.scss',
})
export class Stage {
  readonly store = inject(EditorStore);

  private readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  private readonly sheet = viewChild.required<ElementRef<HTMLDivElement>>('sheet');
  private readonly backgroundLayer =
    viewChild.required<ElementRef<HTMLCanvasElement>>('background');
  private readonly shapesLayer = viewChild.required<ElementRef<HTMLCanvasElement>>('shapes');
  private readonly interactionLayer =
    viewChild.required<ElementRef<HTMLCanvasElement>>('interaction');
  private readonly rulerX = viewChild.required<ElementRef<HTMLCanvasElement>>('rulerX');
  private readonly rulerY = viewChild.required<ElementRef<HTMLCanvasElement>>('rulerY');
  private readonly minimapCanvas = viewChild<ElementRef<HTMLCanvasElement>>('minimap');

  /** Current zoom (CSS transform) and the zoom the canvases are rasterized at. */
  readonly zoom = signal(1);
  private readonly rasterZoom = signal(1);
  private pan = { x: 24, y: 24 };
  private readonly dpr = signal(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  /** Canvas pixels per millimeter. */
  private readonly rasterScale = computed(
    () => BASE_PX_PER_MM * this.dpr() * Math.min(4, Math.max(0.5, this.rasterZoom())),
  );
  private readonly liftedIds = signal<ReadonlySet<string> | null>(null);

  /** Points collected while cutting a new shape with the Bisturí tool. */
  readonly knifePoints = signal<Point[]>([]);
  private knifeCursor: Point | null = null;

  private gesture: Gesture | null = null;
  /** Alignment guides shown while a piece is being moved. */
  private guides: Guides = NO_GUIDES;
  private pendingPointer: PointerEvent | null = null;
  private frame = 0;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private spaceDown = false;
  readonly cursor = signal('default');
  readonly showMinimap = signal(true);

  // Two-finger pinch zoom and pan tracking on touch screens
  private readonly activeTouches = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private pinchStartMid = { x: 0, y: 0 };
  private pinchStartPan = { x: 0, y: 0 };

  readonly sheetWidth = computed(() => this.store.document().width * BASE_PX_PER_MM);
  readonly sheetHeight = computed(() => this.store.document().height * BASE_PX_PER_MM);
  private readonly sheetKey = computed(() => {
    const d = this.store.document();
    const o = d.object;
    return `${d.mode}:${d.width}x${d.height}:${d.background}:${o?.kind}:${o?.baseColor}:${o?.leaf}:${o?.width}x${o?.height}`;
  });
  readonly hint = computed(() => {
    const tool = this.store.tool();
    if (tool === 'path') {
      return 'Bisturí: clic para agregar puntos, arrastra para curva suave, doble clic o clic en el primer punto para cerrar el corte.';
    }
    if (tool) {
      return 'Haz clic en la mesa para colocar la pieza. Shift mantiene la herramienta activa.';
    }
    if (this.store.selected()?.kind === 'path') {
      return 'Corte elegido: arrastra los nodos blancos para ajustar, doble clic en un borde para insertar nodo, Supr para borrarlo.';
    }
    return 'Arrastra para mover. Shift+clic o arrastra en vacío para elegir varias. Rueda para desplazarte, Ctrl+rueda para acercar.';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Clear Bisturí draft when switching tools
    effect(() => {
      if (this.store.tool() !== 'path') {
        untracked(() => {
          this.knifePoints.set([]);
          this.knifeCursor = null;
        });
      }
    });

    // Background layer: only when the sheet's size, object or color, or the raster scale, change.
    effect(() => {
      this.sheetKey();
      const scale = this.rasterScale();
      const canvas = this.backgroundLayer().nativeElement;
      untracked(() => {
        this.resize(canvas, scale);
        drawBackground(canvas.getContext('2d')!, this.store.document(), scale);
        this.drawRulers();
      });
    });

    // Shapes layer: when the document changes, or pieces are lifted for dragging.
    effect(() => {
      const document = this.store.document();
      const scale = this.rasterScale();
      const lifted = this.liftedIds();
      const layerLimit = this.store.animatedLayerLimit();
      const canvas = this.shapesLayer().nativeElement;
      this.resize(canvas, scale);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawShapes(ctx, document, scale, lifted, layerLimit);
      untracked(() => this.drawMinimap());
    });

    // Interaction layer outside gestures: selection changes, undo, inspector edits.
    effect(() => {
      this.store.selected();
      this.store.extraSelectedIds();
      this.store.selectedNodeIndex();
      this.knifePoints();
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
      let lastWidth = viewport.clientWidth;
      const resizeObserver = new ResizeObserver(() => {
        if (Math.abs(viewport.clientWidth - lastWidth) > 40) this.fit();
        else this.drawRulers();
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

  zoomToSelection(): void {
    const selected = this.store.selectedShapes();
    if (selected.length === 0) {
      this.fit();
      return;
    }
    const boxes = selected.map((s) => boundingBox(s));
    const minX = Math.min(...boxes.map((b) => b.minX));
    const maxX = Math.max(...boxes.map((b) => b.maxX));
    const minY = Math.min(...boxes.map((b) => b.minY));
    const maxY = Math.max(...boxes.map((b) => b.maxY));
    const boxW = Math.max(40, (maxX - minX) * BASE_PX_PER_MM);
    const boxH = Math.max(40, (maxY - minY) * BASE_PX_PER_MM);
    const viewport = this.viewport().nativeElement;
    const margin = 64;
    const zoom = clampZoom(
      Math.min(
        (viewport.clientWidth - margin * 2) / boxW,
        (viewport.clientHeight - margin * 2) / boxH,
      ),
    );
    const cx = ((minX + maxX) / 2) * BASE_PX_PER_MM;
    const cy = ((minY + maxY) / 2) * BASE_PX_PER_MM;
    this.setZoom(zoom);
    this.pan = {
      x: viewport.clientWidth / 2 - cx * zoom,
      y: viewport.clientHeight / 2 - cy * zoom,
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
    this.drawRulers();
    this.drawMinimap();
  }

  private drawRulers(): void {
    const pixelsPerMm = BASE_PX_PER_MM * this.zoom();
    const document = this.store.document();
    drawRuler(this.rulerX().nativeElement, 'x', this.pan.x, pixelsPerMm, document.width);
    drawRuler(this.rulerY().nativeElement, 'y', this.pan.y, pixelsPerMm, document.height);
  }

  private drawMinimap(): void {
    const mini = this.minimapCanvas()?.nativeElement;
    if (!mini) return;
    renderThumbnail(mini, this.store.document());
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

  // ---------- Pointer & Touch gestures ----------

  onDoubleClick(event: MouseEvent): void {
    const point = this.toMillimeters(event);
    if (this.store.tool() === 'path') {
      this.finishKnifePath();
      return;
    }
    const selected = this.store.selected();
    if (selected && selected.kind === 'path') {
      const hitSeg = findPathSegment(selected, point, this.screenToMm(10));
      if (hitSeg) {
        this.store.insertPathNode(hitSeg.insertIndex, hitSeg.localPoint);
      }
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button === 2) return;
    this.viewport().nativeElement.focus({ preventScroll: true });

    if (event.pointerType === 'touch') {
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.activeTouches.size === 2) {
        const pts = [...this.activeTouches.values()];
        this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
        this.pinchStartZoom = this.zoom();
        const rect = this.viewport().nativeElement.getBoundingClientRect();
        this.pinchStartMid = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top,
        };
        this.pinchStartPan = { ...this.pan };
        this.gesture = null;
        return;
      }
    }

    const point = this.toMillimeters(event);

    if (event.button === 1 || this.spaceDown) return this.startPan(event);

    const tool = this.store.tool();
    if (tool === 'path') {
      this.onKnifePointerDown(point, event);
      return;
    }
    if (tool) {
      this.store.addShape(tool, point[0], point[1]);
      if (!event.shiftKey) this.store.tool.set(null);
      return;
    }

    const selected = this.store.selected();
    if (selected && selected.kind === 'path') {
      const nodeIdx = this.nodeAt(selected, point);
      if (nodeIdx !== null) {
        this.store.selectedNodeIndex.set(nodeIdx);
        this.gesture = { kind: 'node', shape: selected, nodeIndex: nodeIdx };
        this.lift(selected, event);
        return;
      }
    }

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
      if (event.shiftKey) {
        this.gesture = { kind: 'marquee', start: point, current: point };
        (event.target as Element).setPointerCapture?.(event.pointerId);
        return;
      }
      this.store.selectOne(null);
      return this.startPan(event);
    }

    if (event.shiftKey) {
      this.store.toggleSelection(hit.id);
      return;
    }

    this.store.selectOne(hit.id);
    this.gesture = { kind: 'move', start: point, shape: hit, moved: false };
    this.lift(hit, event);
  }

  private onKnifePointerDown(point: Point, event: PointerEvent): void {
    const current = this.knifePoints();
    if (current.length >= 3) {
      const [fx, fy] = current[0];
      if (Math.hypot(point[0] - fx, point[1] - fy) <= this.screenToMm(12)) {
        this.finishKnifePath();
        return;
      }
    }
    const snapped: Point = [round(point[0]), round(point[1])];
    this.knifePoints.set([...current, snapped]);
    this.knifeCursor = snapped;
    this.gesture = { kind: 'knife-drag', lastPoint: snapped };
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.drawInteraction(null, false);
  }

  finishKnifePath(): void {
    const pts = this.knifePoints();
    this.knifePoints.set([]);
    this.knifeCursor = null;
    this.gesture = null;
    if (pts.length >= 3) {
      this.store.addPath(pts);
      this.store.tool.set(null);
    }
    this.drawInteraction(this.store.selected(), false);
  }

  onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch' && this.activeTouches.has(event.pointerId)) {
      this.activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.activeTouches.size === 2) {
        const pts = [...this.activeTouches.values()];
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
        const rect = this.viewport().nativeElement.getBoundingClientRect();
        const mid = {
          x: (pts[0].x + pts[1].x) / 2 - rect.left,
          y: (pts[0].y + pts[1].y) / 2 - rect.top,
        };
        const nextZoom = clampZoom(this.pinchStartZoom * (dist / this.pinchStartDist));
        this.pan = {
          x:
            mid.x -
            ((this.pinchStartMid.x - this.pinchStartPan.x) * nextZoom) / this.pinchStartZoom,
          y:
            mid.y -
            ((this.pinchStartMid.y - this.pinchStartPan.y) * nextZoom) / this.pinchStartZoom,
        };
        this.setZoom(nextZoom);
        this.applyTransform();
        return;
      }
    }
    this.pendingPointer = event;
    if (!this.frame) this.frame = requestAnimationFrame(() => this.onFrame());
  }

  onPointerUp(event: PointerEvent): void {
    this.activeTouches.delete(event.pointerId);
    const gesture = this.gesture;
    this.gesture = null;
    this.pendingPointer = null;
    if (!gesture) return;
    (event.target as Element).releasePointerCapture?.(event.pointerId);
    if (gesture.kind === 'pan' || gesture.kind === 'knife-drag') {
      this.cursor.set(this.spaceDown ? 'grab' : 'default');
      return;
    }
    if (gesture.kind === 'marquee') {
      const minX = Math.min(gesture.start[0], gesture.current[0]);
      const maxX = Math.max(gesture.start[0], gesture.current[0]);
      const minY = Math.min(gesture.start[1], gesture.current[1]);
      const maxY = Math.max(gesture.start[1], gesture.current[1]);
      const doc = this.store.document();
      const hits = doc.shapes
        .filter(
          (s) =>
            isShapeSelectable(doc, s) && s.x >= minX && s.x <= maxX && s.y >= minY && s.y <= maxY,
        )
        .map((s) => s.id);
      this.store.selectMany(hits);
      this.drawInteraction(this.store.selected(), false);
      return;
    }
    this.guides = NO_GUIDES;
    this.store.commitDraft();
    this.liftedIds.set(null);
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
    const ids = new Set<string>([shape.id]);
    const radial = this.store.radialGroupOf(shape);
    if (radial && radial.sourceId === shape.id) {
      for (const s of this.store.document().shapes) {
        if (s.groupId === radial.id) ids.add(s.id);
      }
    }
    this.liftedIds.set(ids);
  }

  private onFrame(): void {
    this.frame = 0;
    const event = this.pendingPointer;
    if (!event) return;
    const gesture = this.gesture;
    if (!gesture) {
      if (this.store.tool() === 'path' && this.knifePoints().length > 0) {
        this.knifeCursor = this.toMillimeters(event);
        this.drawInteraction(null, false);
      }
      return this.updateHoverCursor(event);
    }

    if (gesture.kind === 'pan') {
      this.pan = {
        x: gesture.panX + event.clientX - gesture.startX,
        y: gesture.panY + event.clientY - gesture.startY,
      };
      this.applyTransform();
      return;
    }

    const point = this.toMillimeters(event);
    if (gesture.kind === 'knife-drag') {
      this.knifeCursor = point;
      const dist = Math.hypot(point[0] - gesture.lastPoint[0], point[1] - gesture.lastPoint[1]);
      if (dist >= Math.max(4, this.screenToMm(10))) {
        const snapped: Point = [round(point[0]), round(point[1])];
        gesture.lastPoint = snapped;
        this.knifePoints.update((pts) => [...pts, snapped]);
      }
      this.drawInteraction(null, false);
      return;
    }

    if (gesture.kind === 'marquee') {
      gesture.current = point;
      this.drawInteraction(null, false, gesture);
      return;
    }

    const draft = clampShape(this.transform(gesture, point, event));
    this.store.draft.set(draft);
    this.drawInteraction(draft, true);
  }

  private transform(
    gesture: Exclude<Gesture, { kind: 'pan' | 'marquee' | 'knife-drag' }>,
    point: Point,
    event: PointerEvent,
  ): Shape {
    const shape = gesture.shape;
    switch (gesture.kind) {
      case 'move': {
        const dx = point[0] - gesture.start[0];
        const dy = point[1] - gesture.start[1];
        gesture.moved ||= Math.hypot(dx, dy) > 0.5;
        const snap = (value: number) => (event.altKey ? round(value, 1) : Math.round(value));
        const moved = { ...shape, x: snap(shape.x + dx), y: snap(shape.y + dy) };
        if (event.altKey) {
          this.guides = NO_GUIDES;
          return moved;
        }
        const snapped = snapToGuides(moved, this.store.document(), this.screenToMm(SNAP_PX));
        this.guides = snapped.guides;
        return { ...moved, x: snapped.x, y: snapped.y };
      }
      case 'resize': {
        const [lx, ly] = toLocal(shape, point);
        const dims = localDimensions(shape);
        let width = Math.max(4, Math.abs(lx) * 2);
        let height = Math.max(4, Math.abs(ly) * 2);
        if (gesture.proportional || event.shiftKey) {
          const factor = Math.max(
            width / Math.max(1, dims.width),
            height / Math.max(1, dims.height),
          );
          width = dims.width * factor;
          height = dims.height * factor;
        }
        if (shape.kind === 'path') {
          return { ...shape, points: scalePathPoints(shape, width, height) };
        }
        return { ...shape, width: Math.round(width), height: Math.round(height) };
      }
      case 'rotate': {
        const angle = (Math.atan2(point[1] - shape.y, point[0] - shape.x) * 180) / Math.PI + 90;
        const step = event.shiftKey ? 15 : 1;
        return { ...shape, rotation: Math.round(angle / step) * step };
      }
      case 'node': {
        const [lx, ly] = toLocal(shape, point);
        const pts = (shape.points ?? []).map((pt, idx) =>
          idx === gesture.nodeIndex ? ([round(lx), round(ly)] as const) : pt,
        );
        return { ...shape, points: pts };
      }
    }
  }

  private updateHoverCursor(event: PointerEvent): void {
    if (this.spaceDown) return this.cursor.set('grab');
    if (this.store.tool()) return this.cursor.set('crosshair');
    const point = this.toMillimeters(event);
    const selected = this.store.selected();
    if (selected && selected.kind === 'path' && this.nodeAt(selected, point) !== null) {
      return this.cursor.set('pointer');
    }
    const handle = selected ? this.handleAt(selected, point) : null;
    if (handle === 'resize') return this.cursor.set('nwse-resize');
    if (handle === 'rotate') return this.cursor.set('alias');
    this.cursor.set(hitTest(this.store.document(), point) ? 'move' : 'default');
  }

  // ---------- Drawing helpers ----------

  private drawInteraction(
    shape: Shape | null,
    includeShape: boolean,
    marquee?: { start: Point; current: Point },
  ): void {
    const canvas = this.interactionLayer().nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = this.rasterScale();
    const pixel = this.canvasPixelsPerScreenPixel();
    const doc = this.store.document();
    const isBarniz = doc.mode === 'barniz';
    const leaf = doc.object?.leaf ?? 'none';

    if (this.knifePoints().length > 0) {
      drawKnifeDraft(ctx, this.knifePoints(), this.knifeCursor, scale, pixel);
    }

    if (marquee) {
      const x = Math.min(marquee.start[0], marquee.current[0]) * scale;
      const y = Math.min(marquee.start[1], marquee.current[1]) * scale;
      const w = Math.abs(marquee.current[0] - marquee.start[0]) * scale;
      const h = Math.abs(marquee.current[1] - marquee.start[1]) * scale;
      ctx.save();
      ctx.fillStyle = 'rgba(240, 194, 59, 0.14)';
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 * pixel;
      ctx.setLineDash([4 * pixel, 3 * pixel]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    if (!shape) return;
    if (includeShape) {
      drawGuides(ctx, this.guides, doc, scale, pixel);
      drawShape(ctx, shape, scale, isBarniz, leaf);
      // Also render live radial copies while dragging the source
      const radial = this.store.radialGroupOf(shape);
      if (radial && radial.sourceId === shape.id) {
        const copies = buildRadialCopies(shape, radial, doc.width / 2, doc.height / 2);
        for (const copy of copies) {
          drawShape(ctx, copy, scale, isBarniz, leaf);
        }
      }
    }

    drawSelection(
      ctx,
      shape,
      scale,
      pixel,
      this.screenToMm(HANDLE_OFFSET_PX),
      shape.kind === 'path',
      this.store.selectedNodeIndex(),
    );

    // Draw subtle selection outlines for any extra multi-selected shapes
    const extraIds = this.store.extraSelectedIds();
    if (extraIds.length > 0) {
      for (const extra of doc.shapes) {
        if (extraIds.includes(extra.id)) {
          drawSelection(ctx, extra, scale, pixel, this.screenToMm(HANDLE_OFFSET_PX));
        }
      }
    }
  }

  private nodeAt(shape: Shape, point: Point): number | null {
    if (shape.kind !== 'path' || !shape.points) return null;
    const radius = this.screenToMm(NODE_HIT_PX);
    const docPts = outline(shape);
    for (let i = 0; i < docPts.length; i++) {
      const [nx, ny] = docPts[i];
      if (Math.hypot(point[0] - nx, point[1] - ny) <= radius) return i;
    }
    return null;
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

  private toMillimeters(event: { clientX: number; clientY: number }): Point {
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
