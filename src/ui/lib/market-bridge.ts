/**
 * PUENTE CON EL MERCADO (secciones 10, 11 — fase 5).
 *
 * Arma el pool de jugadores que el club puede mirar y les pone encima la
 * precision que el club tiene. Igual que `engine-bridge.ts` y
 * `season-bridge.ts`, es el unico lugar donde se hace esta traduccion.
 *
 * La pieza importante: un jugador ajeno NO se muestra con su overall exacto.
 * Se muestra con el informe del ojeador, cuyo margen sale del efecto del rol.
 * Sin eso, el ojeador y el secretario tecnico no tendrian para que existir, y
 * seguirian diciendo "todavia no se aplica".
 */

import { appraise, squadNeed, valuePlayer, type PlayerAppraisal } from '../../domain/market.ts';
import type { Player } from '../../domain/player.ts';
import type { Team } from '../../domain/team.ts';
import type { Position } from '../../domain/positions.ts';
import { staffEffect, staffSpec } from '../../domain/staff.ts';
import type { ClubFacility, StaffMember } from '../models/index.ts';
import { leagueTeams, USER_CLUB_ID } from '../data/league.ts';

/**
 * Contrato tipico de un jugador de un club de IA.
 *
 * No simulamos los contratos de los otros diecinueve clubes: seria inventar
 * 418 fechas sin que nadie las use. Se usa un contrato medio y la pantalla lo
 * dice, en lugar de mostrar una fecha inventada como si fuera un dato.
 */
export const RIVAL_CONTRACT_MONTHS = 24;

/** La precision con la que el club mira el mercado. */
export type MarketPrecision = {
  /** Margen del ojeador en puntos de overall. 0 = ve exacto. */
  readonly scoutMargin: number;
  /** Error del secretario tecnico sobre el valor, en porcentaje. */
  readonly valuerError: number;
  readonly hasScout: boolean;
  readonly hasValuer: boolean;
  /** Que falta y que se destraba al cubrirlo. */
  readonly missing: readonly string[];
};

/**
 * Margen cuando el puesto de ojeador esta vacante.
 *
 * Peor que el de un ojeador de una estrella: sin nadie mirando, el club se
 * guia por lo que vio en un partido.
 */
const NO_SCOUT_MARGIN = 14;

/** Error del valor cuando no hay secretario tecnico. */
const NO_VALUER_ERROR = 30;

export function marketPrecision(
  staff: readonly StaffMember[],
  facilities: readonly ClubFacility[],
): MarketPrecision {
  const effectOf = (role: 'Ojeador' | 'Secretario técnico'): number | null => {
    const member = staff.find((entry) => entry.role === role);
    if (!member) return null;
    const facility = staffSpec(role).facility;
    const level = facilities.find((entry) => entry.id === facility)?.level ?? 1;
    return staffEffect(role, member.level, level).actual;
  };

  const scout = effectOf('Ojeador');
  const valuer = effectOf('Secretario técnico');
  const missing: string[] = [];
  if (scout === null) missing.push('Sin ojeador, el nivel de un jugador ajeno se estima con ±14 puntos de error.');
  if (valuer === null) missing.push('Sin secretario técnico, su valor de mercado se estima con un 30% de error.');

  return {
    scoutMargin: scout ?? NO_SCOUT_MARGIN,
    valuerError: valuer ?? NO_VALUER_ERROR,
    hasScout: scout !== null,
    hasValuer: valuer !== null,
    missing,
  };
}

/** Un jugador del mercado, tal como lo ve el club. */
export type MarketPlayer = {
  readonly id: string;
  readonly name: string;
  readonly clubId: string;
  readonly position: Position;
  readonly age: number;
  /** Lo que el informe dice. Nunca el overall exacto de un jugador ajeno. */
  readonly appraisal: PlayerAppraisal;
  /** Su club lo puso en la lista de transferibles. */
  readonly listed: boolean;
  /** Cuanto lo necesita su club, 0..1: define lo que van a pedir. */
  readonly need: number;
  /** El jugador real. La pantalla muestra el informe, no esto. */
  readonly player: Player;
};

export type MarketPoolInput = {
  readonly precision: MarketPrecision;
  /** Jugadores que ya cambiaron de club, para no ofrecerlos dos veces. */
  readonly transferredIds: readonly string[];
  /** Quien puso a quien en la lista, por id de jugador. */
  readonly listedIds: readonly string[];
  /**
   * Temporadas cerradas (fase 8).
   *
   * Hace falta porque los planteles rivales envejecen: sin esto el mercado
   * ofreceria el Boca de 1998 en la temporada cinco, con jugadores que ya se
   * retiraron y con las edades —y por lo tanto los valores— equivocados.
   */
  readonly seasonsClosed?: number;
};

/**
 * Todos los jugadores de los otros clubes, con su informe.
 *
 * Es determinista: los planteles rivales se generan siempre igual y el informe
 * se sortea con el id del jugador, asi que el mercado no cambia entre
 * recargas. Un mercado que se reordena solo cada vez que uno entra seria
 * imposible de usar.
 */
