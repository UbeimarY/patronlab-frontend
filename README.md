# PatronLab

[![CI](https://github.com/UbeimarY/patronlab-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/UbeimarY/patronlab-frontend/actions/workflows/ci.yml)

Pattern editor for artisans: draw the pieces of a cushion, a bag or a laser-cut ornament,
take colors from a photo of your real materials, compare AI-suggested variations, and get a
cutting plan that wastes less material. Every save is a version you can go back to.

The API lives in [`patronlab-backend`](https://github.com/UbeimarY/patronlab-backend)
(FastAPI + GraphQL + PostgreSQL).

## What the artisan can do

| Feature | How |
|---|---|
| Draw | Six piece shapes, drag to move, corner handle to resize (Shift keeps proportions), top handle to rotate (Shift snaps to 15°), precise values in the inspector. |
| Undo and redo | Ctrl + Z, Ctrl + Shift + Z: 100 exact snapshots; a whole drag is one step. |
| Live preview | The design on felt, fabric, leather, wood, acrylic or paper, as one piece or as a repeating print, updated while dragging. |
| AI: palette | Upload a photo; k-means finds its main colors (the photo is shrunk to 400 px in the browser first). |
| AI: variations | Evolutionary search proposes 4 recolored and slightly rearranged versions, each with its score. |
| AI: cutting plan | Pieces nested on the roll and a short cutting route, compared with a naive layout. |
| Versions | Save with a note, view and restore old versions. Two tabs editing the same pattern never overwrite each other (see below). |
| Export | Real-size SVG (millimeters) for Inkscape or a laser cutter, and JSON. |

## Performance by design

The editor stays responsive with hundreds of pieces because each kind of change touches as
little as possible:

| Layer (stacked canvases) | Shows | Redrawn when |
|---|---|---|
| Background | Material color and millimeter grid | The sheet is resized, or zoom settles |
| Shapes | Every piece | The document changes |
| Interaction | Selection, handles, the piece in motion | Every frame of a gesture |

- **Layered canvas.** When a drag starts, the piece is lifted out of the shapes layer once;
  during the drag only the interaction layer is repainted.
- **One render per frame.** Pointer events arrive faster than the screen refreshes; the
  editor keeps the latest one and works inside `requestAnimationFrame`.
- **Compositor pan and zoom.** Moving and scaling the sheet is a CSS `transform`, applied by the
  GPU without repainting. After zooming stops, canvases are re-rasterized at the new resolution so
  edges stay sharp.
- **Signals, zoneless.** Angular updates only the bindings whose signals changed.
- **INP measured live.** The status bar shows Interaction to Next Paint from the Event Timing API
  (`PerformanceObserver`, same rule as Chrome: worst interaction, one outlier ignored per 50).
  Good is 200 ms or less; the editor typically reports 15 to 60 ms.

Initial JavaScript: about 66 kB compressed; the editor is a lazy-loaded chunk (17 kB).

## Saving safely

Each save sends the version it started from. If the pattern was saved somewhere else in the
meantime, the API answers `VERSION_CONFLICT` and the editor offers two honest choices: save these
changes as a new pattern, or discard them and open the latest version. Nothing is overwritten
silently. Unsaved changes are flagged, and closing the tab asks first.

## Accessibility

Keyboard shortcuts for every editing action, a pieces list that selects shapes without the
canvas, visible focus, labels on every control, Spanish UI with `lang="es"`, reduced motion
respected, and light and dark themes.

## Tech stack

Angular 21 (standalone, signals, zoneless) · Canvas 2D · a minimal typed GraphQL client over
`fetch` · Vitest · self-hosted fonts (Fontsource) · Netlify.

## Run locally

Requirements: Node 22+ and the API on `http://localhost:8002`.

```bash
npm ci
npm start            # http://localhost:4200
npm run test:ci      # unit tests
npm run build        # production build in dist/
```

## Deploy (Netlify)

Import the repository in Netlify: `netlify.toml` sets the build, the SPA redirect, the security
headers (CSP limited to the API's origin) and long-term caching for hashed bundles. Then add the
Netlify address to the API's `CORS_ORIGINS`.

## Project status

Course project for *Programación Orientada a la Web*, Universidad Cooperativa de Colombia, Pasto.
