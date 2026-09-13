/**
 * Calculo del overall segun la posicion (seccion 25).
 *
 * No hay una unica formula: cada posicion tiene su tabla de pesos. Un DC vive
 * del remate, la velocidad y el empuje; un DFC de las entradas y la
 * agresividad. Los pesos se normalizan, asi que se pueden editar libremente
 * sin preocuparse por que sumen exactamente 100.
 *
 * SOBRE LA BAJA A DIEZ ATRIBUTOS. Estas tablas tenian veintinueve claves.
 * Al pasar a los diez de PC Futbol se fusionaron los pesos de los que
 * colapsaban en el mismo atributo, y despues se reequilibraron a mano: la
 * suma directa dejaba `calidad` en el 46% del overall de un MC, porque absorbio
 * seis atributos viejos (tecnica, control, vision, decisiones, concentracion y
 * trabajo de equipo). Un atributo que pesa casi la mitad vuelve irrelevantes a
 * los otros nueve.
 *
 * Cada tabla suma 100 para que el peso se lea como porcentaje.
 */

import type { AttributeKey, Attributes } from '../domain/attributes.ts';
import { clampRating, weightedMean } from '../core/math.ts';
import type { Position } from '../domain/positions.ts';

export type AttributeWeights = Partial<Record<AttributeKey, number>>;

/**
 * Tablas de pesos por posicion.
 * Leer cada bloque como "que hace importante a un jugador en este puesto".
 */
export const POSITION_WEIGHTS: Readonly<Record<Position, AttributeWeights>> = {
  // El arquero tiene un solo atributo de puesto, asi que pesa mucho por
  // definicion. Lo demas es lo poco que PC Futbol permite distinguir: si sale
  // rapido del arco y si juega bien con los pies.
  POR: { portero: 62, calidad: 18, velocidad: 10, agresividad: 6, pase: 4 },

  DFC: { entradas: 38, agresividad: 26, calidad: 18, velocidad: 10, pase: 5, resistencia: 3 },

  LD: { entradas: 26, velocidad: 22, pase: 17, calidad: 17, resistencia: 9, regate: 5, agresividad: 4 },
  LI: { entradas: 26, velocidad: 22, pase: 17, calidad: 17, resistencia: 9, regate: 5, agresividad: 4 },

  MCD: { entradas: 34, calidad: 28, pase: 16, agresividad: 12, resistencia: 8, velocidad: 2 },

  MC: { calidad: 34, pase: 26, entradas: 14, resistencia: 8, velocidad: 7, regate: 6, tiro: 3, agresividad: 2 },

  MCO: { calidad: 33, pase: 21, regate: 14, velocidad: 11, tiro: 9, remate: 6, entradas: 4, resistencia: 2 },

  ED: { velocidad: 29, calidad: 22, regate: 18, pase: 14, remate: 8, tiro: 4, resistencia: 4, entradas: 1 },
  EI: { velocidad: 29, calidad: 22, regate: 18, pase: 14, remate: 8, tiro: 4, resistencia: 4, entradas: 1 },

  SD: { remate: 22, calidad: 24, velocidad: 19, regate: 12, tiro: 10, pase: 7, entradas: 4, agresividad: 2 },

  // El 9 clasico: el remate primero, y el empuje fisico para ganar la posicion.
  DC: { remate: 28, calidad: 20, velocidad: 18, agresividad: 16, tiro: 12, regate: 4, entradas: 2 },
};

/**
 * Overall de un jugador en una posicion concreta (1..100).
 * Es el overall "de puesto": el mismo jugador vale distinto como DC que como DFC.
 */
export function overallForPosition(
  attributes: Attributes,
  position: Position,
): number {
  const weights = POSITION_WEIGHTS[position];
  const entries: { value: number; weight: number }[] = [];
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const weight = weights[key];
    if (weight === undefined || weight <= 0) continue;
    entries.push({ value: attributes[key], weight });
  }
  return clampRating(Math.round(weightedMean(entries)));
}

/** Overall sin redondear, para calculos internos que no deben perder precision. */
export function preciseOverallForPosition(
  attributes: Attributes,
  position: Position,
): number {
  const weights = POSITION_WEIGHTS[position];
  const entries: { value: number; weight: number }[] = [];
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const weight = weights[key];
    if (weight === undefined || weight <= 0) continue;
    entries.push({ value: attributes[key], weight });
  }
  return clampRating(weightedMean(entries));
}

/** Mejor posicion posible del jugador segun sus atributos. */
export function bestPosition(attributes: Attributes): {
  position: Position;
  overall: number;
} {
  let best: { position: Position; overall: number } | undefined;
  for (const position of Object.keys(POSITION_WEIGHTS) as Position[]) {
    const overall = preciseOverallForPosition(attributes, position);
    if (!best || overall > best.overall) best = { position, overall };
  }
  return best ?? { position: 'MC', overall: 1 };
}
