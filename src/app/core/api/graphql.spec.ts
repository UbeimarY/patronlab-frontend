import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../auth/session.store';
import { ApiError, GraphqlClient, describeError } from './graphql';

describe('GraphqlClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));

  it('sends the token and returns data', async () => {
    const session = TestBed.inject(SessionStore);
    session.start('abc', new Date(Date.now() + 60_000).toISOString(), {
      id: '1',
      email: 'a@b.co',
      fullName: 'Ana',
      craft: null,
    });
    respond({ data: { me: { id: '1' } } });
    const data = await TestBed.inject(GraphqlClient).request<{ me: { id: string } }>(
      '{ me { id } }',
    );
    expect(data.me.id).toBe('1');
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc' });
  });

  it('turns GraphQL errors into ApiError with code and details', async () => {
    respond({
      errors: [{ message: 'Cambió', extensions: { code: 'VERSION_CONFLICT', currentVersion: 7 } }],
    });
    const error = (await TestBed.inject(GraphqlClient)
      .request('mutation { x }')
      .catch((e: ApiError) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VERSION_CONFLICT');
    expect(error.details).toEqual({ currentVersion: 7 });
  });

  it('signs out and goes to the login page when the session expired on the server', async () => {
    const session = TestBed.inject(SessionStore);
    session.start('old', new Date(Date.now() + 60_000).toISOString(), {
      id: '1',
      email: 'a@b.co',
      fullName: 'Ana',
      craft: null,
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    respond({ errors: [{ message: 'Inicia sesión', extensions: { code: 'UNAUTHENTICATED' } }] });
    await TestBed.inject(GraphqlClient)
      .request('{ me { id } }')
      .catch(() => undefined);
    expect(session.isSignedIn()).toBe(false);
    expect(navigate).toHaveBeenCalled();
  });

  it('explains network failures in plain words', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = (await TestBed.inject(GraphqlClient)
      .request('{ me { id } }')
      .catch((e: ApiError) => e)) as ApiError;
    expect(error.code).toBe('NETWORK');
    expect(describeError(new ApiError('X', 'Unexpected error'))).toBe(
      'Algo falló en el servidor. Intenta de nuevo.',
    );
  });
});
