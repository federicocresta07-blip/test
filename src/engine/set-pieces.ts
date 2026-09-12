/**
 * BALON PARADO (seccion 46).
 *
 * Corners, tiros libres directos y penales se generan aparte del juego y
 * tienen sus propios ejecutores designados. Un equipo puede especializarse:
 * la dimension BALON PARADO y los designados cambian de verdad el peligro
 * de estas jugadas.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { RatedPlayer } from '../ratings/effective-rating.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import type { PlannedChance, Side } from './chances.ts';

export type SetPieceTakerSet = {
  readonly penalty: RatedPlayer;
  readonly freeKick: RatedPlayer;
  readonly corner: RatedPlayer;
};

export type SetPieceOutcome = {
  readonly corners: number;
  readonly chances: readonly PlannedChance[];
  readonly penalties: number;
};

/** Eficacia del equipo en la pelota quieta, relativa a la media de liga. */
function setPieceFactor(team: TeamStrength, config: EngineConfig): number {
  const gap = (team.dimensions.balonParado - config.performance.leagueAverageRating) / 100;
  return clamp(1 + gap * config.setPieces.setPieceAbilityEffect, 0.6, 1.5);
}

/**
 * Genera corners, tiros libres y penales de un equipo.
 * `openPlayShots` se usa porque los remates rechazados terminan en corner.
 */
export function resolveSetPieces(
  side: Side,
  team: TeamStrength,
  opponent: TeamStrength,
  qualityEdge: number,
  openPlayShots: number,
  config: EngineConfig,
  rng: Rng,
): SetPieceOutcome {
  const cfg = config.setPieces;
  const ability = setPieceFactor(team, config);

  // Corners: los de base, los que da la ventaja ofensiva y los que salen de
  // remates rechazados.
  const expectedCorners = Math.max(
    0,
    cfg.baseCorners + cfg.cornerEdgeEffect * qualityEdge + openPlayShots * config.conversion.cornerFromShot,
  );
  const corners = rng.poisson(expectedCorners);

  const chances: PlannedChance[] = [];

  // Cada corner puede terminar en remate.
  const cornerShotProb = clamp(cfg.cornerToShot * ability, 0.05, 0.6);
  for (let i = 0; i < corners; i += 1) {
    if (!rng.chance(cornerShotProb)) continue;
    chances.push({ side, kind: 'balonParado', minute: 0, fromSetPiece: true });
  }

  // Tiros libres directos: dependen de las faltas que comete el rival.
  const aggressionFactor = 1 + (opponent.profile.aggression - 0.5) * 0.5 + (opponent.profile.pressing - 0.5) * 0.3;
  const freeKicks = rng.poisson(Math.max(0, cfg.directFreeKicks * aggressionFactor));
  for (let i = 0; i < freeKicks; i += 1) {
    chances.push({ side, kind: 'tiroLibre', minute: 0, fromSetPiece: true });
  }

  // Penales: mas probables si el equipo ataca mucho el area y el rival es duro.
  const penaltyPressure = clamp(1 + qualityEdge / 120 + (opponent.profile.aggression - 0.5) * 0.4, 0.4, 2.2);
  const penalties = rng.poisson(cfg.penaltyRate * penaltyPressure);
  for (let i = 0; i < penalties; i += 1) {
    chances.push({ side, kind: 'penal', minute: 0, fromSetPiece: true });
  }

  return { corners, chances, penalties };
}
