import { PatternDocument } from './document';
import { outline } from './geometry';

/** A real-size SVG (millimeters): opens in Inkscape, Illustrator or laser-cutter software. */
export function toSvg(document: PatternDocument, title: string): string {
  const pieces = document.shapes
    .map((shape) => {
      const points = outline(shape)
        .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
        .join(' ');
      return `  <polygon id="${escape(shape.id)}" points="${points}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="0.3"/>`;
    })
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}mm" height="${document.height}mm" viewBox="0 0 ${document.width} ${document.height}">`,
    `  <title>${escape(title)}</title>`,
    `  <rect width="${document.width}" height="${document.height}" fill="${document.background}"/>`,
    pieces,
    '</svg>',
    '',
  ].join('\n');
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(window.document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'patron'
  );
}
