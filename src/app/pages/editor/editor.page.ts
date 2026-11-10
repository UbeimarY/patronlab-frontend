import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ApiError, describeError } from '../../core/api/graphql';
import { PatronlabApi, PatternVersion } from '../../core/api/patronlab-api';
import { ANILINE_COLORS, Shape, clampShape, newShapeId } from '../../core/editor/document';
import { EditorStore } from '../../core/editor/editor-store';
import { InpMeter } from '../../core/editor/inp-meter';
import { download, slug, toLayerSvg, toSvg } from '../../core/editor/svg-export';
import { AiPanel } from './ai-panel/ai-panel';
import { Inspector } from './inspector/inspector';
import { Preview } from './preview/preview';
import { Stage } from './stage/stage';
import { Tools } from './tools/tools';
import { Versions } from './versions/versions';

type Tab = 'piece' | 'ai' | 'preview' | 'versions';

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

const TOUR_STORAGE_KEY = 'patronlab_tour_done_v2';

@Component({
  selector: 'app-editor-page',
  imports: [FormsModule, RouterLink, Stage, Tools, Inspector, AiPanel, Preview, Versions],
  providers: [EditorStore, InpMeter],
  templateUrl: './editor.page.html',
  styleUrl: './editor.page.scss',
})
export class EditorPage {
  private readonly api = inject(PatronlabApi);
  private readonly router = inject(Router);
  readonly store = inject(EditorStore);
  readonly inp = inject(InpMeter);

  readonly id = input.required<string>();
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly versions = signal<PatternVersion[]>([]);
  readonly tab = signal<Tab>('piece');
  readonly mobileSheetOpen = signal(false);
  readonly notice = signal<string | null>(null);
  readonly conflictVersion = signal<number | null>(null);

  // Command palette (Ctrl+K) & Shortcut help (?)
  readonly commandQuery = signal('');
  private readonly commandDialog = viewChild<ElementRef<HTMLDialogElement>>('commandsDialog');
  private readonly helpDialog = viewChild<ElementRef<HTMLDialogElement>>('helpDialog');

