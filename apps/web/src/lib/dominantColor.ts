export type RGB = [number, number, number];

/**
 * Picks a representative color from RGBA pixel data. Saturated pixels count far more than
 * grey ones, so a colorful cover isn't averaged down to mud; a grey cover still yields grey.
 * The result is capped in brightness so white text stays readable on top of it.
 */
export function pickDominant(data: ArrayLike<number>): RGB | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // transparent
    const pr = data[i]!;
    const pg = data[i + 1]!;
    const pb = data[i + 2]!;
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const weight = saturation * saturation + 0.05;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  if (total === 0) return null;
  const avg: RGB = [r / total, g / total, b / total];
  const brightest = Math.max(...avg);
  const scale = brightest > 190 ? 190 / brightest : 1;
  return avg.map((c) => Math.round(c * scale)) as RGB;
}

const cache = new Map<string, RGB | null>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to read pixels; Audius content nodes allow it
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = url;
  });
}

/** Samples the first loadable URL. Resolves null (never throws) if none can be read. */
export async function getDominantColor(urls: string[]): Promise<RGB | null> {
  for (const url of urls) {
    if (cache.has(url)) return cache.get(url)!;
    try {
      const img = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 24;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, 24, 24);
      const color = pickDominant(ctx.getImageData(0, 0, 24, 24).data);
      cache.set(url, color);
      return color;
    } catch {
      // This node was down or blocked pixel access: try the next mirror.
    }
  }
  return null;
}
