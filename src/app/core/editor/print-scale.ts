import { PatternDocument } from './document';
import { isShapeVisible, orderedShapesForRender, outline } from './geometry';

export type PaperSize = 'A4' | 'LETTER';

const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number; label: string }> = {
  A4: { width: 210, height: 297, label: 'A4 (210 × 297 mm)' },
  LETTER: { width: 216, height: 279, label: 'Carta (216 × 279 mm)' },
};

/**
 * Generates a self-contained, real-scale tiled SVG/HTML print sheet with alignment
 * registration marks (`+`) so the artisan can print on A4 or Letter paper, tape the
 * sheets together, and trace the motif onto the wooden object.
 */
export function buildTiledPrintHtml(
  document: PatternDocument,
  title: string,
  paper: PaperSize = 'A4',
): { html: string; cols: number; rows: number; totalSheets: number } {
  const spec = PAPER_DIMENSIONS[paper];
  const margin = 12;
  const usableW = spec.width - margin * 2;
  const usableH = spec.height - margin * 2;
  const cols = Math.max(1, Math.ceil(document.width / usableW));
  const rows = Math.max(1, Math.ceil(document.height / usableH));
  const totalSheets = cols * rows;

  const shapesSvg = orderedShapesForRender(document)
    .filter((s) => isShapeVisible(document, s))
    .map((s) => {
      const pts = outline(s)
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ');
      return `<polygon points="${pts}" fill="none" stroke="${s.fill}" stroke-width="0.45"/>`;
    })
    .join('\n');

  const pages: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = c * usableW;
      const offsetY = r * usableH;
      const pageNum = r * cols + c + 1;
      pages.push(`
        <section class="sheet">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="${spec.width}mm"
            height="${spec.height}mm"
            viewBox="0 0 ${spec.width} ${spec.height}"
          >
            <!-- Registration marks at the 4 corners of the usable area -->
            <g stroke="#1d1a17" stroke-width="0.3" fill="none">
              <rect x="${margin}" y="${margin}" width="${usableW}" height="${usableH}" stroke-dasharray="2 2" stroke="#888888"/>
              <path d="M${margin - 4},${margin} H${margin + 4} M${margin},${margin - 4} V${margin + 4}"/>
              <path d="M${margin + usableW - 4},${margin} H${margin + usableW + 4} M${margin + usableW},${margin - 4} V${margin + usableW + 4}"/>
              <path d="M${margin - 4},${margin + usableH} H${margin + 4} M${margin},${margin + usableH - 4} V${margin + usableH + 4}"/>
              <path d="M${margin + usableW - 4},${margin + usableH} H${margin + usableW + 4} M${margin + usableW},${margin + usableH - 4} V${margin + usableH + 4}"/>
            </g>
            <text x="${margin}" y="${margin - 3}" font-family="sans-serif" font-size="3.2" fill="#444">
              ${escapeHtml(title)} · Hoja ${pageNum}/${totalSheets} (Fila ${r + 1}, Col ${c + 1}) · Escala 1:1 (${spec.label})
            </text>
            <g transform="translate(${margin - offsetX} ${margin - offsetY})">
              <rect x="0" y="0" width="${document.width}" height="${document.height}" fill="none" stroke="#b3202a" stroke-width="0.3"/>
              ${shapesSvg}
            </g>
          </svg>
        </section>
      `);
    }
  }

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} · Impresión a escala real 1:1</title>
  <style>
    @page { size: ${spec.width}mm ${spec.height}mm; margin: 0; }
    body { margin: 0; background: #e8e4dc; font-family: system-ui, sans-serif; }
    .sheet {
      width: ${spec.width}mm;
      height: ${spec.height}mm;
      background: #ffffff;
      margin: 8mm auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
      page-break-after: always;
    }
    @media print {
      body { background: #ffffff; }
      .sheet { margin: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;

  return { html, cols, rows, totalSheets };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