  // First-time guided tour (4 steps, skippable, persisted in localStorage)
  readonly tourStep = signal<number | null>(null);
  readonly tourSteps = [
    {
      title: '1. Mesa de madera y láminas de mopa-mopa',
      body: 'En el modo Barniz de Pasto trabajas sobre un plato, cuenco, caja o bandeja con esmalte y pan de oro. Cada capa representa una lámina teñida con anilina.',
    },
    {
      title: '2. Herramienta Bisturí (tecla B)',
      body: 'Elige el Bisturí a la izquierda: haz clic para trazar puntos o arrastra para curvas suaves. Con doble clic cierras el corte o insertas nuevos nodos.',
    },
    {
      title: '3. Simetría radial y selección múltiple',
      body: 'Activa la simetría radial (2 a 24 copias con espejo opcional) en el panel Pieza. Mientras mueves la pieza fuente, toda la corona gira en vivo.',
    },
    {
      title: '4. IA, Vista 3D e Impresión 1:1',
      body: 'En el panel IA puedes convertir un boceto en láminas, evolucionar variaciones favoritas y descargar el SVG de cada lámina o las hojas A4/Carta a escala real.',
    },
  ];

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'piece', label: 'Pieza' },
    { id: 'ai', label: 'IA' },
    { id: 'preview', label: 'Vista' },
    { id: 'versions', label: 'Versiones' },
  ];

  private readonly stage = viewChild(Stage);
  private readonly versionsPanel = viewChild(Versions);
  private readonly conflictDialog = viewChild.required<ElementRef<HTMLDialogElement>>('conflict');

  readonly commands = computed<CommandItem[]>(() => {
    const all: CommandItem[] = [
      {
        id: 'bisturi',
        label: 'Activar herramienta Bisturí',
        shortcut: 'B',
        run: () => this.store.tool.set('path'),
      },
      {
        id: 'radial-6',
        label: 'Activar simetría radial de 6 copias',
        run: () => this.store.setRadialSymmetry(6, false),
      },
      {
        id: 'radial-off',
        label: 'Desactivar simetría radial',
        run: () => this.store.setRadialSymmetry(null),
      },
      {
        id: 'add-layer',
        label: 'Agregar nueva lámina de mopa-mopa',
        run: () => this.store.addLayer(),
      },
      {
        id: 'tab-ai',
        label: 'Abrir panel de Inteligencia Artificial',
        run: () => this.selectTab('ai'),
      },
      {
        id: 'tab-3d',
        label: 'Abrir Vista 3D e impresión a escala real',
        run: () => this.selectTab('preview'),
      },
      {
        id: 'fit',
        label: 'Ajustar vista al objeto completo',
        shortcut: '0',
        run: () => this.fit(),
      },
      {
        id: 'zoom-sel',
        label: 'Acercar a la pieza seleccionada',
        run: () => this.zoomToSelection(),
      },
      {
        id: 'export-svg',
        label: 'Exportar diseño completo en SVG a tamaño real',
        run: () => this.exportSvg(),
      },
      {
        id: 'export-layers',
        label: 'Exportar un SVG por cada lámina',
        run: () => this.exportPerLayerSvgs(),
      },
      {
        id: 'stress-300',
        label: 'Generar 300 piezas de prueba (medir rendimiento INP)',
        run: () => this.generate300PiecesBenchmark(),
      },
      {
        id: 'conflict-demo',
        label: 'Simular conflicto de versiones (demostración)',
        run: () => this.simulateVersionConflict(),
      },
      {
        id: 'tour',
        label: 'Ver recorrido guiado del taller',
        run: () => this.tourStep.set(0),
      },
      {
        id: 'craft',
        label: 'Abrir página "Sobre el oficio"',
        run: () => void this.router.navigate(['/oficio']),
      },
    ];
    const q = this.commandQuery().trim().toLowerCase();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  });

  readonly status = computed(() => {
    switch (this.store.saveState()) {
      case 'saving':
        return 'Guardando…';
      case 'error':
        return this.store.saveError() ?? 'No se pudo guardar';
      case 'dirty':
        return 'Cambios sin guardar';
      default:
        return `Guardado, versión ${this.store.baseVersion()}`;
    }
  });
  readonly conflictMessage = computed(() => {
    const version = this.conflictVersion();
    const where = version ? ` (ahora va en la versión ${version})` : '';
    return `Este patrón se guardó desde otra pestaña o dispositivo${where}. Para no borrar ese trabajo, tus cambios no se guardaron encima.`;
  });
  readonly inpLabel = computed(() => {
    const value = this.inp.inp();
    if (value === null) return 'Respuesta: interactúa para medir';
    const word = { good: 'buena', 'needs-improvement': 'mejorable', poor: 'lenta', none: '' }[
      this.inp.rating()
    ];
    return `Respuesta (INP): ${value} ms, ${word}`;
  });

  constructor() {
    this.inp.start();
    const destroyRef = inject(DestroyRef);
    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onUnload = (event: BeforeUnloadEvent) => {
      if (this.store.dirty()) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    destroyRef.onDestroy(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    });
    queueMicrotask(() => void this.load());
  }

  async load(): Promise<void> {
    this.loadError.set(null);
    try {
      const pattern = await this.api.pattern(this.id());
      this.store.load(pattern);
      this.versions.set(pattern.versions);
      this.loaded.set(true);
      try {
        if (!localStorage.getItem(TOUR_STORAGE_KEY)) {
          this.tourStep.set(0);
        }
      } catch {
        // Ignore storage errors
      }
      requestAnimationFrame(() => this.stage()?.fit());
    } catch (error) {
      this.loadError.set(
        error instanceof ApiError && error.code === 'NOT_FOUND'
          ? 'Este patrón no existe o no es tuyo.'
          : describeError(error),
      );
    }
  }

  selectTab(next: Tab): void {
    this.tab.set(next);
    this.mobileSheetOpen.set(true);
  }

  closeTour(): void {
    this.tourStep.set(null);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  }

  nextTourStep(): void {
    const cur = this.tourStep();
    if (cur === null) return;
    if (cur + 1 >= this.tourSteps.length) {
      this.closeTour();
    } else {
      this.tourStep.set(cur + 1);
    }
  }

  openCommands(): void {
    this.commandQuery.set('');
    this.commandDialog()?.nativeElement.showModal();
  }

  closeCommands(): void {
    this.commandDialog()?.nativeElement.close();
  }

  runCommand(cmd: CommandItem): void {
    this.closeCommands();
    cmd.run();
  }

  openHelp(): void {
    this.helpDialog()?.nativeElement.showModal();
  }

  closeHelp(): void {
    this.helpDialog()?.nativeElement.close();
  }

  simulateVersionConflict(): void {
    this.conflictVersion.set(this.store.baseVersion() + 1);
    this.conflictDialog().nativeElement.showModal();
  }

  /** Populates 300 pieces onto the current document to verify INP < 200 ms live. */
  generate300PiecesBenchmark(): void {
    const doc = this.store.document();
    const layers = doc.layers ?? [];
    const shapes: Shape[] = [];
    const cols = 20;
    const rows = 15;
    const pad = 24;
    const stepX = (doc.width - pad * 2) / cols;
    const stepY = (doc.height - pad * 2) / rows;
    const kinds = ['leaf', 'star', 'hexagon', 'ellipse', 'triangle', 'rect'] as const;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const layer = layers.length ? layers[idx % layers.length] : null;
        const fill = layer ? layer.color : ANILINE_COLORS[idx % ANILINE_COLORS.length].hex;
        shapes.push(
          clampShape({
            id: newShapeId(),
            kind: kinds[idx % kinds.length],
            x: pad + (c + 0.5) * stepX,
            y: pad + (r + 0.5) * stepY,
            width: Math.max(8, Math.round(stepX * 0.75)),
            height: Math.max(8, Math.round(stepY * 0.75)),
            rotation: (idx * 15) % 180,
            fill,
            stroke: '#2b2420',
            layerId: layer?.id ?? null,
            groupId: null,
          }),
        );
      }
    }
    this.store.apply({ ...doc, groups: [], shapes });
    this.store.selectOne(shapes[0]?.id ?? null);
    this.notice.set(
      '300 piezas generadas. Mueve o gira cualquier pieza para verificar que el INP siga por debajo de 200 ms.',
    );
  }

  async save(note = ''): Promise<void> {
    if (!this.store.dirty() || this.store.saving()) return;
    this.store.saving.set(true);
    this.store.saveError.set(null);
    const document = this.store.document();
    const material = this.store.material();
    try {
      const version = await this.api.savePattern(
        this.store.patternId(),
        this.store.baseVersion(),
        document,
        note.trim(),
        material,
      );
      this.store.markSaved(document, material, version);
      this.versionsPanel()?.clearNote();
      void this.refreshVersions();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        this.conflictVersion.set(Number(error.details['currentVersion'] ?? 0) || null);
        this.conflictDialog().nativeElement.showModal();
      } else {
        this.store.saveError.set(describeError(error));
      }
    } finally {
      this.store.saving.set(false);
    }
  }

  async restore(number: number): Promise<void> {
    if (this.store.dirty()) {
      this.notice.set('Guarda o deshaz tus cambios antes de restaurar otra versión.');
      return;
    }
    try {
      await this.api.restoreVersion(this.store.patternId(), number, this.store.baseVersion());
      await this.load();
      this.notice.set(`Versión ${number} restaurada como versión ${this.store.baseVersion()}.`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        this.conflictVersion.set(Number(error.details['currentVersion'] ?? 0) || null);
        this.conflictDialog().nativeElement.showModal();
      } else {
        this.notice.set(describeError(error));
      }
    }
  }

  async reloadLatest(): Promise<void> {
    this.conflictDialog().nativeElement.close();
    await this.load();
  }

  async saveAsCopy(): Promise<void> {
    this.conflictDialog().nativeElement.close();
    try {
      const id = await this.api.createPattern(
        `${this.store.name()} (copia)`.slice(0, 100),
        this.store.material(),
        this.store.document(),
      );
      this.store.markSaved(this.store.document(), this.store.material(), this.store.baseVersion());
      await this.router.navigate(['/patrones', id]);
    } catch (error) {
      this.notice.set(describeError(error));
    }
  }

  async rename(value: string): Promise<void> {
    const name = value.trim();
    if (!name || name === this.store.name()) return;
    try {
      this.store.name.set(await this.api.renamePattern(this.store.patternId(), name));
    } catch (error) {
      this.notice.set(describeError(error));
    }
  }

  exportSvg(): void {
    download(
      `${slug(this.store.name())}.svg`,
      toSvg(this.store.document(), this.store.name()),
      'image/svg+xml',
    );
  }

  exportPerLayerSvgs(): void {
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

  exportJson(): void {
    const data = {
      name: this.store.name(),
      material: this.store.material(),
      document: this.store.document(),
    };
    download(`${slug(this.store.name())}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  zoomIn(): void {
    this.stage()?.zoomBy(1.25);
  }

  zoomOut(): void {
    this.stage()?.zoomBy(0.8);
  }

  fit(): void {
    this.stage()?.fit();
  }

  zoomToSelection(): void {
    this.stage()?.zoomToSelection();
  }

  zoomPercent(): number {
    return Math.round((this.stage()?.zoom() ?? 1) * 100);
  }

  private async refreshVersions(): Promise<void> {
    try {
      this.versions.set((await this.api.pattern(this.store.patternId())).versions);
    } catch {
      // The list refreshes on the next load.
    }
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && key === 'k') {
      event.preventDefault();
      this.openCommands();
      return;
    }
    if (mod && key === 's') {
      event.preventDefault();
      void this.save();
      return;
    }
    if (typing || this.conflictDialog().nativeElement.open) return;

    if (event.key === '?') {
      event.preventDefault();
      this.openHelp();
    } else if (key === 'b' && !mod) {
      event.preventDefault();
      this.store.tool.update((t) => (t === 'path' ? null : 'path'));
    } else if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (mod && key === 'y') {
      event.preventDefault();
      this.store.redo();
    } else if (mod && key === 'd') {
      event.preventDefault();
      this.store.duplicateSelected();
    } else if (key === 'delete' || key === 'backspace') {
      const nodeIdx = this.store.selectedNodeIndex();
      if (nodeIdx !== null && this.store.selected()?.kind === 'path') {
        event.preventDefault();
        this.store.deletePathNode(nodeIdx);
      } else if (this.store.selected()) {
        event.preventDefault();
        this.store.deleteSelected();
      }
    } else if (key === 'escape') {
      this.store.tool.set(null);
      this.store.selectOne(null);
    } else if (key.startsWith('arrow') && this.store.selected()) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      this.store.moveSelected(dx, dy);
    }
  }
}
