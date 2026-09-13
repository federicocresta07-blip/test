/**
 * LOS PLANTELES DE TODO EL TORNEO — Apertura 1998.
 *
 * Los veinte planteles son REALES: salen de `EQ003003.PKF`, el archivo de
 * equipos de PC Apertura 6.0, con sus 462 jugadores, sus dorsales y los diez
 * atributos que guarda el juego. Antes los diecinueve rivales se generaban
 * con niveles inventados; ya no hace falta inventar nada.
 *
 * Las TACTICAS tambien son las del archivo. El PKF guarda por club el
 * porcentaje de toque, el de contragolpe, el tipo de ataque, el tipo de
 * entradas, el marcaje, los despejes y la presion, y todo eso mapea a la
 * tactica del motor. Asi que los rivales juegan como jugaban.
 *
 * La FORMACION no se pudo sacar del archivo: esta dentro del bloque de
 * "tactica definida" de 264 bytes, que no se decodifico. Se elige a partir de
 * la forma REAL del plantel —cuantos centrales, cuantos volantes, cuantos
 * delanteros tiene cada club— que si es dato. No es la formacion historica,
 * pero tampoco es un numero elegido a dedo.
 *
 * La COHESION no existe en PC Futbol y se le pone la misma a todos.
 */

import type { Player } from '../../domain/player.ts';
import { createTactics, type Tactics } from '../../domain/tactics.ts';
import { createTeam, type Team } from '../../domain/team.ts';
import { CLUBS, clubById } from './clubs.ts';
import { DEMO_SQUAD } from './squad.ts';
import {
  APERTURA98_CLUBS,
  apertura98Club,
  apertura98Squad,
  type Apertura98Club,
} from '../../data/apertura98.ts';
import { playerFromApertura98 } from '../../data/pcf-bridge.ts';
import { overallForPosition } from '../../ratings/overall.ts';
import { reputationFromStadium } from '../../domain/stadium.ts';

type Setup = {
  readonly clubId: string;
  /** Overall real del once mas fuerte del plantel del archivo. */
  readonly target: number;
  readonly chemistry: number;
  readonly tactics: Tactics;
};

/** El club que dirige el manager. */
export const USER_CLUB_ID = 'river';

/**
 * La cohesion, igual para todos.
 *
 * PC Futbol no guarda nada parecido a la cohesion de un plantel, asi que
 * cualquier reparto por club seria invento. Un valor unico es la unica opcion
 * que no fabrica una diferencia que no existe en la fuente.
 */
const PCF_CHEMISTRY = 70;

/**
 * La formacion, elegida por la forma real del plantel.
 *
 * El PKF guarda un bloque de "tactica definida" de 264 bytes que no se
 * decodifico, asi que la formacion historica no esta disponible. Lo que si es
 * dato son los puestos de los 462 jugadores, y de ahi sale una formacion que
 * el plantel puede cubrir: un club con cinco centrales y dos delanteros no
 * juega igual que uno con tres delanteros.
 */
function formationForSquad(players: readonly Player[]): string {
  const count = (positions: readonly string[]): number =>
    players.filter((p) => positions.includes(p.position)).length;
  const forwards = count(['DC', 'SD']);
  const wingers = count(['ED', 'EI']);
  const attackingMids = count(['MCO']);
  const holders = count(['MCD']);
  const centreBacks = count(['DFC']);

  if (centreBacks >= 7 && forwards <= 3) return '5-3-2';
  if (forwards >= 5 && wingers >= 3) return '4-3-3';
  if (wingers >= 4 && attackingMids >= 2) return '4-2-3-1';
  if (attackingMids >= 4) return '4-3-1-2';
  if (holders >= 3) return '4-1-4-1';
  if (forwards <= 2) return '4-5-1';
  return '4-4-2';
}

/**
 * La tactica del club, traducida del PKF.
 *
 * Los siete bytes de tactica de equipo del archivo mapean casi uno a uno a la
 * tactica del motor. Lo unico que no tiene equivalente directo es el marcaje
 * (zona u hombre), que el motor no modela como opcion separada.
 */
function tacticsFromPcf(club: Apertura98Club, formationId: string): Tactics {
  const t = club.tactics;
  const toque = t.toque ?? 50;
  const counter = t.contragolpe ?? 0;

  return createTactics({
    formationId,
    // Tipo de ataque del archivo: ofensivo, especulativo o mixto.
    mentality:
      t.ataque === 'ofensivo' ? 'ofensiva' : t.ataque === 'especulativo' ? 'defensiva' : 'equilibrada',
    // Presion: propio (baja), medio (media), rival (alta).
    pressing: t.presion === 'rival' ? 'alta' : t.presion === 'propio' ? 'baja' : 'media',
    // Entradas: suave, media o agresiva.
    aggression: t.entradas === 'agresiva' ? 'alta' : t.entradas === 'suave' ? 'baja' : 'media',
    // Porcentaje de toque: mucho toque es posesion, poco es juego directo.
    passingStyle: toque >= 70 ? 'posesion' : toque <= 55 ? 'directo' : 'mixto',
    tempo: toque >= 70 ? 'lento' : toque <= 55 ? 'rapido' : 'equilibrado',
    // Despejes largos empujan la linea atras.
    defensiveLine: t.despejes === 'largo' ? 'baja' : 'media',
    counterAttack: counter >= 55,
  });
}

