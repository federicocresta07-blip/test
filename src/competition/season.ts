/**
 * LA FECHA DEL TORNEO: jugar todos los partidos y guardar lo que paso.
 *
 * Tres decisiones ordenan este archivo.
 *
 * 1. TODOS LOS PARTIDOS PASAN POR EL MISMO MOTOR. El del manager y los nueve
 *    de IA contra IA se resuelven con `simulateMatch`, sin atajos ni
 *    resultados sorteados (seccion 49). Un torneo donde el rival se simula
 *    distinto que uno mismo no es un torneo.
 *
 * 2. SE GUARDA UN RESUMEN, NO EL PARTIDO ENTERO. Un `MatchResult` completo
 *    trae los objetos `Player` de los treinta y pico de jugadores: guardar
 *    190 de esos no entra en el almacenamiento del navegador. Se guarda lo
 *    que la interfaz necesita mostrar. Del partido del manager se guarda
 *    todo; de los de IA, el marcador, las estadisticas de equipo y quienes
 *    hicieron algo.
 *
 * 3. LA TABLA NO SE GUARDA. Sale de los partidos con `buildTable`.
 */

import type { ConfigOverrides } from '../config/engine-config.ts';
import type { LineupOverride } from '../domain/lineup.ts';
import type { ProgressionStaffEffects } from '../domain/staff.ts';
import type { Team } from '../domain/team.ts';
import { simulateMatch } from '../engine/match-engine.ts';
import { InsufficientPlayersError } from '../domain/lineup.ts';
import type {
  MatchEventType,
  MatchResult,
  PlayerMatchStats,
  TeamMatchStats,
} from '../engine/match-types.ts';
import { updateAfterMatch, type InjuryReport } from '../progression/after-match.ts';
import { fixturesOfRound, type SeasonFixture } from './fixtures.ts';
import type { PlayedMatch } from './table.ts';

/** Linea individual guardada de un partido. */
export type MatchPlayerLine = {
  readonly playerId: string;
  readonly playerName: string;
  readonly clubId: string;
  readonly position: string;
  readonly minutes: number;
  readonly goals: number;
  readonly assists: number;
  readonly rating: number;
  readonly yellowCards: number;
  readonly redCard: boolean;
  readonly injured: boolean;
  readonly wasStarter: boolean;
};

/** Evento guardado: solo los que la interfaz muestra en la ficha del partido. */
export type MatchEventLine = {
  readonly minute: number;
  readonly type: MatchEventType;
  readonly clubId: string;
  readonly playerName: string;
  readonly detail: string;
};

/** Eventos que guarda el partido del manager: el minuto a minuto completo. */
const KEPT_EVENTS: readonly MatchEventType[] = [
  'gol',
  'amarilla',
  'roja',
  'lesion',
  'cambio',
  'penal errado',
];

/**
 * Eventos que guarda un partido de IA: los que cambian el resultado o la
 * historia del torneo. Las amarillas, los cambios y las lesiones de los otros
 * diecinueve clubes costarian unos 300 kB por temporada y no se muestran en
 * ninguna pantalla.
 */
const KEPT_EVENTS_AI: readonly MatchEventType[] = ['gol', 'roja'];

/**
 * Lo que queda de un partido jugado.
 *
 * `linesComplete` dice si estan todas las lineas individuales o solo las de
 * quienes hicieron algo. La interfaz lo consulta antes de prometer un plantel
 * completo: preferimos decir "de este partido guardamos el resumen" antes que
 * mostrar una lista a la que le faltan jugadores sin avisar.
 */
export type MatchRecord = {
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly homeStats: TeamMatchStats;
  readonly awayStats: TeamMatchStats;
  readonly events: readonly MatchEventLine[];
  readonly lines: readonly MatchPlayerLine[];
  readonly linesComplete: boolean;
  /** El club del manager jugo este partido. */
  readonly userMatch: boolean;
  readonly narrative: string;
  readonly tacticalNotes: readonly string[];
  readonly manOfTheMatchId: string;
  readonly manOfTheMatchName: string;
  readonly projection: {
    readonly homeWin: number;
    readonly draw: number;
    readonly awayWin: number;
    readonly xgHome: number;
    readonly xgAway: number;
  };
};

