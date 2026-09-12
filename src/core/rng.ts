/**
 * Generador de numeros pseudoaleatorios con semilla.
 *
 * Todo el azar del motor pasa por aqui: con la misma semilla y las mismas
 * entradas, un partido se resuelve siempre igual. Eso permite reproducir
 * partidos, depurar y correr calibraciones comparables (seccion 52).
 */
export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number | string = 1) {
    const h = typeof seed === 'string' ? hashString(seed) : Math.trunc(seed) || 1;
    // splitmix32 para expandir la semilla a 128 bits de estado.
    let x = h >>> 0;
    const next = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Entero sin signo de 32 bits (xoshiro128**). */
  nextUint32(): number {
    const result = (Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Flotante uniforme en [0, 1). */
  next(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** Entero uniforme en [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.min(n - 1, Math.floor(this.next() * n));
  }

  /** Entero uniforme en [min, max] inclusive. */
  intBetween(min: number, max: number): number {
    if (max <= min) return min;
    return min + this.int(max - min + 1);
  }

  /** true con probabilidad p. */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }

  /** Normal(mean, sd) por Box-Muller. */
  normal(mean = 0, sd = 1): number {
    let u = this.next();
    while (u <= Number.EPSILON) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /**
   * Normal truncada a +/- `maxSd` desviaciones.
   * El motor la usa para que el azar nunca produzca saltos absurdos
   * (seccion 41: azar controlado, no azar libre).
   */
  boundedNormal(mean = 0, sd = 1, maxSd = 2.5): number {
    const z = clampNumber(this.normal(0, 1), -maxSd, maxSd);
    return mean + sd * z;
  }

  /** Poisson(lambda) — Knuth para lambda chico, PTRS-lite por normal para lambda grande. */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda < 30) {
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k += 1;
        p *= this.next();
      } while (p > limit);
      return k - 1;
    }
    return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
  }

  /** Elige un indice segun pesos relativos (no necesitan sumar 1). */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return this.int(weights.length);
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= Math.max(0, weights[i] ?? 0);
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

}

function rotl(x: number, k: number): number {
  return (((x << k) | (x >>> (32 - k))) >>> 0);
}

function clampNumber(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** FNV-1a, para convertir semillas de texto en enteros estables. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0 || 1;
}
