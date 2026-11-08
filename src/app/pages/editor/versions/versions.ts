import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PatternVersion, PatronlabApi } from '../../../core/api/patronlab-api';
import { describeError } from '../../../core/api/graphql';
import { PatternDocument } from '../../../core/editor/document';
import { EditorStore } from '../../../core/editor/editor-store';
import { formatDateTime, timeAgo } from '../../../core/format';
import { Thumbnail } from '../../../shared/thumbnail';

@Component({
  selector: 'app-versions',
  imports: [FormsModule, Thumbnail],
  template: `
    <section class="block">
      <h3>Guardar una versión</h3>
      <label class="field">
        <span>Nota (opcional)</span>
        <input
          [(ngModel)]="note"
          name="note"
          maxlength="200"
          placeholder="Hojas más grandes, colores de la foto"
          (keydown.enter)="saveRequested.emit(note)"
        />
      </label>
      <button
        class="btn small primary"
        type="button"
        (click)="saveRequested.emit(note)"
        [disabled]="!store.dirty() || store.saving()"
      >
        {{
          store.saving()
            ? 'Guardando…'
            : store.dirty()
              ? 'Guardar versión ' + (store.baseVersion() + 1)
              : 'Sin cambios por guardar'
        }}
      </button>
    </section>

    <section class="block">
      <h3>Historial</h3>
      @if (error(); as message) {
        <p class="error-text" role="alert">{{ message }}</p>
      }
      <ol>
        @for (version of versions(); track version.number) {
          <li [class.current]="version.number === store.baseVersion()">
            <div class="line">
              <strong>Versión {{ version.number }}</strong>
              <time
                [attr.datetime]="version.createdAt"
                [title]="formatDateTime(version.createdAt)"
                >{{ timeAgo(version.createdAt) }}</time
              >
            </div>
            <p class="note">{{ version.note || 'Sin nota' }}, {{ version.shapeCount }} piezas</p>
            @if (version.number === store.baseVersion()) {
              <p class="tag">Versión actual</p>
            } @else {
              <div class="actions">
                <button class="btn small quiet" type="button" (click)="peek(version.number)">
                  {{ peeking() === version.number ? 'Ocultar' : 'Ver' }}
                </button>
                <button
                  class="btn small"
                  type="button"
                  (click)="restoreRequested.emit(version.number)"
                >
                  Restaurar
                </button>
              </div>
              @if (peeking() === version.number && peekDocument(); as document) {
                <app-thumbnail
                  class="peek"
                  [document]="document"
                  [size]="220"
                  [label]="'Versión ' + version.number"
                />
              }
            }
          </li>
        }
      </ol>
      <p class="muted">Restaurar no borra nada: la versión vieja se guarda como la más nueva.</p>
    </section>
  `,
  styles: `
    .block {
      display: grid;
      gap: 0.6rem;
      padding: 1rem;
      border-bottom: 1px solid var(--line);
    }
    .block > .btn {
      justify-self: start;
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.25rem;
    }
    li {
      display: grid;
      gap: 0.2rem;
      padding: 0.5rem 0.6rem;
      border-radius: 6px;
      border-left: 3px solid transparent;
    }
    li.current {
      background: var(--paper-2);
      border-left-color: var(--chalk);
    }
    .line {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.9rem;
    }
    time,
    .note,
    .muted {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .tag {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
    }
    .actions {
      display: flex;
      gap: 0.3rem;
      margin-left: -0.6rem;
    }
    .peek {
      width: 100%;
      aspect-ratio: 1;
      background: var(--mat);
      border-radius: 4px;
      padding: 6px;
    }
  `,
})
export class Versions {
  private readonly api = inject(PatronlabApi);
  readonly store = inject(EditorStore);
  readonly versions = input.required<PatternVersion[]>();
  readonly saveRequested = output<string>();
  readonly restoreRequested = output<number>();
  readonly timeAgo = timeAgo;
  readonly formatDateTime = formatDateTime;

  note = '';
  readonly peeking = signal<number | null>(null);
  readonly peekDocument = signal<PatternDocument | null>(null);
  readonly error = signal<string | null>(null);

  clearNote(): void {
    this.note = '';
  }

  async peek(number: number): Promise<void> {
    if (this.peeking() === number) {
      this.peeking.set(null);
      return;
    }
    this.peeking.set(number);
    this.peekDocument.set(null);
    try {
      this.peekDocument.set(await this.api.versionDocument(this.store.patternId(), number));
    } catch (error) {
      this.error.set(describeError(error));
    }
  }
}
