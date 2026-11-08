/**
 * Procedural textures, so the preview suggests the real material without image files.
 * Generated once per material and reused as a canvas pattern.
 */
const cache = new Map<string, HTMLCanvasElement>();

export function materialTexture(material: string, color: string): HTMLCanvasElement {
  const key = `${material}:${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);
  const random = seeded(material.length * 7919);

  if (material === 'wood') {
    for (let y = 0; y < 128; y += 3) {
      ctx.strokeStyle = `rgba(80, 45, 15, ${0.05 + random() * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(40, y + random() * 4 - 2, 88, y + random() * 4 - 2, 128, y);
      ctx.stroke();
    }
  } else if (material === 'fabric') {
    for (let i = 0; i < 128; i += 2) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(i, 0, 1, 128);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(0, i, 128, 1);
    }
  } else if (material === 'acrylic') {
    const gradient = ctx.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  } else {
    // Felt, leather and paper: fine irregular speckle.
    const dots = material === 'leather' ? 900 : 1600;
    for (let i = 0; i < dots; i++) {
      const light = random() > 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(random() * 128, random() * 128, 1 + random(), 1 + random());
    }
  }
  cache.set(key, canvas);
  return canvas;
}

function seeded(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