export type RoundInput = {
  readonly fixtures: readonly SeasonFixture[];
  readonly round: number;
  readonly teams: ReadonlyMap<string, Team>;
  /** Club del manager: su partido usa la alineacion que eligio. */
  readonly userClubId: string;
  readonly userLineup?: LineupOverride | undefined;
  readonly seed: string | number;
  /** Dias hasta la proxima fecha: definen cuanto se recupera el plantel. */
  readonly restDays?: number;
  readonly staff?: ProgressionStaffEffects | undefined;
  readonly config?: ConfigOverrides | undefined;
  /** Posicion del club en la tabla y total de equipos, para el animo (seccion 35). */
  readonly tableMood?: number | undefined;
};

export type RoundOutcome = {
  readonly records: readonly MatchRecord[];
  /** Los equipos con la progresion ya aplicada. No se muta ninguno. */
  readonly teams: ReadonlyMap<string, Team>;
  /** El partido del manager completo, para la pantalla de partido. */
  readonly userResult: MatchResult | null;
  readonly injuries: readonly InjuryReport[];
  readonly suspensions: readonly { readonly playerId: string; readonly playerName: string; readonly matches: number }[];
  /** Partidos que no se pudieron jugar y por que. */
  readonly skipped: readonly { readonly fixtureId: string; readonly reason: string }[];
};

function lineOf(entry: PlayerMatchStats, clubId: string): MatchPlayerLine {
  return {
    playerId: entry.player.id,
    playerName: entry.player.name,
    clubId,
    position: entry.position,
    minutes: entry.minutesPlayed,
    goals: entry.goals,
    assists: entry.assists,
    rating: entry.rating,
    yellowCards: entry.yellowCards,
    redCard: entry.redCard,
    injured: entry.injured,
    wasStarter: entry.wasStarter,
  };
}

/** Hizo algo que valga la pena recordar de un partido que no es del manager. */
function contributed(entry: PlayerMatchStats): boolean {
  return (
    entry.goals > 0 ||
    entry.assists > 0 ||
    entry.yellowCards > 0 ||
    entry.redCard ||
    entry.injured
  );
}

function toRecord(
  fixture: SeasonFixture,
  result: MatchResult,
  userMatch: boolean,
): MatchRecord {
  const all = [
    ...result.home.players.map((entry) => ({ line: lineOf(entry, fixture.homeClubId), entry })),
    ...result.away.players.map((entry) => ({ line: lineOf(entry, fixture.awayClubId), entry })),
  ];

  return {
    fixtureId: fixture.id,
    round: fixture.round,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeGoals: result.score.home,
    awayGoals: result.score.away,
    homeStats: result.home.stats,
    awayStats: result.away.stats,
    events: result.events
      .filter((event) => (userMatch ? KEPT_EVENTS : KEPT_EVENTS_AI).includes(event.type))
      .map((event) => ({
        minute: event.minute,
        type: event.type,
        clubId: event.side === 'local' ? fixture.homeClubId : fixture.awayClubId,
        playerName: event.playerName ?? '',
        detail: event.detail,
      })),
    lines: all
      .filter(({ entry }) => userMatch || contributed(entry))
      .map(({ line }) => line),
    linesComplete: userMatch,
    userMatch,
    // El relato solo del partido propio: es lo unico que se lee.
    narrative: userMatch ? result.narrative : '',
    tacticalNotes: userMatch ? result.tacticalNotes : [],
    manOfTheMatchId: result.manOfTheMatch.player.id,
    manOfTheMatchName: result.manOfTheMatch.player.name,
    projection: {
      homeWin: result.projection.probabilities.homeWin,
      draw: result.projection.probabilities.draw,
      awayWin: result.projection.probabilities.awayWin,
      xgHome: result.projection.expectedGoalsHome,
      xgAway: result.projection.expectedGoalsAway,
    },
  };
}

