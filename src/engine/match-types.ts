/**
 * Tipos del resultado de un partido (secciones 50, 51).
 */

import type { Player } from '../domain/player.ts';
import type { Position } from '../domain/positions.ts';
import type { Tactics } from '../domain/tactics.ts';
import type { DimensionRatings } from '../domain/dimensions.ts';
import type { ChanceKind, Side } from './chances.ts';
import type { KeyPlayer } from '../ratings/team-strength.ts';

export type MatchEventType =
  | 'gol'
  | 'ocasion'
  | 'atajada'
  | 'amarilla'
  | 'roja'
  | 'lesion'
  | 'cambio'
  | 'instruccion'
  | 'penal errado';

export type MatchEvent = {
  readonly minute: number;
  readonly type: MatchEventType;
  readonly side: Side;
  readonly playerId?: string | undefined;
  readonly playerName?: string | undefined;
  readonly secondPlayerId?: string | undefined;
  readonly secondPlayerName?: string | undefined;
  readonly chanceKind?: ChanceKind | undefined;
  readonly xg?: number | undefined;
  readonly detail: string;
};

/** Estadisticas de equipo del partido (seccion 50). */
export type TeamMatchStats = {
  readonly goals: number;
  readonly possession: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xg: number;
  readonly corners: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly bigChances: number;
  readonly bigChancesMissed: number;
  readonly saves: number;
  readonly penalties: number;
  readonly setPieceShots: number;
  readonly counterAttackShots: number;
};

/** Linea individual de un jugador en el partido (seccion 50). */
export type PlayerMatchStats = {
  readonly player: Player;
  readonly position: Position;
  readonly minutesPlayed: number;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly xg: number;
  readonly chancesCreated: number;
  readonly bigChancesMissed: number;
  readonly saves: number;
  readonly goalsConceded: number;
  readonly yellowCards: number;
  readonly redCard: boolean;
  readonly injured: boolean;
  readonly fouls: number;
  /** Nota del partido, 3.0 .. 10.0. */
  readonly rating: number;
  /** Rendimiento efectivo con el que jugo (seccion 27). */
  readonly effectiveRating: number;
  readonly wasStarter: boolean;
};

/** Proyeccion previa del motor (seccion 44). */
export type MatchProjection = {
  readonly expectedGoalsHome: number;
  readonly expectedGoalsAway: number;
  readonly expectedShotsHome: number;
  readonly expectedShotsAway: number;
  readonly possessionHome: number;
  /** Probabilidades analiticas derivadas de los goles esperados. */
  readonly probabilities: {
    readonly homeWin: number;
    readonly draw: number;
    readonly awayWin: number;
  };
};

/** Radiografia de un equipo en el partido, para mostrar en la interfaz. */
export type TeamMatchReport = {
  readonly teamId: string;
  readonly teamName: string;
  readonly shortName: string;
  /** Tactica con la que termino el partido (puede haber cambiado, seccion 47). */
  readonly tactics: Tactics;
  /** Tactica con la que arranco. */
  readonly initialTactics: Tactics;
  /** Fuerza del once inicial: es la que definio el partido (seccion 30). */
  readonly dimensions: DimensionRatings;
  readonly goalkeeperRating: number;
  readonly chemistry: number;
  readonly averageOverall: number;
  readonly keyPlayers: readonly KeyPlayer[];
  readonly stats: TeamMatchStats;
  readonly players: readonly PlayerMatchStats[];
  readonly startingXI: readonly string[];
};

export type MatchResult = {
  readonly seed: number | string;
  readonly home: TeamMatchReport;
  readonly away: TeamMatchReport;
  readonly score: { readonly home: number; readonly away: number };
  /** Marcador listo para mostrar: "RIVER PLATE 2 - 1 RACING CLUB". */
  readonly scoreline: string;
  readonly events: readonly MatchEvent[];
  readonly projection: MatchProjection;
  readonly manOfTheMatch: PlayerMatchStats;
  /** Relato del partido basado en lo que paso de verdad (seccion 51). */
  readonly narrative: string;
  /** Notas de los cruces tacticos que influyeron (seccion 32). */
  readonly tacticalNotes: readonly string[];
};
