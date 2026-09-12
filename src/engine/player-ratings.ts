/**
 * NOTAS INDIVIDUALES Y MEJOR JUGADOR (seccion 50).
 *
 * La nota sale de lo que el jugador hizo en la simulacion (goles, asistencias,
 * ocasiones creadas, atajadas, tarjetas) mas como rindio ese dia. No es un
 * numero decorativo: se calcula sobre los eventos reales del partido.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp, round } from '../core/math.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { MutablePlayerStats } from './live-team.ts';
import type { PlayerMatchStats } from './match-types.ts';

export function computeRating(
  stats: MutablePlayerStats,
  goalsConcededByTeam: number,
  config: EngineConfig,
): number {
  const cfg = config.ratings;
  const meta = POSITION_META[stats.position];
  const isKeeper = stats.position === 'POR';
  const isDefensive = isKeeper || meta.line === 'DEF';

  // Los que jugaron poco arrancan de una base mas neutra.
  const exposure = clamp(stats.minutesPlayed / 70, 0.25, 1);

  let rating = cfg.base;
  rating += stats.goals * cfg.goal;
  rating += stats.assists * cfg.assist;
  rating += stats.chancesCreated * cfg.keyChance;
  rating -= stats.bigChancesMissed * cfg.bigMiss;
  rating += stats.saves * cfg.save;
  rating -= stats.yellowCards * cfg.yellowCard;
  if (stats.redCard) rating -= cfg.redCard;

  if (isDefensive) {
    const concededWeight = isKeeper ? 1 : 0.55;
    rating -= goalsConcededByTeam * cfg.goalConceded * concededWeight * exposure;
    if (goalsConcededByTeam === 0 && stats.minutesPlayed >= 60) {
      rating += cfg.cleanSheet * (isKeeper ? 1 : 0.8);
    }
  }

  // Como rindio ese dia (seccion 27).
  rating += (stats.effectiveRating - config.performance.leagueAverageRating) * cfg.performanceEffect * exposure;

  return round(clamp(rating, cfg.min, cfg.max), 1);
}

export function finalizePlayerStats(
  stats: MutablePlayerStats,
  goalsConcededByTeam: number,
  config: EngineConfig,
): PlayerMatchStats {
  return {
    player: stats.player,
    position: stats.position,
    minutesPlayed: Math.round(stats.minutesPlayed),
    goals: stats.goals,
    assists: stats.assists,
    shots: stats.shots,
    shotsOnTarget: stats.shotsOnTarget,
    xg: round(stats.xg, 2),
    chancesCreated: stats.chancesCreated,
    bigChancesMissed: stats.bigChancesMissed,
    saves: stats.saves,
    goalsConceded: stats.goalsConceded,
    yellowCards: stats.yellowCards,
    redCard: stats.redCard,
    injured: stats.injured,
    fouls: stats.fouls,
    rating: computeRating(stats, goalsConcededByTeam, config),
    effectiveRating: Math.round(stats.effectiveRating),
    wasStarter: stats.wasStarter,
  };
}

/** Mejor jugador del partido: nota, y a igual nota el que mas peso tuvo en el resultado. */
export function pickManOfTheMatch(
  players: readonly PlayerMatchStats[],
): PlayerMatchStats {
  const sorted = [...players].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return b.minutesPlayed - a.minutesPlayed;
  });
  return sorted[0] as PlayerMatchStats;
}
