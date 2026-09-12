/**
 * ESTADISTICAS DEL TORNEO: goleadores, asistencias y notas.
 *
 * Se acumulan fecha a fecha en lugar de recalcularse desde todos los partidos
 * guardados. El motivo es concreto: de los partidos que no juega el manager
 * solo guardamos a los jugadores que hicieron algo, asi que recalcular desde
 * ahi perderia los minutos y las notas de todos los demas. El acumulador ve
 * cada partido una sola vez, cuando esta completo.
 */

import type { MatchPlayerLine, MatchRecord } from './season.ts';

export type PlayerSeasonTotals = {
  readonly playerId: string;
  readonly playerName: string;
  readonly clubId: string;
  readonly appearances: number;
  readonly minutes: number;
  readonly goals: number;
  readonly assists: number;
  readonly yellowCards: number;
  readonly redCards: number;
  /** Suma de notas, para poder promediar sin perder precision al guardar. */
  readonly ratingSum: number;
  /** Partidos con nota, que no es lo mismo que apariciones. */
  readonly ratedMatches: number;
};

export type SeasonTotals = Readonly<Record<string, PlayerSeasonTotals>>;

export const EMPTY_TOTALS: SeasonTotals = {};

function blank(line: MatchPlayerLine): PlayerSeasonTotals {
  return {
    playerId: line.playerId,
    playerName: line.playerName,
    clubId: line.clubId,
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    ratingSum: 0,
    ratedMatches: 0,
  };
}

/**
 * Suma un partido a los acumulados.
 *
 * Los minutos y las notas solo se suman cuando el partido trae el plantel
 * completo. De un partido de IA sabemos que Fulano hizo un gol, pero no
 * cuantos minutos jugo el resto, y sumar cero minutos a alguien que jugo los
 * noventa seria peor que no sumar nada.
 */
export function accumulate(totals: SeasonTotals, record: MatchRecord): SeasonTotals {
  const next: Record<string, PlayerSeasonTotals> = { ...totals };

  for (const line of record.lines) {
    const current = next[line.playerId] ?? blank(line);
    const playedMinutes = line.minutes > 0;
    next[line.playerId] = {
      ...current,
      playerName: line.playerName,
      clubId: line.clubId,
      appearances: current.appearances + (playedMinutes ? 1 : 0),
      minutes: current.minutes + (record.linesComplete ? line.minutes : 0),
      goals: current.goals + line.goals,
      assists: current.assists + line.assists,
      yellowCards: current.yellowCards + line.yellowCards,
      redCards: current.redCards + (line.redCard ? 1 : 0),
      ratingSum: current.ratingSum + (record.linesComplete && playedMinutes ? line.rating : 0),
      ratedMatches: current.ratedMatches + (record.linesComplete && playedMinutes ? 1 : 0),
    };
  }

  return next;
}

export function accumulateRound(
  totals: SeasonTotals,
  records: readonly MatchRecord[],
): SeasonTotals {
  return records.reduce(accumulate, totals);
}

export function averageRating(entry: PlayerSeasonTotals): number | null {
  if (entry.ratedMatches === 0) return null;
  return entry.ratingSum / entry.ratedMatches;
}

function list(totals: SeasonTotals): readonly PlayerSeasonTotals[] {
  return Object.values(totals);
}

/**
 * Tabla de goleadores. Desempate: goles, despues asistencias, despues menos
 * minutos jugados —el que lo hizo en menos tiempo va primero— y al final el
 * nombre, para que el orden sea estable.
 */
export function topScorers(totals: SeasonTotals, limit = 15): readonly PlayerSeasonTotals[] {
  return list(totals)
    .filter((entry) => entry.goals > 0)
    .slice()
    .sort(
      (a, b) =>
        b.goals - a.goals ||
        b.assists - a.assists ||
        a.minutes - b.minutes ||
        a.playerName.localeCompare(b.playerName, 'es'),
    )
    .slice(0, limit);
}

export function topAssists(totals: SeasonTotals, limit = 15): readonly PlayerSeasonTotals[] {
  return list(totals)
    .filter((entry) => entry.assists > 0)
    .slice()
    .sort(
      (a, b) =>
        b.assists - a.assists ||
        b.goals - a.goals ||
        a.playerName.localeCompare(b.playerName, 'es'),
    )
    .slice(0, limit);
}

/**
 * Mejores notas del torneo.
 *
 * Pide un minimo de partidos: sin eso, el que jugo un partido y saco 8,5 le
 * gana al que promedia 7,4 en quince fechas, y eso no informa nada.
 */
export function bestRated(
  totals: SeasonTotals,
  minimumMatches = 3,
  limit = 15,
): readonly PlayerSeasonTotals[] {
  return list(totals)
    .filter((entry) => entry.ratedMatches >= minimumMatches)
    .slice()
    .sort(
      (a, b) =>
        (averageRating(b) ?? 0) - (averageRating(a) ?? 0) ||
        b.ratedMatches - a.ratedMatches ||
        a.playerName.localeCompare(b.playerName, 'es'),
    )
    .slice(0, limit);
}

/** Los acumulados de un club, del que mas jugo al que menos. */
export function totalsOfClub(totals: SeasonTotals, clubId: string): readonly PlayerSeasonTotals[] {
  return list(totals)
    .filter((entry) => entry.clubId === clubId)
    .slice()
    .sort((a, b) => b.minutes - a.minutes || b.goals - a.goals);
}

/** Amonestados con riesgo de suspension, para avisar antes de la fecha. */
export function bookingRisk(
  totals: SeasonTotals,
  clubId: string,
  threshold = 4,
): readonly PlayerSeasonTotals[] {
  return list(totals)
    .filter((entry) => entry.clubId === clubId && entry.yellowCards >= threshold)
    .slice()
    .sort((a, b) => b.yellowCards - a.yellowCards);
}
