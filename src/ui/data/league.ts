/**
 * LOS PLANTELES DE TODO EL TORNEO (secciones 13, 19, 49).
 *
 * Para que la tabla sea de verdad hacen falta veinte planteles, no uno. El
 * del club del manager esta escrito a mano en `squad.ts`; los otros
 * diecinueve se generan con el mismo generador que usa la calibracion del
 * motor, y despues juegan IA contra IA por el mismo `simulateMatch`.
 *
 * Todo es determinista: el mismo club da siempre el mismo plantel, con los
 * mismos nombres y los mismos atributos. Eso es lo que permite guardar una
 * temporada sin guardar 440 jugadores.
 *
 * LOS NIVELES SON INVENTADOS. No son un ranking de los clubes reales: son
 * numeros elegidos para que el torneo tenga candidatos, mitad de tabla y
 * promedios flojos, que es lo que hace que la competencia se sienta. La
 * interfaz lo marca como dato demo en todas las pantallas.
 */

import { createPlayer, type Player } from '../../domain/player.ts';
import { createTactics, type Tactics } from '../../domain/tactics.ts';
import { createTeam, type Team } from '../../domain/team.ts';
import { buildSquad } from '../../data/squad-builder.ts';
import { CLUBS, clubById } from './clubs.ts';
import { DEMO_SQUAD } from './squad.ts';
import { uniqueNames } from './names.ts';

/** El club que dirige el manager. Su plantel no se genera. */
export const USER_CLUB_ID = 'river';

type Setup = {
  readonly clubId: string;
  /** Overall aproximado del once inicial. */
  readonly target: number;
  readonly chemistry: number;
  readonly tactics: Tactics;
};

function setup(
  clubId: string,
  target: number,
  chemistry: number,
  formationId: string,
  overrides: Partial<Parameters<typeof createTactics>[0]> = {},
): Setup {
  return {
    clubId,
    target,
    chemistry,
    tactics: createTactics({ formationId, ...overrides }),
  };
}

/**
 * Los diecinueve rivales.
 *
 * Las tacticas estan repartidas a proposito entre las nueve formaciones y los
 * distintos estilos: si todos jugaran igual, el sistema de cruces tacticos
 * (seccion 32) no tendria nada que cruzar y el torneo seria una comparacion de
 * overalls.
 */
const RIVALS: readonly Setup[] = [
  setup('boca', 82, 76, '4-3-3', { mentality: 'ofensiva', pressing: 'alta', attackFocus: 'centro' }),
  setup('velez', 81, 78, '4-2-3-1', { passingStyle: 'posesion', tempo: 'lento' }),
  setup('racing', 80, 70, '4-4-2', { mentality: 'ofensiva', attackFocus: 'bandas', width: 'ancho' }),
  setup('independiente', 79, 66, '4-2-3-1', { pressing: 'media' }),
  setup('talleres', 78, 74, '4-1-4-1', { pressing: 'alta', tempo: 'rapido' }),
  setup('sanlorenzo', 77, 68, '4-4-2', { mentality: 'equilibrada' }),
  setup('estudiantes', 77, 72, '4-3-1-2', { passingStyle: 'posesion', attackFocus: 'centro' }),
  setup('lanus', 76, 71, '4-3-3', { passingStyle: 'posesion', tempo: 'lento' }),
  setup('rosario', 75, 64, '4-2-3-1', { mentality: 'equilibrada' }),
  setup('huracan', 74, 69, '5-3-2', { mentality: 'defensiva', counterAttack: true, defensiveLine: 'baja' }),
  setup('newells', 74, 66, '4-4-2', { attackFocus: 'bandas' }),
  setup('argentinos', 73, 73, '4-1-4-1', { passingStyle: 'posesion' }),
  setup('belgrano', 73, 62, '4-4-2', { passingStyle: 'directo', attackFocus: 'bandas' }),
  setup('defensa', 72, 75, '4-3-3', { pressing: 'alta', mentality: 'equilibrada' }),
  setup('gimnasia', 71, 60, '5-3-2', { mentality: 'defensiva', counterAttack: true }),
  setup('tigre', 70, 64, '4-4-2', { passingStyle: 'directo', tempo: 'rapido' }),
  setup('banfield', 70, 67, '4-1-4-1', { mentality: 'defensiva', defensiveLine: 'baja' }),
  setup('platense', 68, 61, '4-5-1', { mentality: 'defensiva', counterAttack: true, defensiveLine: 'baja' }),
  setup('godoycruz', 67, 58, '4-4-2', { mentality: 'defensiva', passingStyle: 'directo' }),
];

export const LEAGUE_SETUP: readonly Setup[] = RIVALS;

/** Los clubes que juegan el torneo, empezando por el del manager. */
export const LEAGUE_CLUB_IDS: readonly string[] = [
  USER_CLUB_ID,
  ...RIVALS.map((entry) => entry.clubId),
];

/** El plantel generado de un rival, con nombres inventados y estables. */
function rivalSquad(entry: Setup): readonly Player[] {
  const raw = buildSquad({
    target: entry.target,
    prefix: entry.clubId,
    seed: `plantel:${entry.clubId}`,
  });
  const names = uniqueNames(raw.length, `nombres:${entry.clubId}`);

  return raw.map((player, index) =>
    createPlayer({
      ...player,
      name: names[index] as string,
      attributes: player.attributes,
      condition: player.condition,
    }),
  );
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
    // La reputacion escala con el nivel del plantel: el motor la usa para la
    // presion del partido, no para decidir el resultado.
    reputation: Math.round((entry.target - 55) * 2.4),
  });
}

/** El equipo del club del manager, armado desde su plantel escrito a mano. */
export function userTeam(tactics?: Tactics, chemistry = 74): Team {
  const club = clubById(USER_CLUB_ID);
  return createTeam({
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    players: DEMO_SQUAD.map((entry) => entry.player),
    chemistry,
    ...(tactics ? { tactics } : {}),
    reputation: 78,
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
export function leagueTeams(userTactics?: Tactics, userChemistry?: number): ReadonlyMap<string, Team> {
  const teams = new Map(rivalTeams());
  teams.set(USER_CLUB_ID, userTeam(userTactics, userChemistry));
  return teams;
}

/** Solo los clubes del torneo, en el orden en que los muestra la interfaz. */
export const LEAGUE_CLUBS = CLUBS.filter((club) => LEAGUE_CLUB_IDS.includes(club.id));

/** Nivel declarado de un club: lo usa la pantalla de rivales. */
export function declaredTarget(clubId: string): number | null {
  if (clubId === USER_CLUB_ID) return null;
  return RIVALS.find((entry) => entry.clubId === clubId)?.target ?? null;
}
