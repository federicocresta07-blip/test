/**
 * Generador de planteles.
 *
 * Sirve para dos cosas: armar equipos de prueba con una calidad objetivo
 * (imprescindible para la calibracion de la seccion 52) y como ejemplo de
 * como se construyen jugadores con perfiles coherentes por puesto.
 */

import { clamp } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import {
  ATTRIBUTE_KEYS,
  buildAttributes,
  type AttributeKey,
  type PartialAttributes,
} from '../domain/attributes.ts';
import { createPlayer, type Player } from '../domain/player.ts';
import type { Position } from '../domain/positions.ts';
import { preciseOverallForPosition } from '../ratings/overall.ts';

/**
 * Desvios tipicos por puesto respecto del nivel general del jugador.
 *
 * Al bajar a diez atributos estos desvios se PROMEDIARON, no se sumaron: son
 * corrimientos sobre el nivel del jugador, no pesos de una media. Sumar los
 * cuatro que colapsaban en `agresividad` habria convertido un +9 en un +36.
 *
 * Y despues se ESCALARON al 60%. Con veintinueve atributos un desvio de +14 se
 * diluia entre muchos; con diez, cada atributo pesa el triple en el overall,
 * asi que el mismo desvio salia disparado: un DC de nivel 76 quedaba con
 * remate 91 y calidad 70, un especialista extremo que el generador no queria
 * hacer. Se midio generando planteles y mirando la dispersion.
 */
const POSITION_PROFILE: Readonly<Record<Position, PartialAttributes>> = {
  POR: { velocidad: -7, resistencia: -7, agresividad: -2, calidad: -3, remate: -21, regate: -18, pase: -7, tiro: -13, entradas: -15, portero: 5 },
  DFC: { velocidad: -4, agresividad: 5, calidad: -1, remate: -12, regate: -10, pase: -3, tiro: -8, entradas: 6 },
  LD: { velocidad: 5, resistencia: 7, agresividad: -4, remate: -10, regate: 1, pase: 2, tiro: -6, entradas: 2 },
  LI: { velocidad: 5, resistencia: 7, agresividad: -4, remate: -10, regate: 1, pase: 2, tiro: -6, entradas: 2 },
  MCD: { velocidad: -3, resistencia: 5, agresividad: 2, calidad: 2, remate: -11, regate: -5, tiro: -5, entradas: 5 },
  MC: { velocidad: -2, resistencia: 4, agresividad: -4, calidad: 4, remate: -6, regate: 1, pase: 3, tiro: -1, entradas: -1 },
  MCO: { velocidad: 2, resistencia: -2, agresividad: -6, calidad: 4, regate: 6, pase: 4, tiro: 3, entradas: -7 },
  ED: { velocidad: 8, resistencia: 1, agresividad: -6, calidad: 1, remate: 1, regate: 8, pase: 1, entradas: -7 },
  EI: { velocidad: 8, resistencia: 1, agresividad: -6, calidad: 1, remate: 1, regate: 8, pase: 1, entradas: -7 },
  SD: { velocidad: 4, resistencia: -1, agresividad: -2, calidad: 2, remate: 7, regate: 5, pase: -2, tiro: 2, entradas: -5 },
  DC: { velocidad: 2, resistencia: -1, agresividad: 4, calidad: -1, remate: 8, pase: -5, tiro: 3, entradas: -6 },
};

export type SquadShape = {
  readonly position: Position;
  /** Cuanto mejor o peor que el nivel del equipo es este puesto. */
  readonly delta: number;
};

/**
 * Plantel estandar: once titulares mas once de plantel.
 *
 * Son 22 jugadores a proposito. Una temporada con fechas seguidas acumula
 * fatiga, lesiones y suspensiones, y un plantel de 18 se queda sin gente
 * (seccion 48). Con 22 hay alternativa real en cada puesto.
 */
export const DEFAULT_SQUAD_SHAPE: readonly SquadShape[] = [
  // Titulares
  { position: 'POR', delta: 0 },
  { position: 'LD', delta: -1 },
  { position: 'DFC', delta: 1 },
  { position: 'DFC', delta: 0 },
  { position: 'LI', delta: -1 },
  { position: 'MCD', delta: 0 },
  { position: 'MC', delta: 1 },
  { position: 'MC', delta: -1 },
  { position: 'ED', delta: 1 },
  { position: 'DC', delta: 2 },
  { position: 'EI', delta: 0 },
  // Plantel
  { position: 'POR', delta: -9 },
  { position: 'DFC', delta: -6 },
  { position: 'DFC', delta: -8 },
  { position: 'LD', delta: -7 },
  { position: 'LI', delta: -7 },
  { position: 'MCD', delta: -6 },
  { position: 'MC', delta: -5 },
  { position: 'MCO', delta: -6 },
  { position: 'ED', delta: -6 },
  { position: 'EI', delta: -8 },
  { position: 'DC', delta: -5 },
];

