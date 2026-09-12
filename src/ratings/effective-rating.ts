/**
 * OVERALL DINAMICO (seccion 27).
 *
 * El rendimiento de un jugador en un partido no es su overall:
 *
 *   overall base
 *   + adecuacion a la posicion
 *   + forma
 *   + moral
 *   + estado fisico
 *   + adecuacion tactica
 *   + experiencia
 *   + cohesion del equipo
 *   + variacion del partido
 *   = rendimiento efectivo
 *
 * La variacion es acotada (normal truncada): un 82 puede rendir 86 o 77,
 * nunca 95 ni 60.
 */

import { clamp, clampRating } from '../core/math.ts';
import type { EngineConfig } from '../config/engine-config.ts';
import type { FormationSlot } from '../domain/formations.ts';
import type { Player } from '../domain/player.ts';
import type { Position } from '../domain/positions.ts';
import type { TacticalProfile } from '../domain/tactics.ts';
import type { Rng } from '../core/rng.ts';
import { preciseOverallForPosition } from './overall.ts';
import { evaluatePositionFit, type PositionFit } from './position-fit.ts';
import { evaluateTacticalFit } from './tactical-fit.ts';

export type PerformanceContext = {
  readonly isHome: boolean;
  /** Importancia del partido 0 (amistoso) .. 1 (final). Modula la experiencia. */
  readonly importance: number;
  /** Cohesion del equipo 1..100 (seccion 39). */
  readonly chemistry: number;
};

/** Desglose del rendimiento, en puntos de overall. Sirve para la interfaz y para depurar. */
export type PerformanceBreakdown = {
  readonly baseOverall: number;
  readonly positionFit: PositionFit;
  readonly positionAdjustment: number;
  readonly form: number;
  readonly morale: number;
  readonly fatigue: number;
  readonly sharpness: number;
  readonly tacticalFit: number;
  readonly experience: number;
  readonly chemistry: number;
  readonly homeAdvantage: number;
  readonly variation: number;
  /** Rendimiento efectivo final, 1..100. */
  readonly effective: number;
  /** Rendimiento esperado (sin el azar del partido). */
  readonly expected: number;
};

export type RatedPlayer = {
  readonly player: Player;
  readonly position: Position;
  readonly slot: FormationSlot;
  readonly performance: PerformanceBreakdown;
  /** Atajo a `performance.effective`. */
  readonly rating: number;
};

/**
 * Rendimiento de un jugador para este partido.
 * Sin `rng` devuelve el rendimiento esperado (sin variacion), que es lo que
 * usa la IA para armar el equipo: no puede "ver" la suerte del partido.
 */
export function evaluatePerformance(
  player: Player,
  assigned: Position,
  slot: FormationSlot,
  profile: TacticalProfile,
  context: PerformanceContext,
  config: EngineConfig,
  rng?: Rng,
): PerformanceBreakdown {
  const perf = config.performance;
  const naturalOverall = preciseOverallForPosition(player.attributes, player.position);
  const assignedOverall = preciseOverallForPosition(player.attributes, assigned);
  const fit = evaluatePositionFit(player, assigned, config);

  // Aptitud por atributos del puesto asignado: matiza, no reemplaza al overall.
  const suitability =
    clamp(assignedOverall - naturalOverall, -perf.positionAttributeCap, perf.positionAttributeCap) *
    perf.positionAttributeMix;
  const adjustedBase = naturalOverall + suitability;
  const positionAdjustment = suitability - adjustedBase * fit.penalty;
  const afterPosition = adjustedBase * (1 - fit.penalty);

  const condition = player.condition;
  const formDelta = ((condition.form - 50) / 50) * perf.formSwing;
  const moraleDelta = ((condition.morale - 50) / 50) * perf.moraleSwing;
  const fatigueDelta = -(condition.fatigue / 100) * perf.fatiguePenalty;
  const sharpnessDelta = clamp((condition.sharpness - 85) / 50, -1.2, 0.3) * perf.sharpnessSwing;

  const fitScore = evaluateTacticalFit(player.attributes, assigned, slot, profile);
  const tacticalDelta = (fitScore - 0.5) * 2 * perf.tacticalFitSwing;

  // La experiencia se cobra sobre todo en partidos importantes (seccion 40).
  const experienceDelta =
    ((player.experience - 50) / 50) * perf.experienceBigMatchSwing * clamp(context.importance, 0, 1);

  const chemistryDelta = ((context.chemistry - 50) / 50) * config.teamStrength.chemistrySwing * 0.5;
  const homeDelta = context.isHome ? config.homeAdvantage.performanceBonus : 0;

  const expected = clampRating(
    afterPosition +
      formDelta +
      moraleDelta +
      fatigueDelta +
      sharpnessDelta +
      tacticalDelta +
      experienceDelta +
      chemistryDelta +
      homeDelta,
  );

  // Azar acotado: los jugadores consistentes y experimentados varian menos.
  let variation = 0;
  if (rng) {
    const steadiness = (player.consistency * 0.7 + player.experience * 0.3 - 50) / 50;
    const sd = Math.max(
      0.8,
      perf.matchVariationSd * (1 - perf.matchVariationConsistencyEffect * steadiness),
    );
    variation = rng.boundedNormal(0, sd, perf.matchVariationMaxSd);
  }

  return {
    baseOverall: naturalOverall,
    positionFit: fit,
    positionAdjustment,
    form: formDelta,
    morale: moraleDelta,
    fatigue: fatigueDelta,
    sharpness: sharpnessDelta,
    tacticalFit: tacticalDelta,
    experience: experienceDelta,
    chemistry: chemistryDelta,
    homeAdvantage: homeDelta,
    variation,
    effective: clampRating(expected + variation),
    expected,
  };
}
