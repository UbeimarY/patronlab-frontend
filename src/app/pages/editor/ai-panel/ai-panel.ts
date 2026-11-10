import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiError, describeError } from '../../../core/api/graphql';
import {
  ColorAnalysis,
  EvolvedGeneration,
  EvolvedVariations,
  LayerLayout,
  Layout,
  LayoutMethod,
  ParetoPoint,
  ParetoVariationsResult,
  PatronlabApi,
  Score,
  VectorizeResult,
} from '../../../core/api/patronlab-api';
import {
  computeLayerLayouts,
  fallbackAnalyzeColors,
  fallbackEvolve,
  fallbackPareto,
  fallbackVectorize,
} from '../../../core/editor/barniz-ai';
import { cutPlanSvg, drawCutPlan } from '../../../core/editor/cut-plan';
import { ComposedDesign, designFromText } from '../../../core/editor/design-composer';
import {
  ANILINE_COLORS,
  BarnizLayer,
  PatternDocument,
  materialOf,
} from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { download, slug, toLayerSvg } from '../../../core/editor/svg-export';
import { mm, percent } from '../../../core/format';
import { Thumbnail } from '../../../shared/thumbnail';
import { shrinkImage } from './image';

@Component({
  selector: 'app-ai-panel',
  imports: [FormsModule, Thumbnail],
  templateUrl: './ai-panel.html',
  styleUrl: './ai-panel.scss',
})
export class AiPanel {
  private readonly api = inject(PatronlabApi);
  readonly store = inject(EditorStore);
  readonly mm = mm;
  readonly percent = percent;
  readonly isBarniz = computed(() => this.store.document().mode === 'barniz');

  // 0. Draw a design from a phrase (local parser + composer, no external service)
  designText = '';
  private designSeed = 0;
  readonly design = signal<ComposedDesign | null>(null);
  readonly designMissed = signal(false);
  readonly designExamples = [
    {
      label: 'Colibrí y flores',
      text: 'Un plato con un colibrí azul al centro y ocho flores rojas alrededor, con puntos dorados en el borde',
    },
    {
      label: 'Páramo en bandeja',
      text: 'Una bandeja de 40 x 25 cm con tres frailejones, un sol arriba y una greca roja en el borde',
    },
    {
      label: 'Cuenco del sol',
      text: 'Un cuenco con un sol al centro rodeado de doce estrellas amarillas y hojas verdes',
    },
  ];

  // 1. Sketch to mopa-mopa layers (vectorizeImage)
  vecColors = 4;
  vecDetail = 0.5;
  vecMinArea = 20;
  readonly sketchImage = signal<string | null>(null);
  readonly vectorizeBusy = signal(false);
  readonly vectorizeError = signal<string | null>(null);
  readonly vectorizeResult = signal<VectorizeResult | null>(null);
  private vectorizeAbort: AbortController | null = null;
  private animTimers: ReturnType<typeof setTimeout>[] = [];

