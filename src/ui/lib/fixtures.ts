/** Consultas sobre el calendario. Derivadas, nunca duplicadas en la UI. */

import type { Fixture, GameState, LeagueRow } from '../models/index.ts';

/** Proximo partido del club del usuario. */
export function nextFixture(state: GameState): Fixture | undefined {
  return state.fixtures
    .filter(
      (fixture) =>
        fixture.score === null &&
        (fixture.homeClubId === state.club.id || fixture.awayClubId === state.club.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Ultimos partidos jugados del club, del mas reciente al mas viejo. */
export function recentFixtures(state: GameState, limit = 4): readonly Fixture[] {
  return state.fixtures
    .filter(
      (fixture) =>
        fixture.score !== null &&
        (fixture.homeClubId === state.club.id || fixture.awayClubId === state.club.id),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function tableRow(state: GameState, clubId: string): LeagueRow | undefined {
  return state.table.find((row) => row.clubId === clubId);
}

export function tablePosition(state: GameState, clubId: string): number {
  return state.table.findIndex((row) => row.clubId === clubId) + 1;
}

/** Resultado de un partido desde la perspectiva de un club. */
export function outcomeFor(fixture: Fixture, clubId: string): 'V' | 'E' | 'D' | null {
  if (!fixture.score) return null;
  const isHome = fixture.homeClubId === clubId;
  const own = isHome ? fixture.score.home : fixture.score.away;
  const rival = isHome ? fixture.score.away : fixture.score.home;
  if (own > rival) return 'V';
  if (own === rival) return 'E';
  return 'D';
}
