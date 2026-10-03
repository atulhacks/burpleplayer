import { playerApi } from "./playerApi";
import type { Track } from "./playerApi";

const fallbackColors = [
  "#4fbde9",
  "#8060d9",
  "#ef82af",
  "#8edc6a",
  "#ffda51",
  "#ed6756",
];
const cache = new Map<number, string>();

export function fallbackCubeColor(track: Track): string {
  return fallbackColors[Math.abs(track.id) % fallbackColors.length];
}

export async function cubeColorForTrack(track: Track): Promise<string> {
  const cached = cache.get(track.id);
  if (cached) return cached;
  const fallback = fallbackCubeColor(track);
  if (!track.hasArt) {
    cache.set(track.id, fallback);
    return fallback;
  }

  try {
    const art = await playerApi.getAlbumArt(track.id);
    if (!art) return fallback;
    const blob = new Blob([Uint8Array.from(art.bytes)], { type: art.mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return fallback;
      context.drawImage(image, 0, 0, 32, 32);
      const data = context.getImageData(0, 0, 32, 32).data;
      const weight = new Float32Array(12);
      const hueSum = new Float32Array(12);
      for (let offset = 0; offset < data.length; offset += 16) {
        if (data[offset + 3] < 160) continue;
        const r = data[offset] / 255;
        const g = data[offset + 1] / 255;
        const b = data[offset + 2] / 255;
        const high = Math.max(r, g, b);
        const low = Math.min(r, g, b);
        const delta = high - low;
        const lightness = (high + low) / 2;
        const saturation = delta / (1 - Math.abs(2 * lightness - 1) || 1);
        if (saturation < 0.19 || lightness < 0.14 || lightness > 0.89) continue;
        let hue = 0;
        if (high === r) hue = ((g - b) / delta) % 6;
        else if (high === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue = (hue * 60 + 360) % 360;
        const bucket = Math.floor(hue / 30);
        const score = saturation * (1 - Math.abs(lightness - 0.55));
        weight[bucket] += score;
        hueSum[bucket] += hue * score;
      }
      const bucket = weight.indexOf(Math.max(...weight));
      if (weight[bucket] === 0) return fallback;
      const hue = Math.round(hueSum[bucket] / weight[bucket]);
      const color = `hsl(${hue} 70% 67%)`;
      cache.set(track.id, color);
      return color;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return fallback;
  }
}
