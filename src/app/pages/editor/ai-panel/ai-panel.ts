import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { describeError } from '../../../core/api/graphql';
import { Layout, PatronlabApi, Score, Variations } from '../../../core/api/patronlab-api';
import { cutPlanSvg, drawCutPlan } from '../../../core/editor/cut-plan';
import { PatternDocument, materialOf } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { download, slug } from '../../../core/editor/svg-export';
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

  // Palette
  colors = 5;
  readonly photo = signal<string | null>(null);
  readonly paletteBusy = signal(false);
  readonly paletteError = signal<string | null>(null);

  // Variations
  private seed = 0;
  readonly variations = signal<Variations | null>(null);
  readonly variationsFor = signal<PatternDocument | null>(null);
  readonly variationsBusy = signal(false);
  readonly variationsError = signal<string | null>(null);
  readonly criteria: { key: keyof Omit<Score, 'total'>; label: string }[] = [
    { key: 'balance', label: 'Equilibrio' },
    { key: 'overlap', label: 'Sin encimar' },
    { key: 'contrast', label: 'Contraste' },
    { key: 'coverage', label: 'Cobertura' },
  ];

  // Cutting plan
  rollWidth = materialOf(this.store.material()).rollWidth;
  spacing = 3;
  readonly layout = signal<Layout | null>(null);
  readonly layoutFor = signal<{ document: PatternDocument; rollWidth: number } | null>(null);
  readonly layoutBusy = signal(false);
  readonly layoutError = signal<string | null>(null);
  readonly outdated = computed(() => {
    const result = this.layoutFor();
    return !!result && result.document !== this.store.document();
  });
  private readonly planCanvas = viewChild<ElementRef<HTMLCanvasElement>>('plan');

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
  }

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
      const image = await shrinkImage(file);
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

  useColor(hex: string): void {
    if (this.store.selected()) this.store.updateSelected({ fill: hex });
    this.store.fill.set(hex);
  }

  async generate(): Promise<void> {
    const palette = this.store.palette().map((color) => color.hex);
    if (palette.length === 0 || this.variationsBusy()) return;
    this.variationsBusy.set(true);
    this.variationsError.set(null);
    const document = this.store.document();
    try {
      this.variations.set(await this.api.generateVariations(document, palette, this.seed++));
      this.variationsFor.set(document);
    } catch (error) {
      this.variationsError.set(describeError(error));
    } finally {
      this.variationsBusy.set(false);
    }
  }

  useVariation(document: PatternDocument): void {
    this.store.apply(document); // one step in the history: Ctrl + Z brings the original back
  }

  async optimize(): Promise<void> {
    if (this.layoutBusy()) return;
    this.layoutBusy.set(true);
    this.layoutError.set(null);
    const document = this.store.document();
    const rollWidth = Number(this.rollWidth);
    try {
      this.layout.set(await this.api.optimizeLayout(document, rollWidth, Number(this.spacing)));
      this.layoutFor.set({ document, rollWidth });
    } catch (error) {
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

  saving(before: number, after: number): number {
    return before > 0 ? Math.round((1 - after / before) * 100) : 0;
  }

  asPercent(value: number): number {
    return Math.round(value * 100);
  }
}
