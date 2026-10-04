export type Vector = number[];
export type Keyframe = { t: number; s: Vector; e?: Vector };
export type AnimatedValue = { a: number; k: number | Vector | Keyframe[] };
export type PathValue = { i: Vector[]; o: Vector[]; v: Vector[]; c: boolean };

export function sampleLottieValue(value: AnimatedValue, frame: number): Vector {
  if (value.a === 0)
    return Array.isArray(value.k) ? (value.k as Vector) : [value.k as number];
  const keys = value.k as Keyframe[];
  if (!keys.length) return [0];
  for (let index = 0; index < keys.length - 1; index += 1) {
    const current = keys[index];
    const next = keys[index + 1];
    if (frame >= next.t) continue;
    const raw = Math.max(
      0,
      Math.min(1, (frame - current.t) / (next.t - current.t)),
    );
    const eased = raw * raw * (3 - 2 * raw);
    const end = current.e ?? next.s;
    return current.s.map(
      (start, component) => start + ((end[component] ?? start) - start) * eased,
    );
  }
  return keys[keys.length - 1].s;
}

export function lottiePathData(path: PathValue): string {
  const points = path.v;
  if (!points.length) return "";
  let result = `M${points[0][0]} ${points[0][1]}`;
  const count = path.c ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % points.length;
    const outgoing = path.o[index];
    const incoming = path.i[next];
    result += ` C${points[index][0] + outgoing[0]} ${points[index][1] + outgoing[1]} ${points[next][0] + incoming[0]} ${points[next][1] + incoming[1]} ${points[next][0]} ${points[next][1]}`;
  }
  return path.c ? `${result}Z` : result;
}
