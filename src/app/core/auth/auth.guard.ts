import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionStore } from './session.store';

export const signedIn: CanActivateFn = (_, state) => {
  const session = inject(SessionStore);
  return session.token()
    ? true
    : inject(Router).createUrlTree(['/entrar'], { queryParams: { volver: state.url } });
};

export const signedOut: CanActivateFn = () =>
  inject(SessionStore).token() ? inject(Router).createUrlTree(['/patrones']) : true;
