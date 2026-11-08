import { Routes } from '@angular/router';

import { signedIn, signedOut } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'patrones' },
  {
    path: 'entrar',
    canActivate: [signedOut],
    title: 'Entrar · PatronLab',
    data: { mode: 'login' },
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'registro',
    canActivate: [signedOut],
    title: 'Crear cuenta · PatronLab',
    data: { mode: 'register' },
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'patrones',
    canActivate: [signedIn],
    title: 'Mis patrones · PatronLab',
    loadComponent: () => import('./pages/patterns/patterns.page').then((m) => m.PatternsPage),
  },
  {
    path: 'patrones/:id',
    canActivate: [signedIn],
    title: 'Editor · PatronLab',
    loadComponent: () => import('./pages/editor/editor.page').then((m) => m.EditorPage),
  },
  {
    path: '**',
    title: 'Página no encontrada · PatronLab',
    loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage),
  },
];
