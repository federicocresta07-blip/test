/**
 * FALTAS, TARJETAS Y LESIONES (seccion 38).
 *
 * Las faltas salen de la agresividad y de la intensidad de la presion. Las
 * tarjetas salen de las faltas. Las lesiones tienen probabilidad basada en
 * fatiga, historial, edad e intensidad del partido.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { Player } from '../domain/player.ts';
import type { RatedPlayer } from '../ratings/effective-rating.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import type { Side } from './chances.ts';

export type PlannedFoul = {
  readonly side: Side;
  readonly minute: number;
  readonly card: 'ninguna' | 'amarilla' | 'roja';
};

export type PlannedInjury = {
  readonly side: Side;
  readonly minute: number;
};

/** Faltas esperadas de un equipo. */
export function expectedFouls(
  team: TeamStrength,
  opponent: TeamStrength,
  isHome: boolean,
  config: EngineConfig,
): number {
  const cfg = config.discipline;
  const profile = team.profile;
  const base =
    cfg.baseFouls *
    (1 + (profile.aggression - 0.5) * cfg.aggressionEffect * 2 + (profile.pressing - 0.5) * cfg.pressingEffect * 2);
  // El rival que juega rapido y con regate provoca mas faltas.
  const provoked = 1 + (opponent.profile.tempo - 0.5) * 0.08;
  const referee = isHome ? 0 : config.homeAdvantage.refereeBias;
  return Math.max(3, base * provoked + referee);
}

/** Distribuye las faltas del partido con sus tarjetas y sus minutos. */
export function planFouls(
  side: Side,
  team: TeamStrength,
  opponent: TeamStrength,
  isHome: boolean,
  totalMinutes: number,
  config: EngineConfig,
  rng: Rng,
): { readonly fouls: number; readonly planned: readonly PlannedFoul[] } {
  const cfg = config.discipline;
  const fouls = rng.poisson(expectedFouls(team, opponent, isHome, config));
  const planned: PlannedFoul[] = [];
  for (let i = 0; i < fouls; i += 1) {
    // Las tarjetas se acumulan mas en la segunda mitad: el partido se calienta.
    const minute = clamp(Math.ceil(Math.pow(rng.next(), 0.82) * totalMinutes), 1, totalMinutes);
    const aggressionFactor = 1 + (team.profile.aggression - 0.5) * 0.6;
    let card: PlannedFoul['card'] = 'ninguna';
    if (rng.chance(cfg.straightRedPerFoul * aggressionFactor)) card = 'roja';
    else if (rng.chance(cfg.yellowPerFoul * aggressionFactor)) card = 'amarilla';
    planned.push({ side, minute, card });
  }
  planned.sort((a, b) => a.minute - b.minute);
  return { fouls, planned };
}

/** Riesgo relativo de lesion de un jugador (seccion 38). */
export function injuryRisk(player: Player, intensity: number, config: EngineConfig): number {
  const cfg = config.discipline;
  const fatigueFactor = 1 + (player.condition.fatigue / 100) * cfg.injuryFatigueEffect;
  const historyFactor = 1 + (player.injuryProneness / 100) * cfg.injuryHistoryEffect;
  const ageFactor =
    player.age >= 30
      ? 1 + (player.age - 30) * 0.06 * cfg.injuryAgeEffect
      : player.age < 20
        ? 1 + (20 - player.age) * 0.04 * cfg.injuryAgeEffect
        : 1;
  const intensityFactor = 1 + clamp(intensity, 0, 1) * cfg.injuryIntensityEffect;
  return cfg.baseInjuryRate * fatigueFactor * historyFactor * ageFactor * intensityFactor;
}

/** Sortea las lesiones del partido para un equipo. */
export function planInjuries(
  side: Side,
  team: TeamStrength,
  intensity: number,
  totalMinutes: number,
  config: EngineConfig,
  rng: Rng,
): PlannedInjury[] {
  let expected = 0;
  for (const rated of team.players) expected += injuryRisk(rated.player, intensity, config);
  const count = rng.poisson(expected);
  const planned: PlannedInjury[] = [];
  for (let i = 0; i < count; i += 1) {
    planned.push({ side, minute: clamp(rng.intBetween(4, totalMinutes), 1, totalMinutes) });
  }
  return planned.sort((a, b) => a.minute - b.minute);
}

/** Peso de un jugador para cometer la falta. */
export function foulWeight(rated: RatedPlayer): number {
  // El arquero practicamente no hace faltas.
  if (rated.position === 'POR') return 0.03;
  const a = rated.player.attributes;
  // La agresividad empuja a la falta y la calidad la evita: el jugador que
  // lee bien llega al cruce sin necesidad de barrer. Las decisiones y la
  // concentracion eran atributos propios y ahora estan dentro de la calidad.
  const discipline = (a.agresividad * 0.6 + (100 - a.calidad) * 0.4) / 100;
  return 0.25 + discipline * 1.5 + rated.slot.defenseDuty * 0.6;
}

/** Peso de un jugador para sufrir la lesion, dado el estado actual. */
export function injuryWeight(rated: RatedPlayer, inMatchFatigue: number, config: EngineConfig): number {
  const player = rated.player;
  const fatigue = clamp(player.condition.fatigue + inMatchFatigue, 0, 100);
  const base = injuryRisk({ ...player, condition: { ...player.condition, fatigue } }, 0.5, config);
  return base * (0.6 + rated.slot.defenseDuty * 0.4 + rated.slot.attackDuty * 0.3);
}
