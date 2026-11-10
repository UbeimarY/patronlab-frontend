import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../../core/api/graphql';
import { PatronlabApi } from '../../core/api/patronlab-api';
import { SessionStore } from '../../core/auth/session.store';
import { renderThumbnail } from '../../core/editor/render';
import { TEMPLATES } from '../../core/editor/templates';

export interface PasswordStrength {
  /** 0 = empty, 1 = too short, 2 = weak, 3 = fair, 4 = strong. */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/** A simple, explainable strength meter: length first, then variety of characters. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: 'Mínimo 8 caracteres.' };
  if (password.length < 8) {
    return { level: 1, label: `Muy corta: faltan ${8 - password.length} caracteres.` };
  }
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const score = (password.length >= 12 ? 1 : 0) + (variety >= 3 ? 1 : 0) + (variety >= 2 ? 1 : 0);
  if (score >= 3) return { level: 4, label: 'Fuerte.' };
  if (score === 2) return { level: 3, label: 'Buena. Una frase larga la hace aún más segura.' };
  return { level: 2, label: 'Débil: mezcla letras, números o símbolos.' };
}

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
})
export class AuthPage {
  private readonly api = inject(PatronlabApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly plate = viewChild.required<ElementRef<HTMLCanvasElement>>('plate');

  readonly mode = input<'login' | 'register'>('login');
  readonly volver = input<string | undefined>();
  readonly isRegister = computed(() => this.mode() === 'register');

  readonly crafts = [
    'Barniz de Pasto',
    'Bordado',
    'Marroquinería',
    'Fieltro',
    'Confección',
    'Corte láser',
    'Talla en madera',
  ];

  email = '';
  password = '';
  fullName = '';
  craft = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly showPassword = signal(false);

  constructor() {
    // The hero shows a real mopa-mopa plate, drawn by the editor's own renderer.
    afterNextRender(() => {
      const canvas = this.plate().nativeElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = canvas.clientWidth || 180;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      const template = TEMPLATES.find((t) => t.id === 'barniz-hummingbird');
      if (template) renderThumbnail(canvas, template.build());
    });
  }

  strength(): PasswordStrength {
    return passwordStrength(this.password);
  }

  /** Field errors appear after the user leaves the field or tries to submit. */
  showError(model: NgModel): boolean {
    return Boolean(model.invalid && (model.touched || this.submitted()));
  }

  async submit(form: NgForm): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.submitted.set(true);
    if (form.invalid) {
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }
    this.busy.set(true);
    try {
      const payload = this.isRegister()
        ? await this.api.register({
            email: this.email.trim(),
            password: this.password,
            fullName: this.fullName.trim(),
            craft: this.craft.trim() || null,
          })
        : await this.api.login(this.email.trim(), this.password);
      this.session.start(payload.token, payload.expiresAt, payload.user);
      const target = this.volver();
      // Only same-site paths: "//host" would be a protocol-relative jump to another site.
      const safe = target?.startsWith('/') && !target.startsWith('//') ? target : '/patrones';
      await this.router.navigateByUrl(safe);
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