export type BuildSquadOptions = {
  /** Overall medio buscado para el equipo. */
  readonly target: number;
  readonly prefix: string;
  readonly seed?: number | string;
  readonly shape?: readonly SquadShape[];
  /** Dispersion aleatoria de atributos dentro de cada jugador. */
  readonly noise?: number;
  readonly condition?: { form?: number; morale?: number; fatigue?: number; sharpness?: number };
};

/**
 * Arma un plantel cuyos jugadores quedan cerca del overall pedido.
 *
 * Se genera el perfil del puesto y despues se ajusta el nivel general del
 * jugador hasta que su overall coincide con el objetivo: asi la calibracion
 * puede pedir "un equipo de 82" y obtenerlo de verdad.
 */
export function buildSquad(options: BuildSquadOptions): Player[] {
  const rng = new Rng(options.seed ?? `${options.prefix}-${options.target}`);
  const shape = options.shape ?? DEFAULT_SQUAD_SHAPE;
  const noise = options.noise ?? 5;

  return shape.map((entry, index) => {
    const targetOverall = clamp(options.target + entry.delta, 20, 99);
    const attributes = generateAttributes(entry.position, targetOverall, noise, rng);
    const age = rng.intBetween(20, 34);
    return createPlayer({
      id: `${options.prefix}-${index + 1}`,
      name: `${options.prefix} ${entry.position}${index + 1}`,
      position: entry.position,
      age,
      attributes,
      consistency: clamp(Math.round(rng.normal(62, 12)), 25, 95),
      injuryProneness: clamp(Math.round(rng.normal(38, 15)), 5, 90),
      condition: {
        form: options.condition?.form ?? clamp(Math.round(rng.normal(56, 12)), 15, 95),
        morale: options.condition?.morale ?? clamp(Math.round(rng.normal(62, 12)), 15, 95),
        fatigue: options.condition?.fatigue ?? clamp(Math.round(rng.normal(14, 8)), 0, 60),
        sharpness: options.condition?.sharpness ?? clamp(Math.round(rng.normal(85, 7)), 40, 100),
      },
    });
  });
}

/**
 * Atributos de un jugador de un puesto con un overall objetivo, sin azar.
 *
 * `targetOverall` es el overall que va a tener el jugador en ese puesto, no un
 * nivel interno: pedir 84 devuelve un jugador de 84. `overrides` permite darle
 * rasgos propios (un 9 con definicion 92, por ejemplo) sin escribir los 26
 * atributos, y el resto del perfil se reescala para que el overall se mantenga.
 */
export function attributesFor(
  position: Position,
  targetOverall: number,
  overrides: PartialAttributes = {},
): PartialAttributes {
  return solveForOverall(position, targetOverall, {}, overrides);
}

function generateAttributes(
  position: Position,
  targetOverall: number,
  noise: number,
  rng: Rng,
): PartialAttributes {
  const jitter: Partial<Record<AttributeKey, number>> = {};
  for (const key of ATTRIBUTE_KEYS) jitter[key] = rng.boundedNormal(0, noise, 2);
  return solveForOverall(position, targetOverall, jitter, {});
}

/**
 * Busca el nivel interno que hace que el overall del jugador sea exactamente
 * el pedido. Los `overrides` quedan fijos y el resto del perfil se mueve.
 */
function solveForOverall(
  position: Position,
  targetOverall: number,
  jitter: Partial<Record<AttributeKey, number>>,
  overrides: PartialAttributes,
): PartialAttributes {
  const profile = POSITION_PROFILE[position];
  const isGoalkeeper = position === 'POR';
  let level = targetOverall;
  let attributes: PartialAttributes = {
    ...compose(position, profile, jitter, level),
    ...overrides,
  };

  for (let i = 0; i < 12; i += 1) {
    const overall = preciseOverallForPosition(buildAttributes(attributes, isGoalkeeper), position);
    const gap = targetOverall - overall;
    if (Math.abs(gap) < 0.2) break;
    // Los atributos fijos no se mueven, asi que el resto tiene que compensar
    // algo mas que la diferencia: se avanza con un paso amortiguado.
    level += gap * 1.35;
    attributes = { ...compose(position, profile, jitter, level), ...overrides };
  }
  return attributes;
}

function compose(
  position: Position,
  profile: PartialAttributes,
  jitter: Partial<Record<AttributeKey, number>>,
  level: number,
): PartialAttributes {
  const out: PartialAttributes = {};
  const isGk = position === 'POR';
  for (const key of ATTRIBUTE_KEYS) {
    // El unico atributo de arquero. Un jugador de campo lo tiene bajo y no
    // entra en su overall.
    if (key === 'portero' && !isGk) {
      out[key] = 12;
      continue;
    }
    out[key] = clamp(Math.round(level + (profile[key] ?? 0) + (jitter[key] ?? 0)), 1, 99);
  }
  return out;
}
