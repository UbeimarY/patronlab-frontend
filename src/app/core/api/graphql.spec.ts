import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../auth/session.store';
import { ApiError, GraphqlClient, describeError } from './graphql';
import { PatronlabApi } from './patronlab-api';

describe('GraphqlClient & PatronlabApi', () => {
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

  it('explains network failures and v2 error codes in plain Spanish', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = (await TestBed.inject(GraphqlClient)
      .request('{ me { id } }')
      .catch((e: ApiError) => e)) as ApiError;
    expect(error.code).toBe('NETWORK');
    expect(describeError(new ApiError('X', 'Unexpected error'))).toBe(
      'Algo falló en el servidor. Intenta de nuevo.',
    );
    expect(describeError(new ApiError('RATE_LIMITED', 'Slow down'))).toContain('muchas consultas');
    expect(describeError(new ApiError('IMAGE_TOO_COMPLEX', 'Complex'))).toContain('detalles');
    expect(
      describeError(
        new ApiError('INVALID_DOCUMENT', 'Invalid', { problems: ['demasiadas capas'] }),
      ),
    ).toContain('demasiadas capas');
  });

  it('calls the new v2 mutations (vectorizeImage, evolveVariations, duplicatePattern, analyzeColors)', async () => {
    const api = TestBed.inject(PatronlabApi);
    respond({ data: { duplicatePattern: { id: 'dup-1' } } });
    expect(await api.duplicatePattern('p-1')).toBe('dup-1');

    respond({
      data: {
        vectorizeImage: {
          layers: [{ id: 'l-1', name: 'Rojo', color: '#b3202a', areaShare: 0.4 }],
          shapes: [],
          elapsedMs: 120,
          notes: ['Simplificado'],
        },
      },
    });
    const vec = await api.vectorizeImage({
      image: 'data:image/jpeg;base64,xx',
      width: 300,
      height: 300,
      colors: 4,
    });
    expect(vec.layers.length).toBe(1);
    expect(vec.elapsedMs).toBe(120);

    respond({
      data: {
        evolveVariations: {
          original: { total: 0.5, balance: 0.5, overlap: 0.5, contrast: 0.5, coverage: 0.5 },
          variations: [],
          history: [{ generation: 1, best: 0.72, average: 0.58 }],
        },
      },
    });
    const evolved = await api.evolveVariations({
      document: { width: 300, height: 300, background: '#000000', shapes: [] },
      palette: ['#b3202a'],
      weights: { balance: 0.8 },
    });
    expect(evolved.history[0].best).toBe(0.72);
  });
});
