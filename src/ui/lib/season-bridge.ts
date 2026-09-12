/**
 * PUENTE ENTRE EL TORNEO Y LA INTERFAZ (seccion 13).
 *
 * Traduce lo que devuelve `src/competition` a los modelos que consumen las
 * pantallas. Igual que `engine-bridge.ts`, es el unico lugar donde se hace
 * esta traduccion: ningun componente arma una fila de la tabla a mano.
 *
 * Las fechas del calendario se calculan desde el numero de fecha. No se
 * guardan porque no hacen falta: el patron de dias entre fechas es una regla,
 * no un dato, y de ese mismo patron salen los dias de descanso que usa la
 * progresion del plantel.
 */

import { buildRoundRobin, type SeasonFixture } from '../../competition/fixtures.ts';
import type { MatchRecord } from '../../competition/season.ts';
import { buildTable, type TableRow } from '../../competition/table.ts';
import { clubById } from '../data/clubs.ts';
import { LEAGUE_CLUB_IDS } from '../data/league.ts';
import type { Fixture, LeagueRow } from '../models/index.ts';

/**
 * Primera fecha del torneo.
 *
 * El Torneo Apertura 1998 arranco a fines de agosto del 98 y termino en
 * diciembre. Antes esto decia febrero de 2026, que era coherente con el
 * dataset inventado; con los planteles de EQ003003.PKF, un Apertura jugandose
 * en mayo no cerraba.
 */
export const SEASON_START = '1998-08-28';

/** Horarios tipicos del futbol argentino, repartidos por partido. */
const KICKOFFS = ['15:30', '17:00', '18:15', '19:00', '20:00', '21:30'] as const;

/**
 * DIAS ENTRE FECHAS. Es el dato del que dependen dos cosas a la vez: el dia
 * que muestra el calendario y cuanto se recupera el plantel entre partidos.
 *
 * El patron no es "una fecha por semana" a proposito. Con siete dias de
 * descanso el plantel se recupera por completo y rotar no sirve para nada, lo
 * que dejaria inerte todo el sistema de fatiga y de profundidad del plantel
 * (secciones 37 y 48). El torneo argentino tampoco es asi: mete fechas de
 * mitad de semana. Estas son las de este torneo, y por eso hay semanas en las
 * que llegar entero al clasico obliga a guardar gente antes.
 */
const ROUND_GAP_DAYS: readonly number[] = [7, 7, 4, 3, 7, 7, 4, 3, 7, 7, 7, 4, 3, 7, 7, 4, 3, 7];

/** Dias de descanso antes de la fecha indicada. La fecha 1 no tiene anterior. */
export function restDaysBefore(round: number): number {
  if (round <= 1) return 7;
  return ROUND_GAP_DAYS[(round - 2) % ROUND_GAP_DAYS.length] as number;
}

/** Dias desde el arranque del torneo hasta una fecha. */
function dayOffsetOfRound(round: number): number {
  let offset = 0;
  for (let current = 2; current <= round; current += 1) offset += restDaysBefore(current);
  return offset;
}

/**
 * Dia y hora de un partido.
 *
 * Los partidos de una misma fecha se reparten en dias consecutivos —como pasa
 * de verdad—, pero nunca mas alla del dia anterior a la fecha siguiente: si
 * hay tres dias de descanso, la fecha entra en dos dias y no en cuatro.
 */
export function fixtureDate(round: number, indexInRound: number): { date: string; time: string } {
  const start = new Date(`${SEASON_START}T12:00:00`);
  const spread = Math.max(1, Math.min(4, restDaysBefore(round + 1) - 1));
  start.setDate(start.getDate() + dayOffsetOfRound(round) + (indexInRound % spread));
  return {
    date: start.toISOString().slice(0, 10),
    time: KICKOFFS[indexInRound % KICKOFFS.length] as string,
  };
}

/** El fixture del torneo. Determinista: la semilla lo define por completo. */
export function seasonFixtures(seed: string): readonly SeasonFixture[] {
  return buildRoundRobin(LEAGUE_CLUB_IDS, seed);
}

/**
 * El calendario en el formato de la interfaz, con el resultado puesto donde
 * ya se jugo.
 */
export function toUiFixtures(
  fixtures: readonly SeasonFixture[],
  records: readonly MatchRecord[],
): readonly Fixture[] {
  const byId = new Map(records.map((record) => [record.fixtureId, record]));
  const seen = new Map<number, number>();

  return fixtures.map((fixture) => {
    const index = seen.get(fixture.round) ?? 0;
    seen.set(fixture.round, index + 1);
    const { date, time } = fixtureDate(fixture.round, index);
    const record = byId.get(fixture.id);

    return {
      id: fixture.id,
      round: fixture.round,
      date,
      time,
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      competition: 'Liga Profesional',
      score: record ? { home: record.homeGoals, away: record.awayGoals } : null,
    };
  });
}

/** La tabla del torneo, calculada desde los partidos jugados. */
export function seasonTable(records: readonly MatchRecord[]): readonly TableRow[] {
  return buildTable(
    LEAGUE_CLUB_IDS,
    records.map((record) => ({
      round: record.round,
      homeClubId: record.homeClubId,
      awayClubId: record.awayClubId,
      homeGoals: record.homeGoals,
      awayGoals: record.awayGoals,
    })),
    (id) => clubById(id).name,
  );
}

/** La tabla en el formato que ya consumen los widgets del despacho. */
export function toUiTable(table: readonly TableRow[]): readonly LeagueRow[] {
  return table.map((row) => ({
    clubId: row.clubId,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    form: row.form,
  }));
}

/** Los partidos de un club, del mas reciente al mas viejo. */
export function recordsOfClub(
  records: readonly MatchRecord[],
  clubId: string,
): readonly MatchRecord[] {
  return records
    .filter((record) => record.homeClubId === clubId || record.awayClubId === clubId)
    .slice()
    .sort((a, b) => b.round - a.round);
}

export function recordOfFixture(
  records: readonly MatchRecord[],
  fixtureId: string,
): MatchRecord | undefined {
  return records.find((record) => record.fixtureId === fixtureId);
}

/** El resultado de un partido visto desde un club. */
export function outcomeOf(record: MatchRecord, clubId: string): 'V' | 'E' | 'D' {
  const isHome = record.homeClubId === clubId;
  const own = isHome ? record.homeGoals : record.awayGoals;
  const rival = isHome ? record.awayGoals : record.homeGoals;
  if (own > rival) return 'V';
  if (own === rival) return 'E';
  return 'D';
}

/**
 * Animo por la posicion en la tabla, -1 a +1 (seccion 35).
 *
 * Primero da +1, ultimo da -1. Lo consume la progresion: pelear el campeonato
 * levanta la moral del plantel y estar ultimo la hunde, y eso no deberia
 * depender de que el manager lo mire en pantalla.
 */
export function tableMood(position: number, total: number): number {
  if (total <= 1) return 0;
  return 1 - ((position - 1) / (total - 1)) * 2;
}
