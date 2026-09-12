/**
 * ETAPA 1 — CONTROL DEL PARTIDO (seccion 43).
 *
 * Que equipo puede manejar el partido. Depende del mediocampo, la creacion,
 * la presion, el fisico, la tactica y la localia. El resultado es el reparto
 * de posesion, que despues alimenta el volumen de ocasiones.
 *
 * Importante: tener la pelota no es lo mismo que ser mejor. Un equipo que
 * juega directo cede posesion a proposito y no por eso genera menos.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import type { MatchupEffect } from './tactical-matchups.ts';

export type ControlOutcome = {
  /** Capacidad de control de cada equipo, en puntos. */
  readonly homeControl: number;
  readonly awayControl: number;
  /** Posesion 0..1 (suman 1). */
  readonly homePossession: number;
  readonly awayPossession: number;
  /** Cuanto se abrio el partido, 0..1. Sube las ocasiones de los dos lados. */
  readonly openness: number;
};

/** Capacidad de controlar el partido de un equipo. */
export function controlRating(
  team: TeamStrength,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
): number {
  const w = config.control.weights;
  const d = team.dimensions;
  const base =
    d.mediocampo * w.mediocampo +
    d.creacion * w.creacion +
    d.presion * w.presion +
    d.fisico * w.fisico +
    d.defensa * w.defensa;
  const home = isHome ? config.homeAdvantage.performanceBonus : 0;
  return base + matchup.control + home;
}

export function resolveControl(
  home: TeamStrength,
  away: TeamStrength,
  homeMatchup: MatchupEffect,
  awayMatchup: MatchupEffect,
  /** false en cancha neutral: ahi no hay ventaja de local (seccion 34). */
  homeAdvantage: boolean,
  config: EngineConfig,
): ControlOutcome {
  const homeControl = controlRating(home, homeMatchup, homeAdvantage, config);
  const awayControl = controlRating(away, awayMatchup, false, config);

  // Estilo: el que quiere la pelota la tiene mas, sin que eso lo haga mejor.
  const styleBias = (away.profile.directness - home.profile.directness) * 0.07;
  const tempoBias = (away.profile.tempo - home.profile.tempo) * 0.025;

  const share =
    0.5 +
    (homeControl - awayControl) * config.control.possessionSensitivity +
    (homeAdvantage ? config.control.homePossessionBonus : 0) +
    styleBias +
    tempoBias;

  const homePossession = clamp(share, config.control.possessionFloor, 1 - config.control.possessionFloor);

  return {
    homeControl,
    awayControl,
    homePossession,
    awayPossession: 1 - homePossession,
    openness: (home.profile.openness + away.profile.openness) / 2,
  };
}
