/**
 * EL CIERRE DE TEMPORADA (seccion 19, fase 6).
 *
 * ============================================================
 * LA DEUDA QUE ESTO PAGA
 * ============================================================
 *
 * `ageUp` existia en el motor desde la fase 4 y NADIE LO LLAMABA. Se podia
 * terminar el torneo y empezar otro, pero nadie cumplia un anio: Aimar tenia
 * 18 para siempre, Astrada no se retiraba nunca, y los juveniles se quedaban
 * en inferiores hasta el final de los tiempos.
 *
 * Sin paso del tiempo no hay carrera de manager. Un plantel que no envejece
 * no obliga a renovarlo, y entonces las inferiores, el scouting y el mercado
 * son adornos: nunca hace falta reemplazar a nadie.
 *
 * ============================================================
 * QUE PASA AL CERRAR
 * ============================================================
 *
 * 1. TODOS CUMPLEN UN ANIO. El plantel y las inferiores.
 * 2. LOS VETERANOS SE RETIRAN. No de golpe a una edad fija: depende de la
 *    edad y de lo que todavia rinde. Un 5 de 36 que sigue siendo el mejor del
 *    plantel juega otra temporada; uno de 36 que ya no entra, cuelga.
 * 3. A LOS JUVENILES SE LES TERMINA EL TIEMPO. El que pasa de 20 y no fue
 *    promovido se va libre. Es la consecuencia de no haberlo subido.
 * 4. ENTRA UNA CAMADA NUEVA. La produce la academia, asi que su nivel se ve
 *    de una temporada a la otra.
 *
 * Todo deterministico a partir de una semilla: la misma temporada cerrada dos
 * veces da el mismo resultado. El azar existe —dos jugadores iguales de 35 no
 * se retiran los dos— pero es azar con semilla, no `Math.random`.
 */

import { Rng } from '../core/rng.ts';
import { clamp } from '../core/math.ts';
import type { Player } from '../domain/player.ts';
import { mustLeave, YOUTH_MAX_AGE, type YouthPlayer } from '../domain/youth.ts';
import { overallForPosition } from '../ratings/overall.ts';
import { ageUp } from './development.ts';

/** Antes de esta edad nadie se retira. */
export const RETIREMENT_MIN_AGE = 33;
/** A esta edad se retiran todos, juegue bien o mal. */
export const RETIREMENT_FORCED_AGE = 40;

export type RetirementConfig = {
  /**
   * Probabilidad de retirarse a `RETIREMENT_MIN_AGE` para un jugador que ya
   * no rinde. Sube con la edad.
   */
  readonly baseChance: number;
  /** Cuanto se suma por anio por encima de la edad minima. */
  readonly chancePerYear: number;
  /**
   * Cuanto protege seguir rindiendo. Un jugador muy por encima del promedio
   * del plantel estira la carrera.
   */
  readonly formProtection: number;
};

export const DEFAULT_RETIREMENT_CONFIG: RetirementConfig = {
  baseChance: 0.18,
  chancePerYear: 0.13,
  formProtection: 0.55,
};

export type Retirement = {
  readonly player: Player;
  /** Listo para la bandeja: "se retira a los 37". */
  readonly reason: string;
};

export type SeasonCloseInput = {
  readonly players: readonly Player[];
  readonly youth: readonly YouthPlayer[];
  /** La camada que produce la academia para la temporada que empieza. */
  readonly intake: readonly YouthPlayer[];
  readonly seed?: string | number;
  readonly config?: RetirementConfig;
};

export type SeasonCloseResult = {
  /** El plantel un anio mas grande, sin los que se retiraron. */
  readonly players: readonly Player[];
  readonly retired: readonly Retirement[];
  /** Las inferiores: un anio mas, sin los que se les termino el tiempo, mas la camada nueva. */
  readonly youth: readonly YouthPlayer[];
  readonly released: readonly YouthPlayer[];
};

/**
 * Cierra la temporada.
 *
 * No toca las finanzas: el ejercicio se calcula entero en `domain/finances.ts`
 * a partir del estado, asi que no hay nada que "cerrar" ahi. Lo que cierra
 * aca es el paso del tiempo, que si es irreversible.
 */
export function closeSeason(input: SeasonCloseInput): SeasonCloseResult {
  const rng = new Rng(`cierre:${input.seed ?? 'temporada'}`);
  const config = input.config ?? DEFAULT_RETIREMENT_CONFIG;

  // El promedio del plantel ANTES de envejecerlo: es la referencia contra la
  // que se mide si un veterano todavia rinde.
  const squadAverage = averageOverall(input.players);

  const aged = ageUp(input.players);
  const players: Player[] = [];
  const retired: Retirement[] = [];

  for (const player of aged) {
    const chance = retirementChance(player, squadAverage, config);
    if (chance > 0 && rng.next() < chance) {
      retired.push({ player, reason: `se retira a los ${player.age}` });
      continue;
    }
    players.push(player);
  }

  // Las inferiores tambien cumplen anios, y al que se le paso la edad se le
  // termina el tiempo en el club.
  const agedYouth = input.youth.map((entry) => ({
    ...entry,
    player: { ...entry.player, age: entry.player.age + 1 },
    yearsAtClub: entry.yearsAtClub + 1,
  }));
  const released = agedYouth.filter(mustLeave);
  const staying = agedYouth.filter((entry) => !mustLeave(entry));

  return {
    players,
    retired,
    youth: [...staying, ...input.intake],
    released,
  };
}

/**
 * La probabilidad de que un jugador se retire este cierre.
 *
 * Cero antes de los 33, uno a los 40. En el medio crece con la edad y baja
 * con lo que todavia rinde respecto del plantel: por eso un veterano que
 * sigue siendo titular dura mas que uno que ya no entra.
 */
export function retirementChance(
  player: Player,
  squadAverage: number,
  config: RetirementConfig = DEFAULT_RETIREMENT_CONFIG,
): number {
  if (player.age >= RETIREMENT_FORCED_AGE) return 1;
  if (player.age < RETIREMENT_MIN_AGE) return 0;

  const years = player.age - RETIREMENT_MIN_AGE;
  const raw = config.baseChance + years * config.chancePerYear;

  // Lo que todavia rinde, como fraccion del promedio del plantel. Un jugador
  // 10 puntos por encima del promedio tiene el ~0.45 de la probabilidad.
  const overall = overallForPosition(player.attributes, player.position);
  const edge = squadAverage > 0 ? (overall - squadAverage) / 20 : 0;
  const protection = 1 - clamp(edge, 0, 1) * config.formProtection;

  return clamp(raw * protection, 0, 1);
}

function averageOverall(players: readonly Player[]): number {
  if (players.length === 0) return 0;
  let total = 0;
  for (const player of players) {
    total += overallForPosition(player.attributes, player.position);
  }
  return total / players.length;
}

export { YOUTH_MAX_AGE };
