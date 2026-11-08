import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main>
      <h1>Esta página no existe</h1>
      <p>Puede que el enlace esté incompleto o que el patrón se haya borrado.</p>
      <a class="btn primary" routerLink="/patrones">Ir a mis patrones</a>
    </main>
  `,
  styles: `
    main {
      display: grid;
      gap: 1rem;
      justify-items: start;
      max-width: 40rem;
      margin: 15vh auto;
      padding: 0 16px;
    }
  `,
})
export class NotFoundPage {}
