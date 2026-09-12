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

/** Desvios tipicos por puesto respecto del nivel general del jugador. */
const POSITION_PROFILE: Readonly<Record<Position, PartialAttributes>> = {
  POR: {
    reflejos: 12, manos: 10, achique: 6, saque: 2, agilidad: 6, posicionamiento: 8,
    concentracion: 6, velocidad: -22, aceleracion: -20, regate: -30, definicion: -35,
    remate: -30, marcaje: -25, quite: -25, centros: -25, juegoAereo: -6, tirosLibres: -15,
    penales: -20, resistencia: -12, salto: 2, fuerza: 0, paseCorto: -8, paseLargo: -4,
    tecnica: -12, control: -12, vision: -10, agresividad: -12, trabajoEquipo: -4, decisiones: 2,
  },
  DFC: {
    marcaje: 12, quite: 10, juegoAereo: 12, fuerza: 10, salto: 9, posicionamiento: 8,
    concentracion: 6, agresividad: 6, velocidad: -4, aceleracion: -6, regate: -16,
    definicion: -20, remate: -12, centros: -14, vision: -10, tecnica: -8, control: -6,
    paseCorto: -2, paseLargo: 0, tirosLibres: -12, penales: -14, agilidad: -8,
    resistencia: 0, trabajoEquipo: 4, decisiones: 2,
  },
  LD: {
    velocidad: 10, aceleracion: 10, resistencia: 12, centros: 10, marcaje: 4, quite: 4,
    regate: 2, juegoAereo: -10, salto: -8, fuerza: -6, definicion: -16, remate: -10,
    vision: -4, tirosLibres: -8, penales: -12, posicionamiento: 0, trabajoEquipo: 4,
    concentracion: 0, agresividad: 2, tecnica: 0, control: 0, paseCorto: 0, paseLargo: -2,
    agilidad: 4, decisiones: 0,
  },
  LI: {
    velocidad: 10, aceleracion: 10, resistencia: 12, centros: 10, marcaje: 4, quite: 4,
    regate: 2, juegoAereo: -10, salto: -8, fuerza: -6, definicion: -16, remate: -10,
    vision: -4, tirosLibres: -8, penales: -12, posicionamiento: 0, trabajoEquipo: 4,
    concentracion: 0, agresividad: 2, tecnica: 0, control: 0, paseCorto: 0, paseLargo: -2,
    agilidad: 4, decisiones: 0,
  },
  MCD: {
    quite: 12, marcaje: 8, posicionamiento: 8, resistencia: 8, paseCorto: 6, fuerza: 6,
    concentracion: 6, trabajoEquipo: 8, agresividad: 4, decisiones: 4, velocidad: -6,
    aceleracion: -6, regate: -8, definicion: -18, remate: -10, centros: -8, vision: 0,
    tecnica: -2, control: 0, paseLargo: 2, juegoAereo: 2, salto: 0, tirosLibres: -6,
    penales: -10, agilidad: -4,
  },
  MC: {
    paseCorto: 10, vision: 10, tecnica: 8, control: 8, decisiones: 8, paseLargo: 6,
    resistencia: 6, trabajoEquipo: 6, quite: 2, regate: 2, marcaje: -4, juegoAereo: -10,
    salto: -8, fuerza: -4, velocidad: -4, aceleracion: -4, definicion: -10, remate: -2,
    centros: -2, posicionamiento: 0, concentracion: 2, agresividad: -2, tirosLibres: 2,
    penales: -2, agilidad: 0,
  },
  MCO: {
    vision: 12, tecnica: 12, control: 10, paseCorto: 10, regate: 10, decisiones: 6,
    remate: 4, tirosLibres: 6, agilidad: 6, definicion: 0, marcaje: -18, quite: -14,
    fuerza: -10, juegoAereo: -12, salto: -10, resistencia: -4, concentracion: -2,
    agresividad: -8, trabajoEquipo: -2, velocidad: 0, aceleracion: 2, centros: 4,
    paseLargo: 4, posicionamiento: 0, penales: 4,
  },
  ED: {
    regate: 14, velocidad: 14, aceleracion: 14, agilidad: 10, centros: 10, tecnica: 8,
    control: 6, definicion: 2, remate: 0, vision: 2, marcaje: -18, quite: -16,
    fuerza: -10, juegoAereo: -14, salto: -8, concentracion: -4, agresividad: -6,
    resistencia: 2, trabajoEquipo: -2, posicionamiento: -2, paseCorto: 0, paseLargo: -4,
    tirosLibres: 0, penales: 0, decisiones: 0,
  },
  EI: {
    regate: 14, velocidad: 14, aceleracion: 14, agilidad: 10, centros: 10, tecnica: 8,
    control: 6, definicion: 2, remate: 0, vision: 2, marcaje: -18, quite: -16,
    fuerza: -10, juegoAereo: -14, salto: -8, concentracion: -4, agresividad: -6,
    resistencia: 2, trabajoEquipo: -2, posicionamiento: -2, paseCorto: 0, paseLargo: -4,
    tirosLibres: 0, penales: 0, decisiones: 0,
  },
  SD: {
    definicion: 12, posicionamiento: 10, control: 8, tecnica: 8, regate: 8, aceleracion: 8,
    remate: 6, velocidad: 6, vision: 4, marcaje: -20, quite: -18, juegoAereo: -6,
    salto: -4, fuerza: -4, concentracion: -2, agresividad: -4, trabajoEquipo: -4,
    resistencia: -2, paseCorto: 0, paseLargo: -6, centros: -6, tirosLibres: -2,
    penales: 4, decisiones: 2, agilidad: 4,
  },
  DC: {
    definicion: 14, posicionamiento: 12, remate: 10, juegoAereo: 10, fuerza: 8, salto: 8,
    velocidad: 6, aceleracion: 6, marcaje: -22, quite: -20, vision: -6, paseLargo: -10,
    centros: -10, regate: 0, tecnica: 2, control: 2, paseCorto: -4, concentracion: 0,
    agresividad: 0, trabajoEquipo: -4, resistencia: -2, tirosLibres: -4, penales: 8,
    decisiones: 0, agilidad: 0,
  },
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
    const isGkAttribute = key === 'reflejos' || key === 'manos' || key === 'achique' || key === 'saque';
    if (isGkAttribute && !isGk) {
      out[key] = 12;
      continue;
    }
    out[key] = clamp(Math.round(level + (profile[key] ?? 0) + (jitter[key] ?? 0)), 1, 99);
  }
  return out;
}
