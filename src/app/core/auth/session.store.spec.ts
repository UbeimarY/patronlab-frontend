import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SessionStore } from './session.store';

describe('SessionStore', () => {
  beforeEach(() => localStorage.clear());

  it('forgets an expired token', () => {
    const store = TestBed.inject(SessionStore);
    store.start('t', new Date(Date.now() - 1000).toISOString(), {
      id: '1',
      email: 'a@b.co',
      fullName: 'Ana',
      craft: null,
    });
    expect(store.token()).toBeNull();
    expect(store.isSignedIn()).toBe(false);
  });
});
