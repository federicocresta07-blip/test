/**
 * TABLA DE POSICIONES.
 *
 * La tabla no se guarda: se calcula desde los resultados. Es la misma
 * decision que con el efecto del staff, y por el mismo motivo: un numero
 * guardado puede contradecir a los partidos, uno derivado no.
 */

export type PlayedMatch = {
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
};

export type TableRow = {
  readonly clubId: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
  /** Ultimos cinco resultados, del mas reciente al mas viejo. */
  readonly form: readonly ('V' | 'E' | 'D')[];
  /** Posicion en la tabla, desde 1. */
  readonly position: number;
};

const EMPTY = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
};

/**
 * Arma la tabla a partir de los partidos jugados.
 *
 * Desempate: puntos, diferencia de gol, goles a favor y despues el nombre,
 * que es como se ordena en el futbol argentino cuando todo lo demas empata.
 * El nombre entra ultimo para que el orden sea estable: sin ese criterio, dos
 * equipos identicos podrian intercambiar posiciones entre renders.
 */
export function buildTable(
  clubIds: readonly string[],
  matches: readonly PlayedMatch[],
  nameOf: (clubId: string) => string = (id) => id,
): readonly TableRow[] {
  const totals = new Map(clubIds.map((clubId) => [clubId, { ...EMPTY }]));
  const history = new Map<string, ('V' | 'E' | 'D')[]>(clubIds.map((clubId) => [clubId, []]));

  const chronological = [...matches].sort((a, b) => a.round - b.round);

  for (const match of chronological) {
    const home = totals.get(match.homeClubId);
    const away = totals.get(match.awayClubId);
    // Un partido de un club que no esta en esta division no cuenta para ella.
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;

    if (match.homeGoals > match.awayGoals) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
      history.get(match.homeClubId)?.unshift('V');
      history.get(match.awayClubId)?.unshift('D');
    } else if (match.homeGoals < match.awayGoals) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
      history.get(match.homeClubId)?.unshift('D');
      history.get(match.awayClubId)?.unshift('V');
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
      history.get(match.homeClubId)?.unshift('E');
      history.get(match.awayClubId)?.unshift('E');
    }
  }

  return clubIds
    .map((clubId) => {
      const row = totals.get(clubId) ?? { ...EMPTY };
      return {
        clubId,
        ...row,
        goalDifference: row.goalsFor - row.goalsAgainst,
        form: (history.get(clubId) ?? []).slice(0, 5),
        position: 0,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        nameOf(a.clubId).localeCompare(nameOf(b.clubId), 'es'),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function rowOf(table: readonly TableRow[], clubId: string): TableRow | undefined {
  return table.find((row) => row.clubId === clubId);
}
