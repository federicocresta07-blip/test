/**
 * Calculo del overall segun la posicion (seccion 25).
 *
 * No hay una unica formula: cada posicion tiene su tabla de pesos. Un DC vive
 * de definicion, posicionamiento y velocidad; un DFC de marcaje, quite, fuerza
 * y juego aereo. Los pesos se normalizan, asi que se pueden editar libremente
 * sin preocuparse por que sumen exactamente 1.
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
  POR: {
    reflejos: 20,
    manos: 16,
    posicionamiento: 14,
    achique: 11,
    concentracion: 10,
    agilidad: 9,
    decisiones: 8,
    saque: 5,
    juegoAereo: 4,
    salto: 3,
    paseCorto: 2,
    fuerza: 2,
  },
  DFC: {
    marcaje: 17,
    quite: 15,
    posicionamiento: 14,
    fuerza: 11,
    juegoAereo: 11,
    concentracion: 10,
    salto: 6,
    decisiones: 6,
    velocidad: 4,
    aceleracion: 3,
    paseCorto: 3,
    control: 2,
    paseLargo: 2,
    agresividad: 2,
    trabajoEquipo: 2,
    resistencia: 2,
  },
  LD: {
    velocidad: 12,
    aceleracion: 10,
    resistencia: 10,
    marcaje: 11,
    quite: 10,
    posicionamiento: 9,
    centros: 9,
    paseCorto: 6,
    control: 5,
    concentracion: 5,
    fuerza: 4,
    regate: 4,
    tecnica: 3,
    decisiones: 3,
    trabajoEquipo: 3,
    juegoAereo: 2,
  },
  LI: {
    velocidad: 12,
    aceleracion: 10,
    resistencia: 10,
    marcaje: 11,
    quite: 10,
    posicionamiento: 9,
    centros: 9,
    paseCorto: 6,
    control: 5,
    concentracion: 5,
    fuerza: 4,
    regate: 4,
    tecnica: 3,
    decisiones: 3,
    trabajoEquipo: 3,
    juegoAereo: 2,
  },
  MCD: {
    quite: 15,
    marcaje: 12,
    posicionamiento: 13,
    paseCorto: 11,
    decisiones: 10,
    concentracion: 8,
    resistencia: 7,
    fuerza: 6,
    trabajoEquipo: 5,
    vision: 5,
    paseLargo: 4,
    control: 4,
    tecnica: 3,
    juegoAereo: 3,
    agresividad: 2,
  },
  MC: {
    paseCorto: 15,
    vision: 13,
    decisiones: 12,
    tecnica: 10,
    control: 10,
    paseLargo: 8,
    posicionamiento: 6,
    resistencia: 6,
    quite: 5,
    concentracion: 5,
    regate: 5,
    marcaje: 4,
    trabajoEquipo: 4,
    velocidad: 4,
    fuerza: 3,
    aceleracion: 2,
    remate: 2,
    definicion: 2,
    agilidad: 1,
  },
  MCO: {
    vision: 15,
    paseCorto: 13,
    tecnica: 12,
    control: 11,
    regate: 10,
    decisiones: 9,
    remate: 6,
    definicion: 5,
    aceleracion: 5,
    agilidad: 4,
    paseLargo: 4,
    posicionamiento: 4,
    velocidad: 3,
    tirosLibres: 2,
    resistencia: 2,
  },
  ED: {
    regate: 14,
    aceleracion: 13,
    velocidad: 13,
    tecnica: 10,
    control: 9,
    centros: 9,
    agilidad: 7,
    definicion: 6,
    vision: 5,
    decisiones: 4,
    paseCorto: 4,
    resistencia: 4,
    remate: 3,
    posicionamiento: 3,
  },
  EI: {
    regate: 14,
    aceleracion: 13,
    velocidad: 13,
    tecnica: 10,
    control: 9,
    centros: 9,
    agilidad: 7,
    definicion: 6,
    vision: 5,
    decisiones: 4,
    paseCorto: 4,
    resistencia: 4,
    remate: 3,
    posicionamiento: 3,
  },
  SD: {
    definicion: 15,
    posicionamiento: 12,
    control: 10,
    tecnica: 10,
    aceleracion: 9,
    remate: 8,
    regate: 8,
    velocidad: 7,
    vision: 6,
    decisiones: 6,
    paseCorto: 4,
    agilidad: 3,
    juegoAereo: 2,
  },
  DC: {
    definicion: 20,
    posicionamiento: 15,
    remate: 11,
    velocidad: 9,
    aceleracion: 9,
    tecnica: 7,
    control: 7,
    juegoAereo: 7,
    decisiones: 6,
    fuerza: 5,
    salto: 4,
    regate: 4,
    vision: 3,
    concentracion: 2,
  },
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
