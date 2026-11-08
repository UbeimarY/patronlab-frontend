import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeError } from '../../core/api/graphql';
import { PatronlabApi } from '../../core/api/patronlab-api';
import { SessionStore } from '../../core/auth/session.store';

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

  readonly mode = input<'login' | 'register'>('login');
  readonly volver = input<string | undefined>();
  readonly isRegister = computed(() => this.mode() === 'register');

  email = '';
  password = '';
  fullName = '';
  craft = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    if (this.isRegister() && this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.busy.set(true);
    try {
      const payload = this.isRegister()
        ? await this.api.register({
            email: this.email,
            password: this.password,
            fullName: this.fullName,
            craft: this.craft.trim() || null,
          })
        : await this.api.login(this.email, this.password);
      this.session.start(payload.token, payload.expiresAt, payload.user);
      const target = this.volver();
      await this.router.navigateByUrl(target?.startsWith('/') ? target : '/patrones');
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
