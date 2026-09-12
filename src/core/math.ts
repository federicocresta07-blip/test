/** Utilidades numericas compartidas por el motor. */

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Recorta a la escala de atributos/valoraciones del juego (1..100). */
export function clampRating(value: number): number {
  return clamp(value, 1, 100);
}

/** Interpola linealmente el valor de `x` desde [inMin,inMax] hacia [outMin,outMax]. */
export function mapRange(
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const t = clamp((x - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

/** Media ponderada; devuelve 0 si el peso total es 0. */
export function weightedMean(
  entries: readonly { value: number; weight: number }[],
): number {
  let sum = 0;
  let weight = 0;
  for (const e of entries) {
    if (e.weight <= 0) continue;
    sum += e.value * e.weight;
    weight += e.weight;
  }
  return weight > 0 ? sum / weight : 0;
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
