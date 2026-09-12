/**
 * MODELO PROBABILISTICO (seccion 44).
 *
 * Antes de simular, el motor calcula los goles esperados de cada equipo:
 *
 *   Expected Goals Local = 1.78
 *   Expected Goals Visitante = 1.13
 *
 * y de ahi deriva las probabilidades de cada resultado. La simulacion despues
 * resuelve ocasion por ocasion, asi que el marcador final no es un sorteo
 * sobre estas probabilidades, sino el resultado de jugar el partido con ellas.
 *
 * Estos numeros sirven para la interfaz, para la IA y sobre todo para la
 * calibracion (seccion 52): permiten comparar lo que el modelo espera con lo
 * que la simulacion produce.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import {
  finishingAbility,
  positioningAbility,
  resolveChanceMix,
  shooterWeightedAbility,
  type ChanceKind,
  type ChanceMix,
} from './chances.ts';
import type { MatchupEffect } from './tactical-matchups.ts';

/** Probabilidad de gol esperada para un tipo de ocasion, con el ejecutor promedio. */
function expectedGoalProbability(
  kind: ChanceKind,
  attacking: TeamStrength,
  defending: TeamStrength,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
): { readonly xg: number; readonly goalProbability: number } {
  const league = config.performance.leagueAverageRating;
  const qcfg = config.chanceQuality;
  const ccfg = config.conversion;

  const positioning = shooterWeightedAbility(attacking, kind, positioningAbility);
  const finishing = shooterWeightedAbility(attacking, kind, finishingAbility);

  const base =
    kind === 'tiroLibre'
      ? config.setPieces.freeKickBaseGoal
      : kind === 'penal'
        ? qcfg.baseXg.penal
        : qcfg.baseXg[kind];

  if (kind === 'penal') {
    const gkGap = (defending.goalkeeperRating - league) / 100;
    const finishingGap = (finishing - league) / 100;
    const p = clamp(
      config.setPieces.penaltyBaseGoal * (1 + finishingGap * 0.45) * (1 - gkGap * 0.3),
      0.35,
      ccfg.maxGoalProbability,
    );
    return { xg: base, goalProbability: p };
  }

  const abilityFactor = 1 + qcfg.attackerQualityEffect * ((positioning - league) / 100);
  const matchupFactor =
    1 +
    matchup.chanceQuality +
    (kind === 'contraataque' ? matchup.counterBonus : 0) +
    (kind === 'balonParado' || kind === 'tiroLibre' ? matchup.setPieceBonus : 0);
  const homeFactor = isHome ? config.homeAdvantage.xgMultiplier : 1;
  const xg = clamp(
    base * abilityFactor * clamp(matchupFactor, 0.55, 1.6) * homeFactor,
    qcfg.minXgPerShot,
    qcfg.maxXgPerShot,
  );

  const finishingFactor = 1 + ((finishing - league) / 100) * ccfg.finishingEffect;
  const goalkeeperFactor = 1 - ((defending.goalkeeperRating - league) / 100) * ccfg.goalkeeperEffect;
  const pressureFactor =
    kind === 'tiroLibre' ? 1 : 1 - ((defending.dimensions.defensa - league) / 100) * ccfg.defensivePressureEffect;

  const goalProbability = clamp(
    xg * Math.max(0.2, finishingFactor) * Math.max(0.4, goalkeeperFactor) * Math.max(0.5, pressureFactor),
    ccfg.minGoalProbability,
    ccfg.maxGoalProbability,
  );

  return { xg, goalProbability };
}

export type TeamProjection = {
  readonly expectedGoals: number;
  readonly expectedXg: number;
  readonly expectedShots: number;
  readonly expectedSetPieceShots: number;
  readonly expectedCorners: number;
};

