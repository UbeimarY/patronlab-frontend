import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../../core/api/graphql';
import { PatronlabApi, PatternSummary } from '../../core/api/patronlab-api';
import { SessionStore } from '../../core/auth/session.store';
import {
  BarnizLeaf,
  BarnizObjectKind,
  LEAF_LABELS,
  MATERIALS,
  OBJECT_LABELS,
  PatternDocument,
  PatternMode,
  materialOf,
  migrateDocument,
} from '../../core/editor/document';
import { TEMPLATES } from '../../core/editor/templates';
import { timeAgo } from '../../core/format';
import { Thumbnail } from '../../shared/thumbnail';

@Component({
  selector: 'app-patterns-page',
  imports: [FormsModule, RouterLink, Thumbnail],
  templateUrl: './patterns.page.html',
  styleUrl: './patterns.page.scss',
})
export class PatternsPage implements OnInit {
  private readonly api = inject(PatronlabApi);
  private readonly router = inject(Router);
  readonly session = inject(SessionStore);

  readonly materials = MATERIALS;
  readonly templates = TEMPLATES;
  readonly objectKinds: { id: BarnizObjectKind; label: string }[] = [
    { id: 'plate', label: OBJECT_LABELS.plate },
    { id: 'bowl', label: OBJECT_LABELS.bowl },
    { id: 'box', label: OBJECT_LABELS.box },
    { id: 'tray', label: OBJECT_LABELS.tray },
  ];
  readonly leafOptions: { id: BarnizLeaf; label: string }[] = [
    { id: 'gold', label: LEAF_LABELS.gold },
    { id: 'silver', label: LEAF_LABELS.silver },
    { id: 'none', label: LEAF_LABELS.none },
  ];
  readonly basePresets = [
    { label: 'Ébano laqueado', hex: '#1b1512' },
    { label: 'Noche andina', hex: '#15191d' },
    { label: 'Caoba profundo', hex: '#2b1612' },
    { label: 'Verde selva', hex: '#13241b' },
  ];

  readonly materialOf = materialOf;
  readonly timeAgo = timeAgo;

  readonly patterns = signal<PatternSummary[] | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly confirmingDelete = signal<string | null>(null);
  readonly renamingId = signal<string | null>(null);
  renameValue = '';

  // Filters
  readonly searchQuery = signal('');
  readonly modeFilter = signal<'all' | PatternMode>('all');
  readonly materialFilter = signal<string>('all');

