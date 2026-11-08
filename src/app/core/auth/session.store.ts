import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  craft: string | null;
}

interface StoredSession {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

const KEY = 'patronlab.session';

/** The signed-in artisan. The token lives in localStorage and is dropped once expired. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly session = signal<StoredSession | null>(read());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isSignedIn = computed(() => this.session() !== null);

  token(): string | null {
    const session = this.session();
    if (!session) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.clear();
      return null;
    }
    return session.token;
  }

  start(token: string, expiresAt: string, user: SessionUser): void {
    const session = { token, expiresAt, user };
    this.session.set(session);
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // Private mode: the session lasts until the tab closes.
    }
  }

  clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing stored.
    }
  }
}

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    return Date.parse(session.expiresAt) > Date.now() ? session : null;
  } catch {
    return null;
  }
}
