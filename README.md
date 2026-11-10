# PatronLab 2.0 · Modo Barniz de Pasto

[![CI](https://github.com/UbeimarY/patronlab-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/UbeimarY/patronlab-frontend/actions/workflows/ci.yml)

Editor interactivo de patrones y de **Barniz de Pasto mopa-mopa** para artesanos y diseñadores:
planea láminas de mopa-mopa estiradas sobre platos, cuencos, cajas y bandejas de madera esmaltada
con pan de oro o plata, recorta motivos con la herramienta **Bisturí**, aplica **simetría radial**
en vivo, vectoriza bocetos por capas con inteligencia artificial, evoluciona variaciones marcando
favoritas y calcula el aprovechamiento de material por lámina o por rollo.

La API vive en [`patronlab-backend`](https://github.com/UbeimarY/patronlab-backend)
(FastAPI + GraphQL + PostgreSQL).

---

## Qué puede hacer el artesano

| Función | Cómo funciona |
|---|---|
| **Dos modos de trabajo** | **Barniz de Pasto** (madera esmaltada, pan de oro/plata, láminas semitranslúcidas teñidas con anilina recortadas al contorno del objeto) y **Patrón de corte** (tapete milimetrado verde para fieltro, tela, cuero, madera láser, acrílico o papel). |
| **Herramienta Bisturí (`path`)** | Tecla `B`: clic para agregar puntos, arrastrar para curva suavizada, doble clic o clic en el primer punto para cerrar el corte. Edición de nodos en vivo: arrastrar para mover, doble clic sobre un tramo para insertar nodo y `Supr` para borrarlo. |
| **Panel de láminas de mopa-mopa** | Hasta 12 láminas ordenadas por orden de aplicación sobre la madera. Visibilidad, bloqueo, reordenamiento, aplicar color a toda la lámina y exportación de un SVG individual por lámina. |
| **Simetría radial en vivo** | Activa entre `N = 2` y `24` copias alrededor del centro del objeto con opción de **espejo alterno**. Las copias son piezas reales del documento v2 y se regeneran en vivo mientras arrastras o giras la pieza fuente. |
| **Selección múltiple y alineación** | `Shift + clic` o rectángulo de selección; agrupar y desagrupar; alinear (izquierda, centro X/Y, derecha, arriba, abajo), distribuir y voltear horizontal o verticalmente. |
| **IA: De boceto a láminas** | Sube una foto o dibujo (reducido en el navegador a máximo 1600 px), ajusta número de láminas (2 a 8), detalle y área mínima, previsualiza el resultado y aplícalo con una animación que coloca las láminas una por una (en un solo paso de deshacer). |
| **IA: Evolución interactiva y Frente de Pareto** | Deslizadores de peso por criterio (equilibrio, sin encimar, contraste, cobertura), marca variaciones favoritas con ⭐ para cruzarlas en la siguiente generación, gráfica de progreso y diagrama de dispersión interactivo del **Frente de Pareto**. |
| **IA: Contraste de color (ΔE) y armonías** | Detecta si dos láminas vecinas casi no se distinguen ($\Delta E$), muestra nombres de color en español y sugiere armonías aplicables con un clic. |
| **IA: Plan de material por lámina y rollo** | Calcula el área en $\text{cm}^2$, el número de láminas de mopa-mopa necesarias según el tamaño de lámina configurado, el porcentaje de desperdicio y exporta un SVG a escala real por lámina o para cortadora láser. |
| **Vista 3D e impresión 1:1** | Vista 3D interactiva del plato, cuenco, caja o bandeja con iluminación y reflejo especular del pan de oro al arrastrar; e impresión a escala real `1:1` dividida en hojas **A4** o **Carta** con marcas de unión (`+`) para calcar sobre la madera. |
| **Paleta de comandos y recorrido guiado** | `Ctrl + K` para buscar y ejecutar cualquier acción del taller, `?` para ver la tabla de atajos y recorrido guiado de 4 pasos la primera vez. |
| **Móvil (360–430 px)** | Barra inferior de herramientas, paneles en hoja deslizable (*bottom sheet*) y gestos táctiles de dos dedos para desplazar y pellizcar para hacer zoom. |

---

## Sobre el oficio del Barniz de Pasto mopa-mopa

En **2020**, la UNESCO inscribió los *conocimientos y técnicas tradicionales asociados al Barniz de Pasto mopa-mopa de Putumayo y Nariño* en la Lista del Patrimonio Cultural Inmaterial que requiere medidas urgentes de salvaguardia. Quedan aproximadamente **10 recolectores**, **9 maestros carpinteros** y **36 barnizadores**.

El proceso comprende ocho etapas: recolección de brotes de mopa-mopa en el Putumayo, limpieza con agua hirviendo y macerado con *maceta* sobre *yunque*, teñido con *anilina* (a partir de su tono natural verde oliva), preparación de la madera con *esmalte* (y aplicación previa de pan de oro o plata si lleva metal), estirado de la resina en **láminas delgadísimas**, aplicación con el calor de la mano superponiendo capas de colores, recorte con **bisturí** y fijación con calor.

> **Nota de respeto cultural:** *PatronLab ayuda a planear el diseño; no reemplaza el oficio ni a los maestros barnizadores.* Todas las plantillas incluidas se denominan **"inspiradas en la región"**, nunca "tradicionales".

Fuentes verificadas (disponibles también dentro de la aplicación en `/oficio`):
- UNESCO (2020): <https://ich.unesco.org/es/USL/01599>
- Ministerio de Cultura de Colombia — PES Barniz mopa-mopa: <https://patrimonio.mincultura.gov.co/Documents/PES%20BARNIZ%20MOPA%20MOPA.pdf>
- Cancillería de Colombia — Dossier Barniz de Pasto: <https://argentina.embajada.gov.co/sites/default/files/DOSSIER%20BARNIZ%20DE%20PASTO.pdf>

---

## Arquitectura del editor y rendimiento (INP < 200 ms con 300 piezas)

El editor mantiene una respuesta fluida incluso con 300 piezas simultáneas porque divide el dibujo en tres lienzos Canvas 2D apilados y actualiza solo lo indispensable en cada fotograma:

| Capa (canvas apilados) | Qué dibuja | Cuándo se repinta |
|---|---|---|
| `background` | Madera laqueada, pan de oro/plata y bisel del objeto (o tapete milimetrado en modo patrón) | Al cambiar dimensiones/objeto o cuando termina el zoom |
| `shapes` | Todas las piezas visibles recortadas (`clip`) al contorno del objeto, en orden de lámina | Cuando cambia el documento en firme |
| `interaction` | Pieza o grupo radial en movimiento, guías de alineación, nodos del Bisturí y marco de selección | En cada `requestAnimationFrame` durante un gesto |

- **Levantamiento de piezas y grupos radiales (`liftedIds`):** Al iniciar un arrastre, la pieza fuente y sus copias radiales se excluyen una sola vez de la capa `shapes`, y durante todo el movimiento solo se repinta la capa `interaction`.
- **Pan y zoom en el compositor:** Mover y escalar la mesa aplica `transform: translate3d(...) scale(...)` en CSS; al detenerse el zoom se re-rasterizan los lienzos para conservar bordes nítidos.
- **Medidor INP en vivo:** La barra inferior mide *Interaction to Next Paint* con `PerformanceObserver` (`type: 'event'`). Incluye el comando **"Generar 300 piezas de prueba"** en `Ctrl + K` y el script `scripts/benchmark-inp-300.mjs` para verificar que el INP se mantenga muy por debajo de 200 ms.

---

## Ejecución local y pruebas

Requisitos: Node 22+ y la API en `http://localhost:8002`.

```bash
npm ci
npm start                  # Servidor de desarrollo en http://localhost:4200
npm run format:check       # Verificación de formato con Prettier
npm run test:ci            # Pruebas unitarias con Vitest (48 tests)
npm run build              # Compilación de producción en dist/
node scripts/benchmark-inp-300.mjs   # Recorrido Playwright + medición INP con 300 piezas
```

---

## Guion de demostración de 5 minutos (Sustentación)

1. **Galería y Nuevo Barniz (0:00 – 0:45):** En `/patrones`, mostrar la cabecera ilustrada del plato mopa-mopa y los filtros por modo/material. Abrir **"Nuevo Barniz de Pasto"**, elegir **Plato de 300 mm**, esmalte negro (`#1b1512`) y **Pan de oro**, observando la vista previa en vivo antes de crear.
2. **De boceto a láminas con animación (0:45 – 1:30):** En el editor, abrir la pestaña **IA**, pulsar **"Probar boceto de colibrí"** (o subir un boceto), ajustar a **4 láminas**, ver el tiempo en ms y las notas, y pulsar **"Aplicar láminas con animación"** para ver cómo se adhieren una a una sobre el plato.
3. **Retoque con Bisturí y simetría radial de 6 (1:30 – 2:30):** Presionar `B` para activar el **Bisturí**, trazar un pétalo cerrándolo en el primer punto, hacer doble clic en un tramo para insertar un nodo y ajustarlo. En el panel **Pieza**, activar **Simetría radial** con `N = 6` y arrastrar la pieza fuente alineándola con las guías inteligentes en milímetros.
4. **Evolución interactiva y Frente de Pareto (2:30 – 3:15):** En la pestaña **IA**, ajustar los deslizadores de peso, generar variaciones, marcar **2 favoritas con ⭐**, pulsar **"Siguiente generación"** para ver la gráfica de evolución y abrir el **Frente de Pareto** pasando el cursor por los puntos para previsualizar y aplicar.
5. **Plan de material por lámina y exportación SVG (3:15 – 3:50):** En la sección de material por lámina, revisar la tabla con área en $\text{cm}^2$, láminas necesarias y desperdicio, y pulsar **"Exportar un SVG por lámina"**.
6. **Vista 3D e impresión a escala real (3:50 – 4:20):** Abrir la pestaña **Vista**, girar con el cursor el plato en **Objeto 3D** para apreciar el brillo del pan de oro bajo la luz, y descargar las hojas **A4** a escala `1:1` con marcas de unión.
7. **Sobre el oficio (4:20 – 4:40):** Hacer clic en **"Sobre el oficio"** (`/oficio`) para mostrar los datos de la UNESCO (2020), las 8 etapas del mopa-mopa, los enlaces oficiales y la nota de respeto cultural.
8. **Medidor INP con 300 piezas y conflicto de versiones (4:40 – 5:00):** Volver al editor, abrir `Ctrl + K`, ejecutar **"Generar 300 piezas de prueba"**, arrastrar piezas mostrando el indicador **INP en verde (< 200 ms)** y ejecutar **"Simular conflicto de versiones"** para mostrar el diálogo seguro de resolución (`VERSION_CONFLICT`).
