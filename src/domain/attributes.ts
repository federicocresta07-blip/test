/**
 * Atributos futbolisticos (seccion 25).
 *
 * Todos usan la misma escala 1..100 y en todos un valor mayor es mejor.
 * Las claves estan en castellano porque son vocabulario de dominio del juego.
 */

/** Atributos fisicos. */
export const PHYSICAL_ATTRIBUTES = [
  'velocidad',
  'aceleracion',
  'resistencia',
  'fuerza',
  'salto',
  'agilidad',
] as const;

/** Atributos tecnicos. */
export const TECHNICAL_ATTRIBUTES = [
  'paseCorto',
  'paseLargo',
  'centros',
  'tecnica',
  'control',
  'regate',
  'definicion',
  'remate',
  'juegoAereo',
  'tirosLibres',
  'penales',
] as const;

/** Atributos defensivos. */
export const DEFENSIVE_ATTRIBUTES = ['marcaje', 'quite'] as const;

/** Atributos mentales. */
export const MENTAL_ATTRIBUTES = [
  'vision',
  'decisiones',
  'posicionamiento',
  'concentracion',
  'agresividad',
  'trabajoEquipo',
] as const;

/**
 * Atributos exclusivos de arquero (seccion 45).
 * Un jugador de campo los tiene en valores bajos y no afectan su overall.
 */
export const GOALKEEPING_ATTRIBUTES = [
  'reflejos',
  'manos',
  'achique',
  'saque',
] as const;

export const ATTRIBUTE_KEYS = [
  ...PHYSICAL_ATTRIBUTES,
  ...TECHNICAL_ATTRIBUTES,
  ...DEFENSIVE_ATTRIBUTES,
  ...MENTAL_ATTRIBUTES,
  ...GOALKEEPING_ATTRIBUTES,
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/** Ficha completa de atributos de un jugador. */
export type Attributes = Readonly<Record<AttributeKey, number>>;

/** Atributos parciales, para construir jugadores sin escribir las 23 claves. */
export type PartialAttributes = Partial<Record<AttributeKey, number>>;

/** Valor por defecto de un atributo no especificado (jugador de liga media-baja). */
export const DEFAULT_ATTRIBUTE = 50;

/** Valor por defecto de los atributos de arquero en un jugador de campo. */
export const DEFAULT_GK_ATTRIBUTE_FOR_OUTFIELD = 12;

/**
 * Completa una ficha parcial de atributos.
 * `isGoalkeeper` solo cambia el relleno por defecto de los atributos de arquero.
 */
export function buildAttributes(
  partial: PartialAttributes,
  isGoalkeeper = false,
): Attributes {
  const out = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    const given = partial[key];
    if (given !== undefined) {
      out[key] = clampAttribute(given);
      continue;
    }
    const isGkKey = (GOALKEEPING_ATTRIBUTES as readonly string[]).includes(key);
    out[key] = isGkKey && !isGoalkeeper
      ? DEFAULT_GK_ATTRIBUTE_FOR_OUTFIELD
      : DEFAULT_ATTRIBUTE;
  }
  return out;
}

export function clampAttribute(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ATTRIBUTE;
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** Media simple de un subconjunto de atributos. */
export function averageOf(
  attributes: Attributes,
  keys: readonly AttributeKey[],
): number {
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) total += attributes[k];
  return total / keys.length;
}
