/**
 * Dimensiones de fuerza de equipo (seccion 30).
 *
 * El motor nunca trabaja con "la media del equipo": calcula estas nueve
 * capacidades y cada etapa de la simulacion usa las que le corresponden.
 */

export const DIMENSIONS = [
  'ataque',
  'mediocampo',
  'defensa',
  'arquero',
  'fisico',
  'creacion',
  'presion',
  'contraataque',
  'balonParado',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export type DimensionRatings = Readonly<Record<Dimension, number>>;

export type DimensionModifiers = Partial<Record<Dimension, number>>;

export function emptyModifiers(): Record<Dimension, number> {
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) out[d] = 0;
  return out;
}
