import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../../core/api/graphql';
import { PatronlabApi, PatternSummary } from '../../core/api/patronlab-api';
import { SessionStore } from '../../core/auth/session.store';
import { MATERIALS, materialOf } from '../../core/editor/document';
import { TEMPLATES } from '../../core/editor/templates';
import { timeAgo } from '../../core/format';
import { Thumbnail } from '../../shared/thumbnail';

@Component({
  selector: 'app-patterns-page',
  imports: [FormsModule, RouterLink, Thumbnail],
  templateUrl: './patterns.page.html',
  styleUrl: './patterns.page.scss',
})
export class PatternsPage {
  private readonly api = inject(PatronlabApi);
  private readonly router = inject(Router);
  readonly session = inject(SessionStore);

  readonly materials = MATERIALS;
  readonly templates = TEMPLATES;
  readonly materialOf = materialOf;
  readonly timeAgo = timeAgo;

  readonly patterns = signal<PatternSummary[] | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly confirmingDelete = signal<string | null>(null);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  name = '';
  material = 'felt';
  template = 'leaf-cushion';
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loadError.set(null);
    try {
      this.patterns.set(await this.api.patterns());
    } catch (error) {
      this.loadError.set(describeError(error));
    }
  }

  openNew(): void {
    this.name = '';
    this.createError.set(null);
    this.dialog().nativeElement.showModal();
  }

  closeNew(): void {
    this.dialog().nativeElement.close();
  }

  async create(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const template = TEMPLATES.find((t) => t.id === this.template) ?? TEMPLATES[0];
      const id = await this.api.createPattern(this.name.trim(), this.material, template.build());
      this.closeNew();
      await this.router.navigate(['/patrones', id]);
    } catch (error) {
      this.createError.set(describeError(error));
    } finally {
      this.creating.set(false);
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
