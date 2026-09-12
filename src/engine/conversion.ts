/**
 * ETAPA 4 — CONVERSION (secciones 43, 45).
 *
 * La probabilidad de gol de una ocasion depende de:
 *   - la calidad de la ocasion (su xG, ya calculado en la etapa 3),
 *   - la definicion del atacante,
 *   - el arquero rival,
 *   - la presion defensiva,
 *   - el azar.
 *
 * El azar entra solo al final, sobre una probabilidad ya construida por el
 * motor. Nunca se sortea "quien gana" (seccion 41).
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import { finishingAbility, type Chance } from './chances.ts';

export type ShotResult = {
  readonly goal: boolean;
  readonly onTarget: boolean;
  readonly saved: boolean;
  readonly corner: boolean;
  /** Probabilidad de gol que uso el motor, para auditar la simulacion. */
  readonly goalProbability: number;
};

/**
 * "Dia" del arquero (seccion 45): un valor por partido que le permite tener
 * una tarde extraordinaria o una para el olvido.
 */
export function drawGoalkeeperDay(config: EngineConfig, rng: Rng): number {
  return clamp(1 - rng.boundedNormal(0, config.conversion.goalkeeperFormSd, 2.2), 0.6, 1.4);
}

/** Probabilidad de gol de una ocasion. */
export function goalProbability(
  chance: Chance,
  defending: TeamStrength,
  goalkeeperDay: number,
  fatigueDrop: number,
  scoreStateFactor: number,
  config: EngineConfig,
): number {
  const cfg = config.conversion;
  const league = config.performance.leagueAverageRating;

  const gkGap = (defending.goalkeeperRating - league) / 100;
  const finishing = finishingAbility(chance.shooter, chance.kind);
  const finishingGap = (finishing - fatigueDrop - league) / 100;

  if (chance.kind === 'penal') {
    // El penal casi no depende del contexto: ejecutor contra arquero.
    const p =
      config.setPieces.penaltyBaseGoal *
      (1 + finishingGap * 0.45) *
      (1 - gkGap * 0.3) *
      clamp(goalkeeperDay, 0.75, 1.25);
    // Un penal casi siempre es gol, pero nunca supera el techo del motor.
    return clamp(p, 0.35, cfg.maxGoalProbability);
  }

  const finishingFactor = 1 + finishingGap * cfg.finishingEffect;
  const goalkeeperFactor = 1 - gkGap * cfg.goalkeeperEffect;
  const pressureFactor =
    chance.kind === 'tiroLibre'
      ? 1
      : 1 - ((defending.dimensions.defensa - league) / 100) * cfg.defensivePressureEffect;

  const p =
    chance.xg *
    Math.max(0.2, finishingFactor) *
    Math.max(0.4, goalkeeperFactor) *
    Math.max(0.5, pressureFactor) *
    goalkeeperDay *
    scoreStateFactor;

  return clamp(p, cfg.minGoalProbability, cfg.maxGoalProbability);
}

/** Resuelve una ocasion: gol, atajada, afuera o corner. */
export function resolveChance(
  chance: Chance,
  defending: TeamStrength,
  goalkeeperDay: number,
  fatigueDrop: number,
  scoreStateFactor: number,
  config: EngineConfig,
  rng: Rng,
): ShotResult {
  const p = goalProbability(chance, defending, goalkeeperDay, fatigueDrop, scoreStateFactor, config);
  if (rng.chance(p)) {
    return { goal: true, onTarget: true, saved: false, corner: false, goalProbability: p };
  }

  const cfg = config.conversion;
  const onTargetProb = clamp(cfg.onTargetBase + cfg.onTargetXgEffect * chance.xg, 0.05, 0.85);
  const onTarget = rng.chance(onTargetProb);
  // Un remate desviado o rechazado puede terminar en corner, salvo el penal.
  const corner = chance.kind !== 'penal' && !onTarget && rng.chance(cfg.cornerFromShot);

  return { goal: false, onTarget, saved: onTarget, corner, goalProbability: p };
}