/** Goles esperados de un equipo, sumando juego y balon parado. */
export function projectTeam(
  attacking: TeamStrength,
  defending: TeamStrength,
  openPlayShots: number,
  qualityEdge: number,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
): TeamProjection {
  const mix: ChanceMix = resolveChanceMix(attacking, qualityEdge, config);

  let expectedGoals = 0;
  let expectedXg = 0;
  for (const kind of Object.keys(mix) as (keyof ChanceMix)[]) {
    const { xg, goalProbability } = expectedGoalProbability(
      kind,
      attacking,
      defending,
      matchup,
      isHome,
      config,
    );
    const shots = openPlayShots * mix[kind];
    expectedGoals += shots * goalProbability;
    expectedXg += shots * xg;
  }

  // Balon parado (seccion 46).
  const spCfg = config.setPieces;
  const abilityFactor = clamp(
    1 + ((attacking.dimensions.balonParado - config.performance.leagueAverageRating) / 100) * spCfg.setPieceAbilityEffect,
    0.6,
    1.5,
  );
  const expectedCorners = Math.max(
    0,
    spCfg.baseCorners + spCfg.cornerEdgeEffect * qualityEdge + openPlayShots * config.conversion.cornerFromShot,
  );
  const cornerShots = expectedCorners * clamp(spCfg.cornerToShot * abilityFactor, 0.05, 0.6);
  const cornerOutcome = expectedGoalProbability('balonParado', attacking, defending, matchup, isHome, config);
  expectedGoals += cornerShots * cornerOutcome.goalProbability;
  expectedXg += cornerShots * cornerOutcome.xg;

  const aggressionFactor =
    1 + (defending.profile.aggression - 0.5) * 0.5 + (defending.profile.pressing - 0.5) * 0.3;
  const freeKicks = Math.max(0, spCfg.directFreeKicks * aggressionFactor);
  const freeKickOutcome = expectedGoalProbability('tiroLibre', attacking, defending, matchup, isHome, config);
  expectedGoals += freeKicks * freeKickOutcome.goalProbability;
  expectedXg += freeKicks * freeKickOutcome.xg;

  const penaltyPressure = clamp(1 + qualityEdge / 120 + (defending.profile.aggression - 0.5) * 0.4, 0.4, 2.2);
  const penalties = spCfg.penaltyRate * penaltyPressure;
  const penaltyOutcome = expectedGoalProbability('penal', attacking, defending, matchup, isHome, config);
  expectedGoals += penalties * penaltyOutcome.goalProbability;
  expectedXg += penalties * penaltyOutcome.xg;

  return {
    expectedGoals,
    expectedXg,
    expectedShots: openPlayShots + cornerShots + freeKicks + penalties,
    expectedSetPieceShots: cornerShots + freeKicks + penalties,
    expectedCorners,
  };
}

/**
 * Probabilidades de resultado a partir de los goles esperados.
 * Se usan dos Poisson independientes: es una aproximacion suficientemente
 * buena para mostrar y para que la IA tome decisiones.
 */
export function resultProbabilities(
  expectedHome: number,
  expectedAway: number,
  maxGoals = 12,
): { readonly homeWin: number; readonly draw: number; readonly awayWin: number } {
  const poisson = (lambda: number, k: number): number =>
    Math.exp(-lambda + k * Math.log(Math.max(lambda, 1e-9)) - logFactorial(k));

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let h = 0; h <= maxGoals; h += 1) {
    const ph = poisson(expectedHome, h);
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = ph * poisson(expectedAway, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
    }
  }
  const total = homeWin + draw + awayWin;
  return total > 0
    ? { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total }
    : { homeWin: 1 / 3, draw: 1 / 3, awayWin: 1 / 3 };
}

const LOG_FACTORIAL_CACHE: number[] = [0, 0];
function logFactorial(n: number): number {
  const cached = LOG_FACTORIAL_CACHE[n];
  if (cached !== undefined) return cached;
  let value = LOG_FACTORIAL_CACHE[LOG_FACTORIAL_CACHE.length - 1] as number;
  for (let i = LOG_FACTORIAL_CACHE.length; i <= n; i += 1) {
    value += Math.log(i);
    LOG_FACTORIAL_CACHE[i] = value;
  }
  return LOG_FACTORIAL_CACHE[n] as number;
}