/**
 * Juega una fecha completa.
 *
 * Devuelve equipos nuevos: nunca muta los que recibe, igual que el motor de
 * partido. El que llama decide si los guarda.
 */
export function playRound(input: RoundInput): RoundOutcome {
  const matches = fixturesOfRound(input.fixtures, input.round);
  const records: MatchRecord[] = [];
  const skipped: { fixtureId: string; reason: string }[] = [];
  const updated = new Map(input.teams);
  const injuries: InjuryReport[] = [];
  const suspensions: { playerId: string; playerName: string; matches: number }[] = [];
  let userResult: MatchResult | null = null;

  for (const fixture of matches) {
    const home = updated.get(fixture.homeClubId);
    const away = updated.get(fixture.awayClubId);
    if (!home || !away) {
      skipped.push({ fixtureId: fixture.id, reason: 'No tenemos el plantel de uno de los dos clubes' });
      continue;
    }

    const isUser = fixture.homeClubId === input.userClubId || fixture.awayClubId === input.userClubId;
    const userIsHome = fixture.homeClubId === input.userClubId;

    let result: MatchResult;
    try {
      result = simulateMatch({
        home,
        away,
        seed: `${input.seed}:${fixture.id}`,
        // Un partido de torneo no es un amistoso ni una final.
        importance: 0.5,
        ...(isUser && input.userLineup
          ? userIsHome
            ? { homeLineup: input.userLineup }
            : { awayLineup: input.userLineup }
          : {}),
        ...(input.config ? { config: input.config } : {}),
      });
    } catch (cause: unknown) {
      // Un club sin once disponible no rompe la fecha: se informa y sigue.
      // Es un estado del juego, no un error de la simulacion (seccion 38).
      //
      // Cualquier otro error SI se propaga. Atraparlo todo aca nos costo una
      // tarde: un id de formacion mal escrito dejo a un club sin jugar las 19
      // fechas y el sintoma fue un "no se pudo simular" sin causa.
      if (!(cause instanceof InsufficientPlayersError)) throw cause;
      skipped.push({ fixtureId: fixture.id, reason: cause.message });
      continue;
    }

    records.push(toRecord(fixture, result, isUser));
    if (isUser) userResult = result;

    for (const side of ['local', 'visitante'] as const) {
      const clubId = side === 'local' ? fixture.homeClubId : fixture.awayClubId;
      const team = side === 'local' ? home : away;
      const isUserTeam = clubId === input.userClubId;

      const progression = updateAfterMatch({
        team,
        result,
        side,
        ...(input.restDays !== undefined ? { restDays: input.restDays } : {}),
        // El staff solo lo tiene el club del manager: de los demas no
        // simulamos el cuerpo tecnico, y decirlo es mas honesto que darles
        // uno inventado.
        ...(isUserTeam && input.staff ? { staff: input.staff } : {}),
        ...(isUserTeam && input.tableMood !== undefined ? { tableMood: input.tableMood } : {}),
      });
      updated.set(clubId, progression.team);

      if (isUserTeam) {
        injuries.push(...progression.injuries);
        suspensions.push(...progression.suspensions);
      }
    }
  }

  return { records, teams: updated, userResult, injuries, suspensions, skipped };
}

/** Los partidos guardados, en la forma que espera la tabla de posiciones. */
export function toPlayedMatches(records: readonly MatchRecord[]): readonly PlayedMatch[] {
  return records.map((record) => ({
    round: record.round,
    homeClubId: record.homeClubId,
    awayClubId: record.awayClubId,
    homeGoals: record.homeGoals,
    awayGoals: record.awayGoals,
  }));
}