  readonly vectorizePreviewDoc = computed<PatternDocument | null>(() => {
    const res = this.vectorizeResult();
    if (!res) return null;
    const base = this.store.document();
    const layers: BarnizLayer[] = res.layers.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      visible: true,
      locked: false,
    }));
    return {
      ...base,
      mode: 'barniz',
      layers,
      groups: [],
      shapes: res.shapes,
    };
  });

  // 2. Palette from photo
  colors = 5;
  readonly photo = signal<string | null>(null);
  readonly paletteBusy = signal(false);
  readonly paletteError = signal<string | null>(null);

  // 3. Interactive Evolution (evolveVariations) & Pareto Front
  private seed = 0;
  weightBalance = 0.7;
  weightOverlap = 0.6;
  weightContrast = 0.7;
  weightCoverage = 0.5;
  readonly evolved = signal<EvolvedVariations | null>(null);
  readonly variationsFor = signal<PatternDocument | null>(null);
  readonly variationsBusy = signal(false);
  readonly variationsError = signal<string | null>(null);
  readonly favoriteIndices = signal<number[]>([]);
  readonly allHistory = signal<EvolvedGeneration[]>([]);
  private evolveAbort: AbortController | null = null;

  readonly pareto = signal<ParetoVariationsResult | null>(null);
  readonly paretoBusy = signal(false);
  readonly hoveredPareto = signal<ParetoPoint | null>(null);

  readonly criteria: { key: keyof Omit<Score, 'total'>; label: string }[] = [
    { key: 'balance', label: 'Equilibrio' },
    { key: 'overlap', label: 'Sin encimar' },
    { key: 'contrast', label: 'Contraste' },
    { key: 'coverage', label: 'Cobertura' },
  ];

  // 4. Cutting plan & per-layer mopa-mopa sheet plan
  rollWidth = materialOf(this.store.material()).rollWidth;
  spacing = 3;
  sheetWidth = 300;
  sheetHeight = 300;
  layoutMethod: LayoutMethod = 'SKYLINE';
  readonly layout = signal<Layout | null>(null);
  readonly layoutFor = signal<{ document: PatternDocument; rollWidth: number } | null>(null);
  readonly layoutBusy = signal(false);
  readonly layoutError = signal<string | null>(null);
  private layoutAbort: AbortController | null = null;

  readonly layerLayouts = computed<LayerLayout[]>(() => {
    const plan = this.layout();
    if (plan?.layers && plan.layers.length > 0) return plan.layers;
    return computeLayerLayouts(
      this.store.document(),
      Math.max(50, Number(this.sheetWidth) || 300),
      Math.max(50, Number(this.sheetHeight) || 300),
      Math.max(0, Number(this.spacing) || 3),
    );
  });

  readonly outdated = computed(() => {
    const result = this.layoutFor();
    return !!result && result.document !== this.store.document();
  });
  private readonly planCanvas = viewChild<ElementRef<HTMLCanvasElement>>('plan');

  // 5. Color analysis (ΔE, names, harmonies)
  readonly colorAnalysis = signal<ColorAnalysis | null>(null);
  readonly colorBusy = signal(false);
  readonly colorError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const canvas = this.planCanvas()?.nativeElement;
      const layout = this.layout();
      const target = this.layoutFor();
      if (!canvas || !layout || !target) return;
      canvas.width = 640;
      drawCutPlan(
        canvas,
        target.document,
        layout,
        target.rollWidth,
        materialOf(this.store.material()).color,
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancelOperations();
      this.clearAnimationTimers();
    });
  }

  cancelOperations(): void {
    this.vectorizeAbort?.abort();
    this.evolveAbort?.abort();
    this.layoutAbort?.abort();
  }

  private clearAnimationTimers(): void {
    for (const t of this.animTimers) clearTimeout(t);
    this.animTimers = [];
    this.store.animatedLayerLimit.set(undefined);
  }

  // ---------- 1. De boceto a láminas ----------

  async onSketchFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.vectorizeError.set('Elige un archivo de imagen (JPG, PNG o WebP).');
      return;
    }
    this.vectorizeError.set(null);
    try {
      const shrunk = await shrinkImage(file, 1600);
      this.sketchImage.set(shrunk);
      await this.runVectorize();
    } catch (error) {
      this.vectorizeError.set(
        error instanceof DOMException ? 'No se pudo leer esa imagen.' : describeError(error),
      );
    }
  }

  async runVectorize(): Promise<void> {
    const image = this.sketchImage();
    if (!image || this.vectorizeBusy()) return;
    this.vectorizeBusy.set(true);
    this.vectorizeError.set(null);
    this.vectorizeAbort = new AbortController();
    const doc = this.store.document();
    try {
      let res: VectorizeResult;
      try {
        res = await this.api.vectorizeImage(
          {
            image,
            width: doc.width,
            height: doc.height,
            colors: Number(this.vecColors),
            detail: Number(this.vecDetail),
            minArea: Number(this.vecMinArea),
          },
          { signal: this.vectorizeAbort.signal },
        );
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ABORTED') throw err;
        if (
          err instanceof ApiError &&
          (err.code === 'RATE_LIMITED' ||
            err.code === 'IMAGE_TOO_COMPLEX' ||
            err.code === 'TOO_MANY_POINTS')
        ) {
          throw err;
        }
        res = fallbackVectorize(doc.width, doc.height, Number(this.vecColors));
      }
      this.vectorizeResult.set(res);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') return;
      this.vectorizeError.set(describeError(error));
    } finally {
      this.vectorizeBusy.set(false);
    }
  }

  /** Generates a sample hummingbird sketch directly in the browser so the user can test 1-click. */
  async loadDemoSketch(): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = '#d99b1e';
    ctx.beginPath();
    ctx.arc(200, 200, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#286b35';
    ctx.beginPath();
    ctx.moveTo(140, 220);
    ctx.lineTo(240, 150);
    ctx.lineTo(210, 270);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b3202a';
    ctx.beginPath();
    ctx.arc(260, 140, 45, 0, Math.PI * 2);
    ctx.fill();
    this.sketchImage.set(canvas.toDataURL('image/jpeg', 0.85));
    await this.runVectorize();
  }

  // ---------- 0. Dibujar desde una frase ----------

  drawFromText(text = this.designText, newVersion = false): void {
    this.designText = text;
    this.designSeed = newVersion ? this.designSeed + 1 : 0;
    const result = designFromText(text, this.designSeed);
    this.design.set(result);
    this.designMissed.set(!result && text.trim().length > 0);
  }

  useDesign(): void {
    const result = this.design();
    if (result) this.applyWithLayerAnimation(result.document);
  }

  applyVectorizedLayers(): void {
    const preview = this.vectorizePreviewDoc();
    if (preview) this.applyWithLayerAnimation(preview);
  }

  /** One undo step; then the laminas appear one by one, as they would be laid on the wood. */
  private applyWithLayerAnimation(preview: PatternDocument): void {
    this.clearAnimationTimers();
    this.store.apply(preview);
    const totalLayers = preview.layers?.length ?? 0;
    if (totalLayers > 1) {
      for (let i = 1; i <= totalLayers; i++) {
        const timer = setTimeout(
          () => {
            this.store.animatedLayerLimit.set(i < totalLayers ? i : undefined);
          },
          (i - 1) * 320,
        );
        this.animTimers.push(timer);
      }
    }
  }

  // ---------- 2. Colores desde una foto ----------

  async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.paletteError.set('Elige un archivo de imagen (JPG, PNG o WebP).');
      return;
    }
    this.paletteBusy.set(true);
    this.paletteError.set(null);
    try {
      const image = await shrinkImage(file, 400);
      this.photo.set(image);
      this.store.palette.set(await this.api.extractPalette(image, this.colors));
    } catch (error) {
      this.paletteError.set(
        error instanceof DOMException ? 'No se pudo leer esa imagen.' : describeError(error),
      );
    } finally {
      this.paletteBusy.set(false);
    }
  }

  useAnilinePalette(): void {
    const share = 1 / 5;
    this.store.palette.set(ANILINE_COLORS.slice(0, 5).map((c) => ({ hex: c.hex, share })));
  }

  useColor(hex: string): void {
    if (this.store.selected()) this.store.updateSelected({ fill: hex });
    this.store.fill.set(hex);
  }

  // ---------- 3. Evolución interactiva y Frente de Pareto ----------

  private activePalette(): string[] {
    const fromStore = this.store.palette().map((color) => color.hex);
    if (fromStore.length > 0) return fromStore;
    const fromLayers = (this.store.document().layers ?? []).map((l) => l.color);
    if (fromLayers.length > 0) return fromLayers;
    return ANILINE_COLORS.slice(0, 4).map((c) => c.hex);
  }

  toggleFavorite(index: number): void {
    this.favoriteIndices.update((list) =>
      list.includes(index) ? list.filter((i) => i !== index) : [...list, index],
    );
  }

  async evolveNextGeneration(): Promise<void> {
    if (this.variationsBusy() || !this.store.document().shapes.length) return;
    const palette = this.activePalette();
    this.variationsBusy.set(true);
    this.variationsError.set(null);
    this.evolveAbort = new AbortController();
    const document = this.store.document();
    const currentEvolved = this.evolved();
    const favorites = currentEvolved
      ? this.favoriteIndices()
          .map((idx) => currentEvolved.variations[idx]?.document)
          .filter((d): d is PatternDocument => !!d)
      : [];
    const weights = {
      balance: Number(this.weightBalance),
      overlap: Number(this.weightOverlap),
      contrast: Number(this.weightContrast),
      coverage: Number(this.weightCoverage),
    };

    try {
      let result: EvolvedVariations;
      try {
        result = await this.api.evolveVariations(
          {
            document,
            palette,
            favorites,
            weights,
            seed: this.seed++,
          },
          { signal: this.evolveAbort.signal },
        );
      } catch (err) {
        if (err instanceof ApiError && (err.code === 'ABORTED' || err.code === 'RATE_LIMITED')) {
          throw err;
        }
        result = fallbackEvolve(document, palette, weights, this.allHistory().length + 1);
      }
      this.evolved.set(result);
      this.variationsFor.set(document);
      this.favoriteIndices.set([]);
      this.allHistory.set(result.history ?? []);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') return;
      this.variationsError.set(describeError(error));
    } finally {
      this.variationsBusy.set(false);
    }
  }

  async computePareto(): Promise<void> {
    if (this.paretoBusy() || !this.store.document().shapes.length) return;
    this.paretoBusy.set(true);
    const document = this.store.document();
    const palette = this.activePalette();
    try {
      let result: ParetoVariationsResult;
      try {
        result = await this.api.paretoVariations(document, palette, this.seed++);
      } catch {
        result = fallbackPareto(document, palette);
      }
      this.pareto.set(result);
      this.hoveredPareto.set(result.points[0] ?? null);
    } finally {
      this.paretoBusy.set(false);
    }
  }

  historyPolyline(key: 'best' | 'average'): string {
    const hist = this.allHistory();
    if (hist.length === 0) return '';
    return hist
      .map((item, idx) => {
        const x = hist.length === 1 ? 120 : (idx / (hist.length - 1)) * 220 + 10;
        const y = 70 - Math.max(0, Math.min(1, item[key])) * 56;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  useVariation(document: PatternDocument): void {
    this.store.apply(document);
  }

  // ---------- 4. Plan de corte y Plan de material por lámina ----------

  async optimize(): Promise<void> {
    if (this.layoutBusy()) return;
    this.layoutBusy.set(true);
    this.layoutError.set(null);
    this.layoutAbort = new AbortController();
    const document = this.store.document();
    const rollWidth = Number(this.rollWidth);
    const isBarniz = document.mode === 'barniz';
    try {
      const plan = await this.api.optimizeLayout(
        document,
        rollWidth,
        Number(this.spacing),
        isBarniz
          ? {
              perLayer: true,
              sheetWidth: Number(this.sheetWidth),
              sheetHeight: Number(this.sheetHeight),
              method: this.layoutMethod,
            }
          : undefined,
        { signal: this.layoutAbort.signal },
      );
      this.layout.set(plan);
      this.layoutFor.set({ document, rollWidth });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ABORTED') return;
      this.layoutError.set(describeError(error));
    } finally {
      this.layoutBusy.set(false);
    }
  }

  downloadPlan(): void {
    const plan = this.layout();
    const target = this.layoutFor();
    if (!plan || !target) return;
    const name = this.store.name();
    download(
      `${slug(name)}-plan-de-corte.svg`,
      cutPlanSvg(target.document, plan, target.rollWidth, name),
      'image/svg+xml',
    );
  }

  exportLayerSvgById(layerId: string): void {
    const doc = this.store.document();
    const layer = (doc.layers ?? []).find((l) => l.id === layerId);
    if (!layer) return;
    const name = this.store.name();
    download(
      `${slug(name)}-lamina-${slug(layer.name)}.svg`,
      toLayerSvg(doc, layer, name),
      'image/svg+xml',
    );
  }

  exportAllLayersSvg(): void {
    const doc = this.store.document();
    const name = this.store.name();
    for (const layer of doc.layers ?? []) {
      download(
        `${slug(name)}-lamina-${slug(layer.name)}.svg`,
        toLayerSvg(doc, layer, name),
        'image/svg+xml',
      );
    }
  }

  layerNameOf(layerId: string): string {
    return (this.store.document().layers ?? []).find((l) => l.id === layerId)?.name ?? layerId;
  }

  // ---------- 5. Análisis de color ----------

  async runColorAnalysis(): Promise<void> {
    if (this.colorBusy()) return;
    this.colorBusy.set(true);
    this.colorError.set(null);
    const doc = this.store.document();
    try {
      let result: ColorAnalysis;
      try {
        result = await this.api.analyzeColors(doc);
      } catch {
        result = fallbackAnalyzeColors(doc);
      }
      this.colorAnalysis.set(result);
    } catch (error) {
      this.colorError.set(describeError(error));
    } finally {
      this.colorBusy.set(false);
    }
  }

  applyHarmony(colors: string[]): void {
    if (colors.length === 0) return;
    const doc = this.store.document();
    const layers = (doc.layers ?? []).map((l, i) => ({
      ...l,
      color: colors[i % colors.length].toLowerCase(),
    }));
    const layerColorMap = new Map(layers.map((l) => [l.id, l.color]));
    const shapes = doc.shapes.map((s, i) => ({
      ...s,
      fill:
        (s.layerId ? layerColorMap.get(s.layerId) : undefined) ??
        colors[i % colors.length].toLowerCase(),
    }));
    this.store.apply({ ...doc, layers, shapes });
  }

  saving(before: number, after: number): number {
    return before > 0 ? Math.round((1 - after / before) * 100) : 0;
  }

  asPercent(value: number): number {
    return Math.round(value * 100);
  }
}
