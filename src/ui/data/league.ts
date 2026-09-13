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
import { closeSeason } from '../../progression/season-close.ts';
import { BASELINE_COACHING, developSquad } from '../../progression/development.ts';
import { defaultFocusFor } from '../../domain/training.ts';
import { MIN_PROMOTION_AGE } from '../../domain/youth.ts';
import { buildYouthSquad } from './youth.ts';
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

/**
 * El plantel de un club, N temporadas despues del Apertura 98.
 *
 * ============================================================
 * LOS RIVALES TAMBIEN ENVEJECEN (fase 8)
 * ============================================================
 *
 * Hasta ahora no: el plantel del manager cumplia anios al cerrar la temporada
 * y los diecinueve rivales quedaban congelados en 1998. Despues de cinco
 * temporadas el manager tenia un plantel renovado y enfrentaba a un Boca con
 * Riquelme de 20 para siempre. Eso vaciaba la carrera larga, que es lo unico
 * que la fase 6 vino a habilitar.
 *
 * Se resuelve con el MISMO `closeSeason` del motor que usa el club del
 * manager: tener dos formas de envejecer un plantel seria tener dos fuentes de
 * verdad, y la diferencia se notaria justo donde importa (un rival que no se
 * retira nunca).
 *
 * Es DERIVADO, no guardado. Cada temporada se aplica con una semilla fija por
 * club, asi que el Boca de la temporada 5 es siempre el mismo Boca. Guardar
 * diecinueve planteles por temporada serian megabytes de estado que se puede
 * recalcular.
 *
 * Los rivales NO tienen inferiores propias: `closeSeason` recibe una camada
 * vacia, asi que sus planteles se achican con los anios en lugar de
 * renovarse. Es una simplificacion declarada, no un olvido — ver `docs/ui.md`.
 */
function squadFor(clubId: string, seasonsClosed = 0): readonly Player[] {
  const key = `${clubId}:${seasonsClosed}`;
  const cached = SQUAD_CACHE.get(key);
  if (cached) return cached;

  let players: readonly Player[] = apertura98Squad(clubId).map((raw) =>
    playerFromApertura98(raw, clubId),
  );

  // La academia del rival sale de su REPUTACION, que sale de sus socios y su
  // aforo, que son dato del archivo. River saca mas y mejores juveniles que
  // Belgrano, y eso no lo elegimos nosotros: lo dice el PKF.
  const academyLevel = academyFor(reputationFromClub(apertura98Club(clubId)));

  for (let season = 0; season < seasonsClosed; season += 1) {
    // 1. UN ANIO DE TRABAJO. Los rivales no tienen cuerpo tecnico simulado,
    //    asi que entrenan al ritmo base (`BASELINE_COACHING`, un entrenador de
    //    dos estrellas). Sin esto los rivales cumplian anios y no cambiaban de
    //    nivel: un Riquelme de 28 seguia siendo el de 20, y un Palermo de 32
    //    tampoco se caia. Envejecer sin desarrollarse es media cosa.
    //
    //    Va FECHA POR FECHA, no de una. El desarrollo mide el margen contra el
    //    potencial una vez por llamada, asi que pedirle una temporada entera
    //    de golpe crece como si el margen del primer dia durara todo el anio:
    //    Riquelme pasaba de 84 a 93 en una temporada. Es el mismo error que
    //    aparecio con los juveniles del club del manager.
    for (let round = 0; round < ROUNDS_PER_SEASON; round += 1) {
      players = developSquad({
        players,
        weeks: WEEKS_PER_SEASON / ROUNDS_PER_SEASON,
        minutes: Object.fromEntries(
          players.map((player) => [player.id, RIVAL_SEASON_MINUTES / ROUNDS_PER_SEASON]),
        ),
        focusOf: (player) => defaultFocusFor(player.position),
        coachingOf: () => BASELINE_COACHING,
        seed: `rival:${clubId}:${season}:${round}`,
      }).players;
    }

    // 2. EL CIERRE: cumplen anios y los veteranos se retiran.
    players = closeSeason({ players, youth: [], intake: [], seed: `${clubId}:${season}` }).players;

    // 3. SUBEN JUVENILES, los mejores de su camada. Sin esto los planteles se
    //    achicaban solos —de 23 jugadores a 17 en ocho temporadas— y en unas
    //    cuantas mas no habrian podido poner once.
    //
    //    Suben DOS, no la camada entera: con seis por anio los planteles
    //    crecian a cincuenta jugadores, que no es un plantel. Un club sube a
    //    los que le sirven y deja ir al resto, y eso es lo que hace esto.
    const promoted = buildYouthSquad(clubId, academyLevel, `rival-camada:${clubId}:${season}`, 3)
      .map((entry) => entry.player)
      .filter((player) => player.age >= MIN_PROMOTION_AGE)
      .sort(
        (a, b) =>
          overallForPosition(b.attributes, b.position) -
          overallForPosition(a.attributes, a.position),
      )
      .slice(0, PROMOTED_PER_SEASON);

    players = trimSquad([...players, ...promoted]);
  }

  SQUAD_CACHE.set(key, players);
  return players;
}

