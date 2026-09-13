/**
 * LOS DIEZ ATRIBUTOS.
 *
 * Son exactamente los diez que guarda PC Fútbol, con sus nombres y en su
 * orden. Todos en escala 1..100 y en todos un valor mayor es mejor.
 *
 * ============================================================
 * POR QUÉ DIEZ Y NO VEINTINUEVE
 * ============================================================
 *
 * El motor tenía veintinueve atributos. Los planteles del juego salen de
 * `EQ003003.PKF`, que guarda diez, así que diecinueve se derivaban de los que
 * sí estaban: `vision` de calidad, `centros` de pase, `manos` de portero.
 *
 * Esa capa era la parte más débil de todo el proyecto. Diecinueve números por
 * jugador que parecían datos y eran nuestra estimación, y ninguna forma de
 * verificarlos contra nada: no hay fuente que diga cuál era la `concentracion`
 * de Berizzo.
 *
 * Con diez atributos no hay nada que derivar. Lo que el juego usa es lo que el
 * archivo guarda.
 *
 * ============================================================
 * QUÉ SE PERDIÓ, Y ES UN COSTO REAL
 * ============================================================
 *
 * Los veintinueve distinguían cosas que estos diez no:
 *
 * - El juego aéreo ya no es un atributo. Un central que salta y un central que
 *   no saltan igual; lo más cercano que guarda el archivo es la agresividad.
 * - Los tiros libres y los penales no se separan de la potencia de disparo:
 *   los tres son `tiro`.
 * - El arquero tiene un solo número. Antes tenía reflejos, manos, achique y
 *   saque por separado, así que un arquero podía ser seguro abajo y flojo por
 *   arriba. Ahora no.
 * - La concentración, las decisiones, la visión y el trabajo de equipo
 *   desaparecen dentro de `calidad`. Un volante lúcido y uno técnico pero
 *   desatento ya no se distinguen.
 *
 * Se acepta a cambio de que cada número del juego sea verificable. Cuando
 * aparezca una fuente con más granularidad, agregar atributos es agregar
 * claves acá; inventarlos no era el camino.
 */

/** Físicos. */
export const PHYSICAL_ATTRIBUTES = ['velocidad', 'resistencia', 'agresividad'] as const;

/** Técnicos. */
export const TECHNICAL_ATTRIBUTES = ['calidad', 'remate', 'regate', 'pase', 'tiro'] as const;

/** Defensivos. */
export const DEFENSIVE_ATTRIBUTES = ['entradas'] as const;

/**
 * Exclusivo de arquero. Un jugador de campo lo tiene en valores bajos y no
 * afecta su overall.
 */
export const GOALKEEPING_ATTRIBUTES = ['portero'] as const;

/**
 * Los diez, en el orden en que están en el archivo de PC Fútbol:
 * VE velocidad, RE resistencia, AG agresividad, CA calidad, RM remate,
 * RG regate, PA pase, TI tiro, EN entradas, PO portero.
 */
export const ATTRIBUTE_KEYS = [
  'velocidad',
  'resistencia',
  'agresividad',
  'calidad',
  'remate',
  'regate',
  'pase',
  'tiro',
  'entradas',
  'portero',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];

/** Ficha completa de atributos de un jugador. */
export type Attributes = Readonly<Record<AttributeKey, number>>;

/** Atributos parciales, para construir jugadores sin escribir las diez claves. */
export type PartialAttributes = Partial<Record<AttributeKey, number>>;

/**
 * Siglas de dos letras, las mismas que usaba PC Fútbol en su ficha.
 * Las usa la interfaz cuando no hay lugar para el nombre completo.
 */
export const ATTRIBUTE_CODES: Readonly<Record<AttributeKey, string>> = {
  velocidad: 'VE',
  resistencia: 'RE',
  agresividad: 'AG',
  calidad: 'CA',
  remate: 'RM',
  regate: 'RG',
  pase: 'PA',
  tiro: 'TI',
  entradas: 'EN',
  portero: 'PO',
};

/**
 * QUÉ ABSORBIÓ CADA UNO.
 *
 * Sirve para leer el motor: cuando una mecánica dice `agresividad` donde antes
 * decía `juegoAereo`, esta tabla explica por qué. Y sirve para discutirlo: cada
 * fila es una decisión de modelado, no un hecho.
 */
export const ATTRIBUTE_ABSORBED: Readonly<Record<AttributeKey, readonly string[]>> = {
  velocidad: ['velocidad', 'aceleracion', 'agilidad'],
  resistencia: ['resistencia'],
  agresividad: ['agresividad', 'fuerza', 'salto', 'juegoAereo'],
  calidad: ['tecnica', 'control', 'vision', 'decisiones', 'concentracion', 'trabajoEquipo'],
  remate: ['definicion'],
  regate: ['regate'],
  pase: ['paseCorto', 'paseLargo', 'centros'],
  tiro: ['remate', 'tirosLibres', 'penales'],
  entradas: ['entradas', 'quite', 'marcaje', 'posicionamiento'],
  portero: ['portero', 'reflejos', 'manos', 'achique', 'saque'],
};

/** Valor por defecto de un atributo no especificado (jugador de liga media-baja). */
export const DEFAULT_ATTRIBUTE = 50;

/** Valor por defecto del atributo de arquero en un jugador de campo. */
export const DEFAULT_GK_ATTRIBUTE_FOR_OUTFIELD = 12;

/**
 * Completa una ficha parcial de atributos.
 * `isGoalkeeper` solo cambia el relleno por defecto del atributo de arquero.
 */
export function buildAttributes(partial: PartialAttributes, isGoalkeeper = false): Attributes {
  const out = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    const given = partial[key];
    if (given !== undefined) {
      out[key] = clampAttribute(given);
      continue;
    }
    const isGkKey = (GOALKEEPING_ATTRIBUTES as readonly string[]).includes(key);
    out[key] =
      isGkKey && !isGoalkeeper ? DEFAULT_GK_ATTRIBUTE_FOR_OUTFIELD : DEFAULT_ATTRIBUTE;
  }
  return out;
}

export function clampAttribute(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ATTRIBUTE;
  return Math.max(1, Math.min(100, Math.round(value)));
}

/** Media simple de un subconjunto de atributos. */
export function averageOf(attributes: Attributes, keys: readonly AttributeKey[]): number {
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) total += attributes[k];
  return total / keys.length;
}
