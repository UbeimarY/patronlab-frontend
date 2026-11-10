import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ProcessStep {
  number: number;
  title: string;
  detail: string;
}

@Component({
  selector: 'app-craft-page',
  imports: [RouterLink],
  template: `
    <header class="bar">
      <a class="brand" routerLink="/patrones">PatronLab</a>
      <a class="back" routerLink="/patrones">← Volver a mis diseños</a>
    </header>

    <main class="craft-page">
      <section class="hero-card">
        <p class="eyebrow">Patrimonio Cultural Inmaterial · UNESCO 2020</p>
        <h1>Sobre el oficio del Barniz de Pasto mopa-mopa</h1>
        <p class="lead">
          En <strong>2020</strong>, la UNESCO inscribió los
          <em
            >conocimientos y técnicas tradicionales asociados al Barniz de Pasto mopa-mopa de
            Putumayo y Nariño</em
          >
          en la Lista del Patrimonio Cultural Inmaterial que requiere medidas urgentes de
          salvaguardia.
        </p>
        <div class="figures" role="list" aria-label="Portadores del oficio">
          <div class="stat" role="listitem">
            <strong>~10</strong>
            <span>recolectores de mopa-mopa en el Putumayo</span>
          </div>
          <div class="stat" role="listitem">
            <strong>9</strong>
            <span>maestros carpinteros y torneros</span>
          </div>
          <div class="stat" role="listitem">
            <strong>36</strong>
            <span>maestros y practicantes barnizadores</span>
          </div>
        </div>
      </section>

      <aside class="respect-note" role="note">
        <strong>Nota de respeto cultural:</strong>
        <p>
          PatronLab ayuda a planear el diseño; no reemplaza el oficio ni a los maestros
          barnizadores. Las plantillas incluidas en el programa son diseños originales
          <strong>inspirados en la región</strong>.
        </p>
      </aside>

      <section class="process-section" aria-labelledby="process-heading">
        <h2 id="process-heading">Las ocho etapas del oficio</h2>
        <p class="muted">
          Desde los bosques húmedos del piedemonte amazónico hasta los talleres de Pasto, cada
          objeto reúne tres saberes: recolección silvestre, carpintería de madera y decoración con
          resina estirada.
        </p>
        <ol class="steps-grid">
          @for (step of steps; track step.number) {
            <li class="step-card">
              <span class="step-num">{{ step.number }}</span>
              <h3>{{ step.title }}</h3>
              <p>{{ step.detail }}</p>
            </li>
          }
        </ol>
      </section>

      <section class="metal-objects">
        <div class="info-card">
          <h2>Pan de oro, plata y objetos de madera</h2>
          <p>
            Cuando el diseño lleva reflejos metálicos, el <strong>dorado o plateado</strong> se
            aplica sobre la madera <strong>antes</strong> de extender la resina de mopa-mopa. Al
            superponer las láminas semitranslúcidas teñidas con anilina, el metal brilla a través de
            la resina y en los filetes recortados.
          </p>
          <p>
            Los objetos más trabajados en los talleres son <strong>platos</strong>,
            <strong>cuencos</strong>, <strong>cajas</strong> y <strong>bandejas</strong> de madera.
          </p>
        </div>

        <div class="info-card sources">
          <h2>Fuentes oficiales verificadas</h2>
          <ul>
            <li>
              <a
                href="https://ich.unesco.org/es/USL/01599"
                target="_blank"
                rel="noopener noreferrer"
              >
                UNESCO (2020) — Conocimientos y técnicas tradicionales asociados al Barniz de Pasto
                mopa-mopa de Putumayo y Nariño (USL 01599)
              </a>
            </li>
            <li>
              <a
                href="https://patrimonio.mincultura.gov.co/Documents/PES%20BARNIZ%20MOPA%20MOPA.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ministerio de Cultura de Colombia — Plan Especial de Salvaguardia (PES) del Barniz
                de Pasto mopa-mopa (PDF)
              </a>
            </li>
            <li>
              <a
                href="https://argentina.embajada.gov.co/sites/default/files/DOSSIER%20BARNIZ%20DE%20PASTO.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cancillería de Colombia — Dossier Barniz de Pasto (PDF)
              </a>
            </li>
          </ul>
        </div>
      </section>
    </main>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.7rem 24px;
      background: var(--barniz-wood);
      border-bottom: 1px solid rgb(201 155 46 / 0.35);
      color: #f6efe4;
    }
    .brand {
      font-family: var(--font-display);
      font-size: 1.25rem;
      color: var(--gold-bright);
      text-decoration: none;
    }
    .back {
      font-size: 0.9rem;
      color: #f6efe4;
      text-decoration: none;
      padding: 0.3rem 0.65rem;
      border-radius: var(--radius);
    }
    .back:hover {
      background: rgb(255 255 255 / 0.12);
    }
    .craft-page {
      max-width: 1020px;
      margin: 0 auto;
      padding: 2rem 24px 4rem;
      display: grid;
      gap: 1.75rem;
    }
    .hero-card {
      padding: 2rem;
      border-radius: 12px;
      background:
        radial-gradient(circle at 85% 20%, rgb(201 155 46 / 0.18), transparent 55%),
        linear-gradient(135deg, #1b1411 0%, #261b15 100%);
      border: 1px solid rgb(201 155 46 / 0.45);
      color: #f7efe2;
      display: grid;
      gap: 1rem;
    }
    .eyebrow {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gold-bright);
      font-weight: 650;
    }
    h1 {
      font-size: clamp(1.6rem, 3vw, 2.35rem);
      color: #fbf6ee;
    }
    .lead {
      font-size: 1rem;
      color: #ded4c7;
      max-width: 72ch;
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 0.85rem;
      margin-top: 0.5rem;
    }
    .stat {
      padding: 0.85rem 1rem;
      border-radius: 8px;
      background: rgb(255 255 255 / 0.06);
      border: 1px solid rgb(201 155 46 / 0.3);
      display: grid;
      gap: 0.2rem;
    }
    .stat strong {
      font-family: var(--font-display);
      font-size: 1.75rem;
      color: var(--gold-bright);
    }
    .stat span {
      font-size: 0.85rem;
      color: #d9cfc2;
    }
    .respect-note {
      padding: 1rem 1.25rem;
      border-left: 4px solid var(--gold);
      background: var(--paper-2);
      border-radius: 6px;
      display: grid;
      gap: 0.25rem;
    }
    .process-section {
      display: grid;
      gap: 0.9rem;
    }
    .muted {
      color: var(--muted);
    }
    .steps-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.9rem;
    }
    .step-card {
      padding: 1rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      display: grid;
      gap: 0.4rem;
      align-content: start;
    }
    .step-num {
      display: inline-grid;
      place-items: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--barniz-wood);
      color: var(--gold-bright);
      font-size: 0.8rem;
      font-weight: 650;
    }
    .step-card p {
      font-size: 0.88rem;
      color: var(--muted);
    }
    .metal-objects {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }
    .info-card {
      padding: 1.25rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      display: grid;
      gap: 0.65rem;
      align-content: start;
    }
    .sources ul {
      margin: 0;
      padding-left: 1.1rem;
      display: grid;
      gap: 0.5rem;
    }
    .sources a {
      color: var(--primary);
      text-decoration: underline;
      font-weight: 550;
    }
    @media (max-width: 600px) {
      .craft-page,
      .bar {
        padding-left: 16px;
        padding-right: 16px;
      }
      .hero-card {
        padding: 1.35rem;
      }
    }
  `,
})
export class CraftPage {
  readonly steps: ProcessStep[] = [
    {
      number: 1,
      title: 'Recolección en el Putumayo',
      detail: 'Brotes del arbusto silvestre mopa-mopa recolectados en las selvas del Putumayo.',
    },
    {
      number: 2,
      title: 'Limpieza y macerado',
      detail:
        'Limpieza en agua hirviendo y macerado con maceta sobre yunque para separar las impurezas vegetales.',
    },
    {
      number: 3,
      title: 'Teñido con anilina',
      detail:
        'La masa limpia (de color natural verde oliva) se tiñe con anilinas para lograr rojos, amarillos, azules y verdes vivos.',
    },
    {
      number: 4,
      title: 'Preparación de la madera',
      detail:
        'El objeto de madera se encola, se lija con cuidado y se pinta con esmalte de base (y dorado o plateado si lleva metal).',
    },
    {
      number: 5,
      title: 'Estirado en láminas',
      detail:
        'El maestro barnizador calienta la resina y la estira hasta obtener láminas delgadísimas y uniformes.',
    },
    {
      number: 6,
      title: 'Aplicación y superposición',
      detail:
        'La lámina se adhiere con el calor de la mano sobre el objeto y se superponen capas de distintos colores.',
    },
    {
      number: 7,
      title: 'Recorte con bisturí',
      detail:
        'Con pulso firme se recorta la lámina con bisturí siguiendo los motivos geométricos, florales o de fauna.',
    },
    {
      number: 8,
      title: 'Fijación con calor',
      detail: 'Finalmente la decoración se fija con calor para proteger el brillo y los cortes.',
    },
  ];
}
