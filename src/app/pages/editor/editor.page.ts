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
import { Router, RouterLink } from '@angular/router';

import { ApiError, describeError } from '../../core/api/graphql';
import { PatronlabApi, PatternVersion } from '../../core/api/patronlab-api';
import { EditorStore } from '../../core/editor/editor-store';
import { InpMeter } from '../../core/editor/inp-meter';
import { download, slug, toSvg } from '../../core/editor/svg-export';
import { AiPanel } from './ai-panel/ai-panel';
import { Inspector } from './inspector/inspector';
import { Preview } from './preview/preview';
import { Stage } from './stage/stage';
import { Tools } from './tools/tools';
import { Versions } from './versions/versions';

type Tab = 'piece' | 'ai' | 'preview' | 'versions';

@Component({
  selector: 'app-editor-page',
  imports: [RouterLink, Stage, Tools, Inspector, AiPanel, Preview, Versions],
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
  readonly notice = signal<string | null>(null);
  readonly conflictVersion = signal<number | null>(null);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'piece', label: 'Pieza' },
    { id: 'ai', label: 'IA' },
    { id: 'preview', label: 'Vista' },
    { id: 'versions', label: 'Versiones' },
  ];

  private readonly stage = viewChild(Stage);
  private readonly versionsPanel = viewChild(Versions);
  private readonly conflictDialog = viewChild.required<ElementRef<HTMLDialogElement>>('conflict');

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
      requestAnimationFrame(() => this.stage()?.fit());
    } catch (error) {
      this.loadError.set(
        error instanceof ApiError && error.code === 'NOT_FOUND'
          ? 'Este patrón no existe o no es tuyo.'
          : describeError(error),
      );
    }
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

    if (mod && key === 's') {
      event.preventDefault();
      void this.save();
      return;
    }
    if (typing || this.conflictDialog().nativeElement.open) return;

    if (mod && key === 'z') {
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
      if (this.store.selected()) {
        event.preventDefault();
        this.store.deleteSelected();
      }
    } else if (key === 'escape') {
      this.store.tool.set(null);
      this.store.selectedId.set(null);
    } else if (key.startsWith('arrow') && this.store.selected()) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      this.store.moveSelected(dx, dy);
    }
  }
}
