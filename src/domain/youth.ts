/**
 * INFERIORES Y SCOUTING JUVENIL (secciones 7, 8 — fase 4 del plan).
 *
 * Un juvenil tiene un potencial real, y el club NO lo conoce: conoce lo que le
 * dice el ojeador, que es un rango. Esa distincion es todo el modulo.
 *
 * Por que importa: si la pantalla mostrara el potencial exacto, el ojeador
 * juvenil no tendria para que existir y subirlo de nivel seria tirar plata.
 * Mostrando un rango cuyo ancho sale del efecto del ojeador —el mismo numero
 * que muestra la ficha del staff—, mejorar el scouting sirve para algo
 * concreto: firmar con menos riesgo.
 *
 * La regla del informe: el potencial real SIEMPRE cae dentro del rango. El
 * ojeador nunca miente, solo es impreciso. Pero el potencial no esta en el
 * centro del rango, asi que con un rango ancho el centro no es una buena
 * estimacion, y eso es exactamente lo que el manager tiene que sentir.
 */

import { clamp } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import type { Player } from './player.ts';
import type { Position } from './positions.ts';

/** Edad a la que un juvenil puede pasar al plantel profesional. */
export const MIN_PROMOTION_AGE = 17;

/** Edad a la que un juvenil deja de serlo: o sube o se va. */
export const YOUTH_MAX_AGE = 20;

/** Un jugador de las inferiores del club. */
export type YouthPlayer = {
  /** El jugador, con su potencial REAL. La interfaz no lo muestra. */
  readonly player: Player;
  /** De donde salio. Da color y contexto a la decision. */
  readonly origin: string;
  /** Anios que lleva en el club. */
  readonly yearsAtClub: number;
};

/** Cuanta confianza da un informe, derivada de su ancho. */
export type ScoutConfidence = 'muy baja' | 'baja' | 'media' | 'alta' | 'muy alta';

/**
 * Lo que el ojeador informa sobre un juvenil.
 *
 * `spread` es el margen en puntos que declara el rol en `domain/staff.ts`. El
 * rango es `[centro - spread, centro + spread]`, y el centro esta corrido
 * respecto del potencial real: por eso un rango ancho no se puede promediar
 * para adivinar la verdad.
 */
export type ScoutingReport = {
  readonly low: number;
  readonly high: number;
  /** Ancho total del rango, en puntos. */
  readonly width: number;
  readonly confidence: ScoutConfidence;
  /** Lo que el informe dice en una linea. */
  readonly summary: string;
};

export function confidenceOf(width: number): ScoutConfidence {
  if (width <= 8) return 'muy alta';
  if (width <= 13) return 'alta';
  if (width <= 19) return 'media';
  if (width <= 26) return 'baja';
  return 'muy baja';
}

/**
 * El informe del ojeador sobre un juvenil.
 *
 * `spread` viene de `staffEffect('Ojeador juvenil', ...).actual`: con el puesto
 * vacante es grande a proposito —el club mira a ciegas—, y con un ojeador de
 * cinco estrellas en una buena academia queda en unos cuatro puntos.
 */
export function scoutPotential(
  truePotential: number,
  spread: number,
  seed: string | number,
): ScoutingReport {
  const margin = Math.max(1, Math.round(spread));
  const rng = new Rng(`informe:${seed}`);

  // El centro se corre hasta medio margen: asi el real queda siempre dentro
  // del rango, pero no en el medio.
  const offset = Math.round(rng.intBetween(-margin, margin) / 2);
  const centre = clamp(truePotential + offset, 1, 100);

  const low = Math.round(clamp(centre - margin, 1, 100));
  const high = Math.round(clamp(centre + margin, 1, 100));
  // Si el recorte por los limites de la escala dejo al real afuera, se
  // ensancha: el contrato es que el real este dentro.
  const bounded = {
    low: Math.min(low, Math.round(truePotential)),
    high: Math.max(high, Math.round(truePotential)),
  };
  const width = bounded.high - bounded.low;

  return {
    ...bounded,
    width,
    confidence: confidenceOf(width),
    summary:
      width <= 8
        ? `Potencial entre ${bounded.low} y ${bounded.high}: un rango angosto, se puede decidir con esto.`
        : width <= 19
          ? `Potencial entre ${bounded.low} y ${bounded.high}. Un rango de ${width} puntos deja margen de error.`
          : `Potencial entre ${bounded.low} y ${bounded.high}: con un rango de ${width} puntos, firmarlo es una apuesta.`,
  };
}

/**
 * El potencial que la interfaz muestra cuando hay que mostrar UN numero.
 *
 * Es el centro del rango informado, no el real, y se marca como estimacion en
 * todas las pantallas. Existe para poder ordenar una tabla; para decidir, el
 * rango dice mas.
 */
export function estimatedPotential(report: ScoutingReport): number {
  return Math.round((report.low + report.high) / 2);
}

/** Un juvenil listo para debutar. */
export function canPromote(youth: YouthPlayer): boolean {
  return youth.player.age >= MIN_PROMOTION_AGE;
}

/** Se le termino el tiempo en inferiores. */
export function mustLeave(youth: YouthPlayer): boolean {
  return youth.player.age > YOUTH_MAX_AGE;
}

/**
 * Cuantos juveniles produce la academia por temporada, y de que nivel.
 *
 * La academia (seccion 8) decide las dos cosas: cuantos suben de la pension y
 * que techo pueden tener. Con una academia de una estrella salen tres pibes
 * flojos por anio; con cinco, seis, y alguno puede llegar lejos.
 */
export type YouthIntakeShape = {
  readonly count: number;
  /** Potencial medio de la camada. */
  readonly potentialMean: number;
  /** Dispersion del potencial: de aca salen las joyas y los descartes. */
  readonly potentialSpread: number;
};

const INTAKE_BY_FACILITY: readonly YouthIntakeShape[] = [
  { count: 3, potentialMean: 58, potentialSpread: 7 },
  { count: 4, potentialMean: 62, potentialSpread: 8 },
  { count: 4, potentialMean: 66, potentialSpread: 9 },
  { count: 5, potentialMean: 70, potentialSpread: 10 },
  { count: 6, potentialMean: 74, potentialSpread: 11 },
];

export function intakeShape(academyLevel: number): YouthIntakeShape {
  const index = clamp(Math.round(academyLevel), 1, 5) - 1;
  return INTAKE_BY_FACILITY[index] as YouthIntakeShape;
}

/** Puestos de los que suele salir una camada, para que no sean todos delanteros. */
export const YOUTH_POSITIONS: readonly Position[] = [
  'POR',
  'LD',
  'DFC',
  'DFC',
  'LI',
  'MCD',
  'MC',
  'MC',
  'MCO',
  'ED',
  'EI',
  'DC',
  'DC',
  'SD',
];