/** Semanas de trabajo de una temporada de 19 fechas. */
const WEEKS_PER_SEASON = 22;
const ROUNDS_PER_SEASON = 19;

/** Cuantos juveniles sube un rival por temporada. */
const PROMOTED_PER_SEASON = 2;

/**
 * Tope de plantel de un rival.
 *
 * Un club no acumula jugadores sin fin: cuando le sobran, deja ir a los que no
 * le sirven. Sin este tope los planteles rivales crecian temporada a temporada
 * y terminaban con cincuenta jugadores.
 */
const MAX_RIVAL_SQUAD = 26;

/**
 * Deja el plantel en su tope, soltando a los peores.
 *
 * Se corta por overall y no por edad a proposito: un club deja ir al que ya no
 * le rinde, tenga 33 o 24. Un veterano que sigue siendo de los mejores se
 * queda, que es lo que pasa de verdad.
 */
function trimSquad(players: readonly Player[]): readonly Player[] {
  if (players.length <= MAX_RIVAL_SQUAD) return players;
  return [...players]
    .sort(
      (a, b) =>
        overallForPosition(b.attributes, b.position) - overallForPosition(a.attributes, a.position),
    )
    .slice(0, MAX_RIVAL_SQUAD);
}

/**
 * Minutos de una temporada para un jugador de un plantel rival.
 *
 * Es un promedio: no simulamos quien es titular en Belgrano. Con la mitad de
 * los minutos posibles, los planteles rivales crecen algo menos que el del
 * manager si el manager reparte bien los minutos, que es lo correcto.
 */
const RIVAL_SEASON_MINUTES = 900;

/**
 * El nivel de academia de un rival, derivado de su reputacion.
 *
 * No es una tabla escrita a mano por club: es la misma reputacion que decide
 * su television y su sponsor, repartida en los cinco niveles que el dominio
 * define para la instalacion.
 */
function academyFor(reputation: number): number {
  if (reputation >= 85) return 5;
  if (reputation >= 72) return 4;
  if (reputation >= 62) return 3;
  if (reputation >= 52) return 2;
  return 1;
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

/** El plantel real del rival, del archivo del juego, con los anios encima. */
function rivalSquad(entry: Setup, seasonsClosed = 0): readonly Player[] {
  return squadFor(entry.clubId, seasonsClosed);
}

function rivalTeam(entry: Setup, seasonsClosed = 0): Team {
  const club = clubById(entry.clubId);
  return createTeam({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    players: rivalSquad(entry, seasonsClosed),
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
  /**
   * Trabajo preventivo del cuerpo medico, 0..100 (fase 8).
   *
   * Sale del fisioterapeuta del club. Por defecto CERO: un equipo sin
   * fisioterapeuta no previene nada, y quien construye el equipo tiene que
   * pasarlo explicitamente para que exista.
   */
  injuryPrevention = 0,
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
    injuryPrevention,
  });
}

const RIVALS_CACHE = new Map<number, ReadonlyMap<string, Team>>();

/**
 * Los diecinueve rivales, generados una vez por temporada del juego.
 *
 * Generar 418 jugadores con sus atributos no es gratis, y la interfaz los pide
 * en cada render de la tabla y del calendario. Como el resultado es
 * determinista, calcularlo una vez y reusarlo no cambia nada.
 *
 * La clave del cache es cuantas temporadas se cerraron (fase 8): al cerrar una
 * los rivales envejecen, asi que el Boca de la temporada 3 no es el de la 0 y
 * un cache sin esa clave devolveria el equipo de otro anio.
 */
export function rivalTeams(seasonsClosed = 0): ReadonlyMap<string, Team> {
  const cached = RIVALS_CACHE.get(seasonsClosed);
  if (cached) return cached;
  const built = new Map(
    RIVALS.map((entry) => [entry.clubId, rivalTeam(entry, seasonsClosed)] as const),
  );
  RIVALS_CACHE.set(seasonsClosed, built);
  return built;
}

/** Todos los equipos del torneo, con el del manager incluido. */
export function leagueTeams(
  userTactics?: Tactics,
  userChemistry?: number,
  userExtra: readonly Player[] = [],
  /** Trabajo preventivo del club del manager, que sale de su fisioterapeuta. */
  userInjuryPrevention = 0,
  /** Temporadas cerradas: los rivales tambien cumplen anios (fase 8). */
  seasonsClosed = 0,
): ReadonlyMap<string, Team> {
  const teams = new Map(rivalTeams(seasonsClosed));
  teams.set(
    USER_CLUB_ID,
    userTeam(userTactics, userChemistry, userExtra, userInjuryPrevention),
  );
  return teams;
}

/** Solo los clubes del torneo, en el orden en que los muestra la interfaz. */
export const LEAGUE_CLUBS = CLUBS.filter((club) => LEAGUE_CLUB_IDS.includes(club.id));

/** Nivel declarado de un club: lo usa la pantalla de rivales. */
export function declaredTarget(clubId: string): number | null {
  if (clubId === USER_CLUB_ID) return null;
  return RIVALS.find((entry) => entry.clubId === clubId)?.target ?? null;
}
