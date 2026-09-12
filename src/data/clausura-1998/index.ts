/**
 * TORNEO CLAUSURA 1998 — CARGA AL MOTOR
 *
 * Convierte los planteles históricos en equipos que el motor puede simular.
 * Los atributos se generan con `attributesFor`, que arma el perfil del puesto
 * para el overall estimado y respeta los rasgos distintivos que se le pasen.
 *
 * Un plantel con menos de once jugadores cargados no se puede poner en cancha:
 * `playableTeams()` devuelve solo los que alcanzan, y `missingSquads()` dice
 * cuáles faltan y cuánto.
 */

import { attributesFor } from '../squad-builder.ts';
import { createPlayer, type Player } from '../../domain/player.ts';
import { createTactics, type Tactics } from '../../domain/tactics.ts';
import { createTeam, type Team } from '../../domain/team.ts';
import { clausura1998Club, CLAUSURA_1998_CLUBS, type HistoricalClub } from './clubs.ts';
import {
  CLAUSURA_1998_SQUADS,
  clausura1998Squad,
  type HistoricalPlayerEntry,
  type HistoricalSquad,
} from './squads.ts';
import { CLAUSURA_1998_TABLE } from './standings.ts';

export * from './clubs.ts';
export * from './squads.ts';
export * from './standings.ts';

/** Identificador estable del jugador dentro del dataset. */
function playerId(clubId: string, entry: HistoricalPlayerEntry, index: number): string {
  const slug = entry.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
  return `c98-${clubId}-${slug || index + 1}`;
}

/**
 * Convierte una entrada histórica en un jugador del motor.
 *
 * La edad, cuando no se conoce, queda en 26: es la media de un plantel de
 * Primera y afecta poco. La forma, la moral y la fatiga arrancan neutras,
 * porque son estado de temporada y no dato histórico del torneo.
 */
export function toEnginePlayer(
  clubId: string,
  entry: HistoricalPlayerEntry,
  index: number,
): Player {
  return createPlayer({
    id: playerId(clubId, entry, index),
    name: entry.name,
    position: entry.position,
    age: entry.age ?? 26,
    attributes: attributesFor(entry.position, entry.estimatedRating, entry.estimatedTraits ?? {}),
    secondaryPositions: entry.secondaryPositions ?? [],
    condition: { form: 60, morale: 65, fatigue: 10, sharpness: 90 },
  });
}

/** Táctica por defecto de un equipo del torneo. Se puede sobreescribir. */
function defaultTactics(): Tactics {
  return createTactics({
    formationId: '4-4-2',
    mentality: 'equilibrada',
    pressing: 'media',
    tempo: 'equilibrado',
    passingStyle: 'mixto',
  });
}

export type HistoricalTeam = {
  readonly club: HistoricalClub;
  readonly squad: HistoricalSquad;
  readonly team: Team;
  /** Tiene los once para poder jugar. */
  readonly playable: boolean;
};

/** Arma el equipo del motor para un club del torneo. */
export function buildHistoricalTeam(clubId: string, tactics?: Tactics): HistoricalTeam {
  const club = clausura1998Club(clubId);
  const squad = clausura1998Squad(clubId);
  const players = squad.players.map((entry, index) => toEnginePlayer(clubId, entry, index));

  return {
    club,
    squad,
    team: createTeam({
      id: club.id,
      name: club.name,
      shortName: club.shortName,
      players,
      // La cohesión de un plantel real de mitad de temporada: ya se conocen.
      chemistry: 70,
      reputation: reputationFromTable(clubId),
      tactics: tactics ?? defaultTactics(),
    }),
    playable: players.length >= 11,
  };
}

/** Reputación derivada de la posición final: es lo único objetivo que tenemos. */
function reputationFromTable(clubId: string): number {
  const row = CLAUSURA_1998_TABLE.find((entry) => entry.clubId === clubId);
  if (!row) return 60;
  // 1º -> 88, 20º -> 50
  return Math.round(88 - ((row.position - 1) / 19) * 38);
}

/** Todos los equipos del torneo, jugables o no. */
export function allHistoricalTeams(): readonly HistoricalTeam[] {
  return CLAUSURA_1998_CLUBS.map((club) => buildHistoricalTeam(club.id));
}

/** Solo los que tienen plantel suficiente para simular. */
export function playableTeams(): readonly HistoricalTeam[] {
  return allHistoricalTeams().filter((entry) => entry.playable);
}

/** Los que todavía no alcanzan para poner un once, y cuánto les falta. */
export function missingSquads(): readonly {
  readonly clubId: string;
  readonly clubName: string;
  readonly loaded: number;
  readonly missing: number;
  readonly confidence: HistoricalSquad['confidence'];
}[] {
  return CLAUSURA_1998_SQUADS.filter((squad) => squad.players.length < 11).map((squad) => ({
    clubId: squad.clubId,
    clubName: clausura1998Club(squad.clubId).name,
    loaded: squad.players.length,
    missing: 11 - squad.players.length,
    confidence: squad.confidence,
  }));
}

/**
 * El cruce disponible hoy: el campeón contra el subcampeón.
 *
 * Las formaciones son INFERENCIA nuestra: las fuentes dan el once titular,
 * no el sistema. Se eligieron las que acomodan a esos once en su puesto
 * natural — 4-3-3 para Vélez, que tenía tres delanteros con Cordone abierto,
 * y 4-4-2 para Lanús, con Bartelt y Belloso arriba.
 */
export function velezVsLanus(): { home: Team; away: Team } {
  return {
    home: buildHistoricalTeam('velez', createTactics({
      formationId: '4-3-3',
      mentality: 'ofensiva',
      pressing: 'alta',
      tempo: 'rapido',
      passingStyle: 'mixto',
    })).team,
    away: buildHistoricalTeam('lanus', createTactics({
      formationId: '4-4-2',
      mentality: 'equilibrada',
      pressing: 'media',
      passingStyle: 'mixto',
    })).team,
  };
}
