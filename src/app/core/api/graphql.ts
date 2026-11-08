import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { SessionStore } from '../auth/session.store';

/** An error the API explained, with its stable code (VERSION_CONFLICT, NOT_FOUND...). */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface GraphqlResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

/**
 * A deliberately small GraphQL client: one POST per operation, typed results,
 * errors turned into ApiError. The editor needs no cache layer (it owns its
 * document state), so a full client library would only add weight.
 */
@Injectable({ providedIn: 'root' })
export class GraphqlClient {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = this.session.token();
    let response: Response;
    try {
      response = await fetch(environment.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ApiError('NETWORK', 'No hay conexión con el servidor. Revisa tu internet.');
    }
    let body: GraphqlResponse<T>;
    try {
      body = (await response.json()) as GraphqlResponse<T>;
    } catch {
      throw new ApiError('SERVER', `El servidor respondió con un error (${response.status}).`);
    }
    const error = body.errors?.[0];
    if (error) {
      const { code, ...details } = error.extensions ?? {};
      const apiError = new ApiError(String(code ?? 'SERVER'), error.message, details);
      if (apiError.code === 'UNAUTHENTICATED' && token) {
        this.session.clear();
        void this.router.navigate(['/entrar'], { queryParams: { volver: this.router.url } });
      }
      throw apiError;
    }
    if (!body.data) throw new ApiError('SERVER', 'Respuesta vacía del servidor.');
    return body.data;
  }
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'Unexpected error' || error.message === 'Unexpected error'
      ? 'Algo falló en el servidor. Intenta de nuevo.'
      : error.message;
  }
  return 'Algo salió mal. Intenta de nuevo.';
}