export function marketPool(input: MarketPoolInput): readonly MarketPlayer[] {
  const teams = leagueTeams(undefined, undefined, [], 0, input.seasonsClosed ?? 0);
  const transferred = new Set(input.transferredIds);
  const listed = new Set(input.listedIds);
  const pool: MarketPlayer[] = [];

  for (const [clubId, team] of teams) {
    if (clubId === USER_CLUB_ID) continue;
    for (const player of team.players) {
      if (transferred.has(player.id)) continue;
      pool.push({
        id: player.id,
        name: player.name,
        clubId,
        position: player.position,
        age: player.age,
        appraisal: appraise({
          player,
          contractMonths: RIVAL_CONTRACT_MONTHS,
          scoutMargin: input.precision.scoutMargin,
          valuerError: input.precision.valuerError,
          blind: !input.precision.hasScout,
        }),
        listed: listed.has(player.id),
        need: squadNeed(player, team.players),
        player,
      });
    }
  }

  return pool;
}

/** Los que su club puso en el mercado. */
export function transferListed(pool: readonly MarketPlayer[]): readonly MarketPlayer[] {
  return pool.filter((entry) => entry.listed);
}

/** El valor REAL de un jugador del pool. Solo para el motor, no para mostrar. */
export function trueValueOf(entry: MarketPlayer): number {
  return valuePlayer({ player: entry.player, contractMonths: RIVAL_CONTRACT_MONTHS }).value;
}

// ============================================================
// Filtros del buscador
// ============================================================

export type MarketFilters = {
  readonly name: string;
  readonly positions: readonly Position[];
  readonly maxAge: number | null;
  readonly minOverall: number | null;
  readonly maxValue: number | null;
  readonly onlyListed: boolean;
  readonly clubId: string | null;
};

export const EMPTY_FILTERS: MarketFilters = {
  name: '',
  positions: [],
  maxAge: null,
  minOverall: null,
  maxValue: null,
  onlyListed: false,
  clubId: null,
};

/**
 * Aplica los filtros del buscador.
 *
 * Ojo con un detalle: el filtro de overall trabaja sobre el overall INFORMADO,
 * no sobre el real. Con un ojeador flojo, pedir "overall 80 o mas" puede
 * dejar afuera a un jugador de 82 que el informe estimo en 76 — y eso es
 * correcto, porque el club no lo sabe.
 */
export function applyFilters(
  pool: readonly MarketPlayer[],
  filters: MarketFilters,
): readonly MarketPlayer[] {
  const needle = filters.name.trim().toLowerCase();

  return pool.filter((entry) => {
    if (needle && !entry.name.toLowerCase().includes(needle)) return false;
    if (filters.positions.length > 0 && !filters.positions.includes(entry.position)) return false;
    if (filters.maxAge !== null && entry.age > filters.maxAge) return false;
    if (filters.minOverall !== null && entry.appraisal.overall < filters.minOverall) return false;
    if (filters.maxValue !== null && entry.appraisal.value > filters.maxValue) return false;
    if (filters.onlyListed && !entry.listed) return false;
    if (filters.clubId !== null && entry.clubId !== filters.clubId) return false;
    return true;
  });
}

export type MarketSort = 'overall' | 'valor' | 'edad' | 'nombre';

export function sortPool(
  pool: readonly MarketPlayer[],
  sort: MarketSort,
): readonly MarketPlayer[] {
  const copy = [...pool];
  switch (sort) {
    case 'overall':
      return copy.sort((a, b) => b.appraisal.overall - a.appraisal.overall);
    case 'valor':
      return copy.sort((a, b) => b.appraisal.value - a.appraisal.value);
    case 'edad':
      return copy.sort((a, b) => a.age - b.age || b.appraisal.overall - a.appraisal.overall);
    case 'nombre':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
}

// ============================================================
// Traspasos: quien juega en que club
// ============================================================

/**
 * Los planteles con los traspasos aplicados.
 *
 * Un traspaso saca al jugador de un plantel y lo pone en el otro. Se aplica
 * sobre los planteles generados, que son deterministas, asi que no hace falta
 * guardar 440 jugadores: alcanza con guardar los movimientos.
 */
export function applyTransfers(
  teams: ReadonlyMap<string, Team>,
  transfers: readonly { readonly playerId: string; readonly fromClubId: string; readonly toClubId: string }[],
): ReadonlyMap<string, Team> {
  if (transfers.length === 0) return teams;

  const byId = new Map<string, Player>();
  for (const team of teams.values()) {
    for (const player of team.players) byId.set(player.id, player);
  }

  const rosters = new Map<string, Player[]>();
  for (const [clubId, team] of teams) rosters.set(clubId, [...team.players]);

  for (const transfer of transfers) {
    const player = byId.get(transfer.playerId);
    if (!player) continue;
    const from = rosters.get(transfer.fromClubId);
    const to = rosters.get(transfer.toClubId);
    if (from) rosters.set(transfer.fromClubId, from.filter((entry) => entry.id !== player.id));
    if (to && !to.some((entry) => entry.id === player.id)) to.push(player);
  }

  const out = new Map<string, Team>();
  for (const [clubId, team] of teams) {
    out.set(clubId, { ...team, players: rosters.get(clubId) ?? team.players });
  }
  return out;
}

/** El jugador de cualquier club del torneo, por id. */
export function findLeaguePlayer(
  playerId: string,
  seasonsClosed = 0,
): { player: Player; clubId: string } | null {
  for (const [clubId, team] of leagueTeams(undefined, undefined, [], 0, seasonsClosed)) {
    const player = team.players.find((entry) => entry.id === playerId);
    if (player) return { player, clubId };
  }
  return null;
}