/** El once mas fuerte que permite el plantel, como medida del nivel del club. */
function squadStrength(players: readonly Player[]): number {
  const best = players
    .map((p) => overallForPosition(p.attributes, p.position))
    .sort((a, b) => b - a)
    .slice(0, 11);
  if (best.length === 0) return 60;
  return Math.round(best.reduce((total, value) => total + value, 0) / best.length);
}

/**
 * La reputacion del club, derivada de sus socios y su estadio.
 *
 * Los dos numeros estan en el archivo. El motor usa la reputacion para la
 * presion del partido, no para decidir el resultado, asi que lo que importa
 * es el orden relativo: River con 63.000 socios y 76.687 de capacidad pesa
 * distinto que Platense con 7.500 y 12.657.
 */
function reputationFromClub(club: Apertura98Club): number {
  // La cuenta esta en `domain/stadium.ts`, que es el unico lugar donde vive.
  //
  // Aca habia una segunda formula, con logaritmos, que daba EXACTAMENTE el
  // mismo orden de los veinte clubes pero otros valores absolutos. Dos
  // formulas para el mismo concepto es una fuente de verdad de mas: cuando la
  // fase 6 necesito la reputacion para la television y el sponsor, esta se
  // borro y quedo la del dominio.
  return reputationFromStadium({
    name: club.stadium ?? '',
    capacity: club.capacity ?? 15_000,
    members: club.members ?? 2_000,
  });
}

const SQUAD_CACHE = new Map<string, readonly Player[]>();

function squadFor(clubId: string): readonly Player[] {
  const cached = SQUAD_CACHE.get(clubId);
  if (cached) return cached;
  const players = apertura98Squad(clubId).map((raw) => playerFromApertura98(raw, clubId));
  SQUAD_CACHE.set(clubId, players);
  return players;
}

/**
 * Los diecinueve rivales, armados desde el archivo.
 *
 * Ya no hay lista escrita a mano: los clubes, sus planteles, sus tacticas y
 * su nivel salen todos de `apertura98.ts`.
 */
const RIVALS: readonly Setup[] = APERTURA98_CLUBS.filter((club) => club.id !== USER_CLUB_ID).map(
  (club) => {
    const players = squadFor(club.id);
    const formationId = formationForSquad(players);
    return {
      clubId: club.id,
      target: squadStrength(players),
      chemistry: PCF_CHEMISTRY,
      tactics: tacticsFromPcf(club, formationId),
    };
  },
);

export const LEAGUE_SETUP: readonly Setup[] = RIVALS;

/** Los clubes que juegan el torneo, empezando por el del manager. */
export const LEAGUE_CLUB_IDS: readonly string[] = [
  USER_CLUB_ID,
  ...RIVALS.map((entry) => entry.clubId),
];

/** El plantel real del rival, del archivo del juego. */
function rivalSquad(entry: Setup): readonly Player[] {
  return squadFor(entry.clubId);
}

function rivalTeam(entry: Setup): Team {
  const club = clubById(entry.clubId);
  return createTeam({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    players: rivalSquad(entry),
    chemistry: entry.chemistry,
    tactics: entry.tactics,
    reputation: reputationFromClub(apertura98Club(entry.clubId)),
  });
}

/**
 * El equipo del club del manager.
 *
 * `extra` son los juveniles que el manager subio al plantel profesional (fase
 * 4). Entran como cualquier otro jugador: el motor no distingue, y por eso un
 * juvenil promovido compite por el puesto de verdad.
 */
export function userTeam(
  tactics?: Tactics,
  chemistry = 74,
  extra: readonly Player[] = [],
): Team {
  const club = clubById(USER_CLUB_ID);
  return createTeam({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    players: [...DEMO_SQUAD.map((entry) => entry.player), ...extra],
    chemistry,
    ...(tactics ? { tactics } : {}),
    reputation: reputationFromClub(apertura98Club(USER_CLUB_ID)),
  });
}

let cachedRivals: Map<string, Team> | null = null;

/**
 * Los diecinueve rivales, generados una sola vez por sesion.
 *
 * Generar 418 jugadores con sus atributos no es gratis, y la interfaz los
 * pide en cada render de la tabla y del calendario. Como el resultado es
 * determinista, calcularlo una vez y reusarlo no cambia nada.
 */
export function rivalTeams(): ReadonlyMap<string, Team> {
  if (!cachedRivals) {
    cachedRivals = new Map(RIVALS.map((entry) => [entry.clubId, rivalTeam(entry)]));
  }
  return cachedRivals;
}

/** Todos los equipos del torneo, con el del manager incluido. */
export function leagueTeams(
  userTactics?: Tactics,
  userChemistry?: number,
  userExtra: readonly Player[] = [],
): ReadonlyMap<string, Team> {
  const teams = new Map(rivalTeams());
  teams.set(USER_CLUB_ID, userTeam(userTactics, userChemistry, userExtra));
  return teams;
}

/** Solo los clubes del torneo, en el orden en que los muestra la interfaz. */
export const LEAGUE_CLUBS = CLUBS.filter((club) => LEAGUE_CLUB_IDS.includes(club.id));

/** Nivel declarado de un club: lo usa la pantalla de rivales. */
export function declaredTarget(clubId: string): number | null {
  if (clubId === USER_CLUB_ID) return null;
  return RIVALS.find((entry) => entry.clubId === clubId)?.target ?? null;
}