  readonly filteredPatterns = computed(() => {
    const list = this.patterns();
    if (!list) return null;
    const q = this.searchQuery().trim().toLowerCase();
    const mode = this.modeFilter();
    const mat = this.materialFilter();
    return list.filter((item) => {
      const docMode = this.modeOf(item);
      if (mode !== 'all' && docMode !== mode) return false;
      if (mat !== 'all' && item.material !== mat) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  name = '';
  readonly newMode = signal<PatternMode>('barniz');
  material = 'mopa-mopa';
  readonly templateId = signal('barniz-hummingbird');

  // Barniz object configuration in "Nuevo patrón"
  readonly objectKind = signal<BarnizObjectKind>('plate');
  readonly objectWidth = signal(300);
  readonly objectHeight = signal(300);
  readonly baseColor = signal('#1b1512');
  readonly leaf = signal<BarnizLeaf>('gold');

  readonly modeTemplates = computed(() => TEMPLATES.filter((t) => t.mode === this.newMode()));

  readonly previewDocument = computed<PatternDocument>(() => {
    const tpl =
      TEMPLATES.find((t) => t.id === this.templateId()) ?? this.modeTemplates()[0] ?? TEMPLATES[0];
    if (this.newMode() === 'barniz') {
      const kind = this.objectKind();
      const width = Math.min(1200, Math.max(80, Number(this.objectWidth()) || 300));
      const height =
        kind === 'plate' || kind === 'bowl'
          ? width
          : Math.min(1200, Math.max(80, Number(this.objectHeight()) || 200));
      return tpl.build({
        kind,
        width,
        height,
        baseColor: this.baseColor(),
        leaf: this.leaf(),
      });
    }
    return tpl.build();
  });

  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loadError.set(null);
    try {
      const list = await this.api.patterns();
      this.patterns.set(
        list.map((p) => ({
          ...p,
          document: migrateDocument(p.document),
        })),
      );
    } catch (error) {
      this.loadError.set(describeError(error));
    }
  }

  modeOf(pattern: PatternSummary): PatternMode {
    return pattern.mode ?? (pattern.document?.mode === 'barniz' ? 'barniz' : 'pattern');
  }

  pieceCountOf(pattern: PatternSummary): number {
    return pattern.pieceCount ?? pattern.document?.shapes?.length ?? 0;
  }

  layerCountOf(pattern: PatternSummary): number {
    return pattern.layerCount ?? pattern.document?.layers?.length ?? 0;
  }

  openNew(mode: PatternMode = 'barniz'): void {
    this.setNewMode(mode);
    this.name = mode === 'barniz' ? 'Plato colibrí de mopa-mopa' : 'Cojín para la feria';
    this.createError.set(null);
    this.dialog().nativeElement.showModal();
  }

  setNewMode(mode: PatternMode): void {
    this.newMode.set(mode);
    if (mode === 'barniz') {
      this.material = 'mopa-mopa';
      this.templateId.set('barniz-hummingbird');
      this.objectKind.set('plate');
      this.objectWidth.set(300);
      this.objectHeight.set(300);
      this.baseColor.set('#1b1512');
      this.leaf.set('gold');
    } else {
      this.material = 'felt';
      this.templateId.set('leaf-cushion');
    }
  }

  selectTemplate(id: string): void {
    this.templateId.set(id);
    if (id === 'barniz-fret-box') {
      this.objectKind.set('box');
      this.objectWidth.set(240);
      this.objectHeight.set(180);
    } else if (id === 'barniz-galeras-tray') {
      this.objectKind.set('tray');
      this.objectWidth.set(360);
      this.objectHeight.set(240);
    } else if (id === 'barniz-radial-bowl') {
      this.objectKind.set('bowl');
      this.objectWidth.set(260);
      this.objectHeight.set(260);
      this.leaf.set('silver');
    } else if (id === 'barniz-hummingbird') {
      this.objectKind.set('plate');
      this.objectWidth.set(300);
      this.objectHeight.set(300);
      this.leaf.set('gold');
    }
  }

  isCircularObject(): boolean {
    const k = this.objectKind();
    return k === 'plate' || k === 'bowl';
  }

  closeNew(): void {
    this.dialog().nativeElement.close();
  }

  async create(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const doc = this.previewDocument();
      const id = await this.api.createPattern(this.name.trim(), this.material, doc);
      this.closeNew();
      await this.router.navigate(['/patrones', id]);
    } catch (error) {
      this.createError.set(describeError(error));
    } finally {
      this.creating.set(false);
    }
  }

  async duplicate(pattern: PatternSummary): Promise<void> {
    this.loadError.set(null);
    try {
      let newId: string;
      try {
        newId = await this.api.duplicatePattern(pattern.id);
      } catch {
        newId = await this.api.createPattern(
          `${pattern.name} (copia)`.slice(0, 100),
          pattern.material,
          pattern.document,
        );
      }
      await this.load();
      void newId;
    } catch (error) {
      this.loadError.set(describeError(error));
    }
  }

  startRename(pattern: PatternSummary): void {
    this.renamingId.set(pattern.id);
    this.renameValue = pattern.name;
  }

  async saveRename(pattern: PatternSummary): Promise<void> {
    const next = this.renameValue.trim();
    this.renamingId.set(null);
    if (!next || next === pattern.name) return;
    try {
      const updated = await this.api.renamePattern(pattern.id, next);
      this.patterns.update(
        (list) => list?.map((p) => (p.id === pattern.id ? { ...p, name: updated } : p)) ?? null,
      );
    } catch (error) {
      this.loadError.set(describeError(error));
    }
  }

  async remove(pattern: PatternSummary): Promise<void> {
    try {
      await this.api.deletePattern(pattern.id);
      this.patterns.update((list) => list?.filter((p) => p.id !== pattern.id) ?? null);
    } catch (error) {
      this.loadError.set(describeError(error));
    } finally {
      this.confirmingDelete.set(null);
    }
  }

  signOut(): void {
    this.session.clear();
    void this.router.navigate(['/entrar']);
  }
}
