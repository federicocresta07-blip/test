/**
 * Implementacion con datos de demostracion (seccion 19).
 *
 * Es la unica pieza que sabe que los datos son mocks. Se reemplaza por un
 * cliente HTTP sin tocar componentes ni estado.
 */

import { DEFAULT_CONFIG } from '../../config/engine-config.ts';
import { buildAutomaticLineup } from '../../domain/lineup.ts';
import { createTactics } from '../../domain/tactics.ts';
import { createTeam } from '../../domain/team.ts';
import type { GameState, LineupSelection } from '../models/index.ts';
import { CLUBS, clubById } from '../data/clubs.ts';
import { DEMO_SQUAD, withMarketValues } from '../data/squad.ts';
import {
  DEMO_FACILITIES,
  OPENING_CASH,
  DEMO_PROJECTS,
  DEMO_STAFF,
  DEMO_VACANCIES,
} from '../data/club-development.ts';
import {
  facilityUpgradeCost,
  facilityUpkeep,
  type FacilityId,
  type FacilityLevel,
  MAX_FACILITY_LEVEL,
} from '../../domain/facilities.ts';
import {
  MAX_STAFF_LEVEL,
  staffHireCost,
  staffSalary,
  staffUpgradeCost,
  type StaffLevel,
  type StaffRole,
} from '../../domain/staff.ts';
import {
  investmentTotals,
  readDevelopment,
  writeDevelopment,
  type DevelopmentState,
  type InvestmentRecord,
} from './development-store.ts';
import type {
  ClubFacility,
  ClubPlayer,
  DevelopmentProject,
  Finances,
  InboxMessage,
  StadiumView,
  StaffMember,
  StaffVacancy,
} from '../models/index.ts';
import {
  financesOf,
  gateFor,
  originalCapacity,
  reputationOf,
  stadiumOf,
  type MatchRevenue,
} from '../lib/stadium-bridge.ts';
import {
  EXPANSION_STEPS,
  MAX_TICKET_PRICE,
  MIN_TICKET_PRICE,
  REFERENCE_TICKET_PRICE,
  expansionCost,
  expansionWeeks,
} from '../../domain/stadium.ts';
import { closeSeason as closeSeasonOf } from '../../progression/season-close.ts';
import { storage } from './storage.ts';
import { ATTRIBUTE_KEYS } from '../../domain/attributes.ts';
import { developPlayer } from '../../progression/development.ts';
import { SEASON_LABEL } from '../data/competition.ts';
import { offersFromMarket } from '../data/market.ts';
import { DEMO_INBOX } from '../data/inbox.ts';
import { staffMessages } from '../lib/staff-messages.ts';
import { totalRounds } from '../../competition/fixtures.ts';
import {
  playRound as playSeasonRound,
  type RoundTraining,
} from '../../competition/season.ts';
import { accumulateRound } from '../../competition/stats.ts';
import {
  injuryPreventionOf,
  progressionEffects,
  staffEffect,
  staffSpec,
  type StaffAssignment,
} from '../../domain/staff.ts';
import { LEAGUE_CLUB_IDS, leagueTeams } from '../data/league.ts';
import { buildYouthSquad } from '../data/youth.ts';
import { autoTransferList, negotiate, squadNeed, valuePlayer } from '../../domain/market.ts';
import {
  applyTransfers,
  findLeaguePlayer,
  marketPrecision,
  RIVAL_CONTRACT_MONTHS,
} from '../lib/market-bridge.ts';
import { canPromote, mustLeave, scoutPotential, type YouthPlayer } from '../../domain/youth.ts';
import { focusFor, DEFAULT_TRAINING_PLAN, type TrainingPlan } from '../../domain/training.ts';
import { overallForPosition } from '../../ratings/overall.ts';
import { clamp } from '../../core/math.ts';
import type { Player } from '../../domain/player.ts';
import type { Team } from '../../domain/team.ts';
import type { Position } from '../../domain/positions.ts';
import type { ScoutedYouth } from '../models/index.ts';
import {
  fixtureDate,
  outcomeOf,
  recordsOfClub,
  restDaysBefore,
  seasonFixtures,
  seasonTable,
  tableMood,
  toUiFixtures,
  toUiTable,
} from '../lib/season-bridge.ts';
import {
  emptySeason,
  readSeason,
  restoreTeams,
  snapshotAttributes,
  snapshotChemistry,
  snapshotConditions,
  withAttributes,
  withCondition,
  writeSeason,
  type GateRecord,
  type SeasonSave,
  type StoredOffer,
} from './season-store.ts';
import type { GameService, OfferOutcome, PlayRoundReport, SeasonCloseReport } from './types.ts';

/**
 * Aviso visible en la interfaz, y ahora dice otra cosa.
 *
 * Decia "los jugadores y los numeros son inventados", que era cierto mientras
 * el plantel se generaba. Desde que sale de EQ003003.PKF ya no lo es, y dejar
 * el cartel viejo seria mentir en la direccion contraria: declarar inventado
 * un dato que es real.
 *
 * Lo que el cartel tiene que seguir marcando es la frontera: que sale del
 * archivo del juego y que es nuestro.
 */
export const DATA_SOURCE_NOTICE =
  'Jugadores, dorsales, atributos y tácticas extraídos de EQ003003.PKF (PC Apertura 6.0, 1998). ' +
  'El valor, el salario, la forma y la moral los calcula este juego: el formato original no los guarda.';

/** Nombre corto de la fuente, para el cartel de la barra superior. */
export const DATA_SOURCE_LABEL = 'PC Apertura 98';

/** @deprecated Se mantiene el nombre viejo para no romper importaciones. */
export const DEMO_DATA_NOTICE = DATA_SOURCE_NOTICE;

const CLUB_ID = 'river';

/** Cohesion con la que arranca el plantel antes de jugar nada. */
export const INITIAL_CHEMISTRY = 74;

/**
 * Margen del informe cuando no hay ojeador juvenil.
 *
 * Peor que el de un ojeador de una estrella a proposito: sin nadie mirando, el
 * club estima el techo de un pibe de oido.
 */
const NO_SCOUT_SPREAD = 22;
const LINEUP_STORAGE_KEY = 'manager:lineup:v1';

const DEFAULT_TACTICS_DEMO = createTactics({
  formationId: '4-3-3',
  mentality: 'ofensiva',
  pressing: 'alta',
  defensiveLine: 'media',
  tempo: 'rapido',
  passingStyle: 'posesion',
  attackFocus: 'bandas',
  width: 'ancho',
  aggression: 'media',
});

/**
 * Once inicial: el que propone el motor.
 * Es determinista, asi que el club siempre arranca con la misma alineacion.
 */
function initialLineup(): LineupSelection {
  const team = createTeam({
    id: CLUB_ID,
    name: clubById(CLUB_ID).name,
    players: DEMO_SQUAD.map((entry) => entry.player),
    chemistry: 74,
    tactics: DEFAULT_TACTICS_DEMO,
  });
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, {
    isHome: true,
    importance: 0.4,
    chemistry: 74,
  });

  const starters = lineup.starters.map((entry) => entry.player.id);
  const captain =
    starters.find((id) => id === 'riv-5') ?? starters.find((id) => id === 'riv-2') ?? starters[0] ?? null;

  return {
    formationId: DEFAULT_TACTICS_DEMO.formationId,
    starters,
    bench: lineup.bench.slice(0, 7).map((player) => player.id),
    tactics: DEFAULT_TACTICS_DEMO,
    roles: {
      captainId: captain,
      penaltiesId: 'riv-9',
      freeKicksId: 'riv-10',
      leftCornerId: 'riv-10',
      rightCornerId: 'riv-7',
    },
  };
}

function readStoredLineup(): LineupSelection | null {
  try {
    const raw = storage().getItem(LINEUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LineupSelection;
    // Validacion minima: si el formato cambio, se descarta y se arranca limpio.
    if (!parsed.formationId || !Array.isArray(parsed.starters)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const readMessages = new Set<string>();

/**
 * Compone el cuerpo tecnico actual: el plantel base, con los niveles
 * alcanzados por mejora y los puestos cubiertos por contratacion.
 */
function composeStaff(development: DevelopmentState): readonly StaffMember[] {
  const promoted = DEMO_STAFF.map((member) => {
    const level = development.staffLevels[member.id];
    return level !== undefined ? { ...member, level } : member;
  });

  const hired: StaffMember[] = Object.entries(development.hires).map(([role, hire]) => ({
    id: `hire-${hire.candidateId}`,
    name: hire.name,
    role: role as StaffRole,
    level: development.staffLevels[`hire-${hire.candidateId}`] ?? hire.level,
    yearsAtClub: 0,
  }));

  return [...promoted, ...hired];
}

/** Los puestos que siguen vacantes despues de las contrataciones. */
function composeVacancies(development: DevelopmentState): readonly StaffVacancy[] {
  return DEMO_VACANCIES.filter((vacancy) => development.hires[vacancy.role] === undefined);
}

function composeFacilities(development: DevelopmentState): readonly ClubFacility[] {
  return DEMO_FACILITIES.map((facility) => {
    const level = development.facilityLevels[facility.id];
    return level !== undefined ? { ...facility, level } : facility;
  });
}

/**
 * La caja disponible, sin recomponer el plantel.
 *
 * Las acciones de inversion solo necesitan saber si alcanza la plata, y
 * recomponer el plantel para eso seria trabajo de mas.
 *
 * Suma la recaudacion de los partidos ya jugados: la plata que entro por la
 * puerta se puede gastar, que es el punto entero de la fase 6.
 */
function availableCash(development: DevelopmentState, save: SeasonSave): number {
  const totals = investmentTotals(development);
  const gates = (save.gates ?? []).reduce((total, gate) => total + gate.total, 0);
  return Math.max(0, OPENING_CASH + gates - totals.spent);
}

/**
 * Las finanzas del club.
 *
 * NADA declarado. La masa salarial es la suma de los contratos del plantel y
 * del cuerpo tecnico; el mantenimiento sale del nivel de cada instalacion; la
 * recaudacion, de los partidos que se jugaron de local; la television y el
 * sponsor, de la reputacion, que sale de los socios y el aforo del archivo.
 *
 * Lo unico escrito a mano que entra es `OPENING_CASH`, que es el punto de
 * partida de la partida.
 */
function composeFinances(
  development: DevelopmentState,
  squad: readonly ClubPlayer[],
  save: SeasonSave,
): Finances {
  const totals = investmentTotals(development);
  const table = seasonTable(save.records);
  const position = table.findIndex((row) => row.clubId === CLUB_ID) + 1;
  const rounds = totalRounds(seasonFixtures(save.seed));

  return financesOf({
    clubId: CLUB_ID,
    builtSeats: development.stadiumSeats ?? 0,
    squad,
    staff: composeStaff(development),
    facilities: composeFacilities(development),
    position: position > 0 ? position : Math.ceil(LEAGUE_CLUB_IDS.length / 2),
    clubsInLeague: LEAGUE_CLUB_IDS.length,
    gates: save.gates ?? [],
    openingCash: OPENING_CASH,
    // Las ventas entran con coste negativo, asi que se separan por signo.
    capitalSpent: Math.max(0, totals.spent),
    capitalReceived: Math.max(0, -totals.spent),
    homeMatchesLeft: homeMatchesLeft(save, rounds),
  });
}

/**
 * Cuantos partidos de local quedan por jugar.
 *
 * Lo usa el presupuesto de fichajes: cuanto mas temporada queda, mas superavit
 * proyectado se puede comprometer. En la ultima fecha no hay nada que
 * proyectar.
 */
function homeMatchesLeft(save: SeasonSave, rounds: number): number {
  const fixtures = seasonFixtures(save.seed);
  let left = 0;
  for (const fixture of fixtures) {
    if (fixture.round < save.round || fixture.round > rounds) continue;
    if (fixture.homeClubId === CLUB_ID) left += 1;
  }
  return left;
}

/** El estadio del club para la pantalla: dato real mas lo que se amplio. */
function composeStadium(development: DevelopmentState, save: SeasonSave): StadiumView {
  const builtSeats = development.stadiumSeats ?? 0;
  const stadium = stadiumOf(CLUB_ID, builtSeats);
  return {
    name: stadium.name,
    capacity: stadium.capacity,
    originalCapacity: originalCapacity(CLUB_ID),
    builtSeats,
    members: stadium.members,
    ticketPrice: development.ticketPrice ?? REFERENCE_TICKET_PRICE,
    reputation: reputationOf(CLUB_ID, builtSeats),
    gates: [...(save.gates ?? [])]
      .sort((a, b) => b.round - a.round)
      .map((gate) => ({
        round: gate.round,
        opponentName: clubById(gate.opponentId).shortName,
        attendance: gate.attendance,
        occupancy: stadium.capacity > 0 ? gate.attendance / stadium.capacity : 0,
        ticketPrice: gate.ticketPrice,
        total: gate.total,
      })),
  };
}

/**
 * Las obras en curso.
 *
 * Derivadas del estado, no escritas a mano: si hay una ampliacion del estadio
 * andando, aparece con sus semanas reales; si no, la lista esta vacia y la
 * pantalla lo dice.
 */
function composeProjects(development: DevelopmentState): readonly DevelopmentProject[] {
  const work = development.expansion;
  if (!work) return DEMO_PROJECTS;
  return [
    {
      id: 'obra-estadio',
      kind: 'estadio',
      label: `Ampliación de ${work.seats.toLocaleString('es-AR')} asientos`,
      targetId: null,
      fromLevel: null,
      toLevel: null,
      weeksTotal: work.weeksTotal,
      weeksLeft: work.weeksLeft,
      cost: work.cost,
    },
  ];
}

/**
 * LA RECAUDACION DE LA FECHA QUE SE ESTA JUGANDO (fase 6).
 *
 * Devuelve `null` si el club juega de visitante: la recaudacion es del local.
 *
 * Las condiciones que la mueven son todas estado del juego en ESTE momento —el
 * rival, la posicion, la racha, el precio— y por eso el resultado se guarda
 * como historia y no se recalcula.
 */
function gateOfRound(
  development: DevelopmentState,
  save: SeasonSave,
  fixtures: readonly { readonly round: number; readonly homeClubId: string; readonly awayClubId: string }[],
  position: number,
  rounds: number,
): { readonly record: GateRecord; readonly revenue: MatchRevenue } | null {
  const fixture = fixtures.find(
    (entry) => entry.round === save.round && entry.homeClubId === CLUB_ID,
  );
  if (!fixture) return null;

  const table = seasonTable(save.records);
  const row = table.find((entry) => entry.clubId === CLUB_ID);
  const form = recordsOfClub(save.records, CLUB_ID)
    .slice(-5)
    .reverse()
    .map((record) => outcomeOf(record, CLUB_ID));

  const ticketPrice = development.ticketPrice ?? REFERENCE_TICKET_PRICE;
  const revenue = gateFor({
    clubId: CLUB_ID,
    builtSeats: development.stadiumSeats ?? 0,
    ticketPrice,
    opponentId: fixture.awayClubId,
    position: position > 0 ? position : Math.ceil(LEAGUE_CLUB_IDS.length / 2),
    clubsInLeague: LEAGUE_CLUB_IDS.length,
    form,
    // La importancia crece sobre el final del torneo: la ultima fecha de un
    // equipo que pelea arriba mueve gente que no va nunca.
    importance: matchImportance(save.round, rounds, position, row?.points ?? 0, table),
  });

  return {
    revenue,
    record: {
      round: save.round,
      opponentId: fixture.awayClubId,
      attendance: revenue.attendance,
      ticketPrice,
      total: revenue.total,
    },
  };
}

/**
 * Cuanto importa este partido, 0..1.
 *
 * Sube con la fecha —el final del torneo pesa mas que el arranque— y sube si
 * el club esta a tiro de algo: pelear el campeonato o zafar de abajo. Un
 * equipo en mitad de tabla en la fecha 5 juega el partido mas intrascendente
 * posible, y eso tambien es realista.
 */
function matchImportance(
  round: number,
  rounds: number,
  position: number,
  points: number,
  table: readonly { readonly clubId: string; readonly points: number }[],
): number {
  const progress = rounds > 1 ? (round - 1) / (rounds - 1) : 0;
  const leaderPoints = table[0]?.points ?? points;
  const inTheRace = leaderPoints - points <= 6 ? 1 : 0;
  const inTrouble = position >= LEAGUE_CLUB_IDS.length - 3 ? 1 : 0;
  const stake = Math.max(inTheRace, inTrouble);
  return Math.min(1, 0.3 + progress * 0.4 + stake * progress * 0.3);
}

/**
 * La obra del estadio avanza una semana por fecha jugada.
 *
 * Cuando llega a cero los asientos pasan a la capacidad y la obra desaparece.
 * Es el unico lugar del juego donde una inversion tarda en dar resultado, y
 * por eso importa que las semanas bajen solas al jugar y no al entrar a la
 * pantalla.
 */
function advanceStadiumWork(development: DevelopmentState): {
  readonly state: DevelopmentState;
  readonly changed: boolean;
  readonly finished: { readonly seats: number; readonly capacity: number } | null;
} {
  const work = development.expansion;
  if (!work) return { state: development, changed: false, finished: null };

  const weeksLeft = work.weeksLeft - 1;
  if (weeksLeft > 0) {
    return {
      state: { ...development, expansion: { ...work, weeksLeft } },
      changed: true,
      finished: null,
    };
  }

  const seats = (development.stadiumSeats ?? 0) + work.seats;
  const { expansion: _done, ...rest } = development;
  return {
    state: { ...rest, stadiumSeats: seats },
    changed: true,
    finished: { seats: work.seats, capacity: stadiumOf(CLUB_ID, seats).capacity },
  };
}


function record(
  development: DevelopmentState,
  investment: InvestmentRecord,
  patch: Partial<DevelopmentState>,
): DevelopmentState {
  return {
    ...development,
    ...patch,
    investments: [...development.investments, investment],
  };
}

/**
 * La bandeja: los mensajes fijos mas los que se derivan del estado del club.
 *
 * Los derivados se recalculan en cada carga, asi que despues de mejorar una
 * instalacion el mensaje del profesional que estaba limitado ya no aparece.
 */
function composeInbox(development: DevelopmentState, today: string): readonly InboxMessage[] {
  const derived = staffMessages(
    composeStaff(development),
    composeVacancies(development),
    composeFacilities(development),
    today,
  );
  return [...DEMO_INBOX, ...derived]
    .map((message) => (readMessages.has(message.id) ? { ...message, unread: false } : message))
    .sort((a, b) => b.date.localeCompare(a.date));
}


/**
 * El cuerpo tecnico en la forma que consume la progresion del plantel.
 *
 * Es lo que hace que el staff de la fase 3 se aplique de verdad cuando se
 * juega una fecha: el preparador fisico acelera la recuperacion, el medico
 * acorta las lesiones y el psicologo levanta la moral.
 */
/**
 * El cuerpo tecnico del club con la instalacion que lo respalda.
 *
 * Es la forma en que el dominio lo pide: cada efecto sale del nivel del
 * profesional ACOTADO por su instalacion, asi que un entrenador de cinco
 * estrellas en instalaciones de dos no rinde cinco.
 */
function staffAssignments(development: DevelopmentState): readonly StaffAssignment[] {
  const facilities = composeFacilities(development);
  const levelOf = (facilityId: FacilityId): FacilityLevel =>
    facilities.find((facility) => facility.id === facilityId)?.level ?? 1;

  return composeStaff(development).map((member) => ({
    role: member.role,
    level: member.level,
    facilityLevel: levelOf(staffSpec(member.role).facility),
  }));
}

function progressionStaff(development: DevelopmentState): ReturnType<typeof progressionEffects> {
  return progressionEffects(staffAssignments(development));
}


/** El nivel de la instalacion que respalda a un rol del staff. */
function facilityLevelFor(development: DevelopmentState, role: StaffRole): FacilityLevel {
  const facility = staffSpec(role).facility;
  return composeFacilities(development).find((entry) => entry.id === facility)?.level ?? 1;
}

/** El efecto de un rol del cuerpo tecnico, o `null` si el puesto esta vacante. */
function effectOfRole(development: DevelopmentState, role: StaffRole) {
  const member = composeStaff(development).find((entry) => entry.role === role);
  if (!member) return null;
  return staffEffect(role, member.level, facilityLevelFor(development, role));
}

/**
 * Los juveniles del club, con el informe del ojeador.
 *
 * El ancho del rango sale del efecto del ojeador juvenil: sin ojeador el club
 * mira a ciegas y el rango es enorme. La camada la decide el nivel de la
 * academia (seccion 8).
 */
/**
 * LAS INFERIORES, CAMADA POR CAMADA (fase 6).
 *
 * Antes era una sola camada fija: `buildYouthSquad(club, nivelAcademia)` con
 * semilla constante. Con el cierre de temporada eso ya no alcanza, porque los
 * juveniles tienen que cumplir anios y tiene que entrar gente nueva.
 *
 * Se generan TODAS las camadas desde el arranque de la partida, cada una con
 * su semilla, y a cada una se le suman los anios que pasaron desde que entro.
 * Al que se le paso la edad se le termino el tiempo en el club y desaparece de
 * la lista. Nada de esto se guarda: se deriva de cuantas temporadas se
 * cerraron, que es un solo numero.
 */
function composeYouth(development: DevelopmentState, save: SeasonSave): readonly ScoutedYouth[] {
  const academy = composeFacilities(development).find((entry) => entry.id === 'academia');
  const scout = effectOfRole(development, 'Ojeador juvenil');
  // Sin ojeador juvenil el margen es el del nivel 1 empeorado: el club no
  // tiene a nadie mirando y lo declara en pantalla.
  const spread = scout ? scout.actual : NO_SCOUT_SPREAD;
  const promoted = new Set(save.promoted ?? []);
  const seasonsClosed = save.seasonsClosed ?? 0;

  // EL ENTRENADOR JUVENIL: su efecto se aplica ACA.
  //
  // `staff.ts` declara su consumidor como "desarrollo de los atributos de sus
  // jugadores, fecha a fecha", y hasta la fase 6 eso era falso: la camada se
  // regeneraba identica en cada carga, asi que ningun juvenil mejoraba nunca y
  // el rol no movia nada. El cierre de temporada lo dejo a la vista, porque
  // ahora un pibe se queda hasta cinco anios en inferiores.
  const youthCoach = effectOfRole(development, 'Entrenador juvenil');

  const cohorts: YouthPlayer[] = [];
  for (let season = 0; season <= seasonsClosed; season += 1) {
    const years = seasonsClosed - season;
    for (const entry of buildYouthSquad(
      CLUB_ID,
      academy?.level ?? 1,
      `camada-${season}`,
      years,
    )) {
      cohorts.push(years > 0 ? developedYouth(entry, years, youthCoach?.actual ?? 0) : entry);
    }
  }

  return cohorts
    .filter((entry) => !promoted.has(entry.player.id) && !mustLeave(entry))
    .map((entry) => ({
      id: entry.player.id,
      name: entry.player.name,
      position: entry.player.position,
      age: entry.player.age,
      origin: entry.origin,
      yearsAtClub: entry.yearsAtClub,
      overall: Math.round(overallForPosition(entry.player.attributes, entry.player.position)),
      report: scoutPotential(entry.player.potential, spread, entry.player.id),
      promotable: canPromote(entry),
      player: entry.player,
    }));
}

/** Semanas de trabajo que tiene una temporada de 19 fechas. */
const WEEKS_PER_SEASON = 22;

/**
 * Un juvenil que lleva anios en el club, ya desarrollado.
 *
 * Se desarrolla con el MISMO `developPlayer` que el plantel profesional: tener
 * dos formas de hacer crecer a un jugador seria tener dos fuentes de verdad, y
 * la del motor es la que manda. La diferencia es el contexto: juega en
 * inferiores, no en primera, y lo entrena el entrenador juvenil.
 *
 * El resultado es derivado: no se guarda el estado de cada pibe, se recalcula
 * de cuantas temporadas lleva. Asi un ajuste en los numeros del desarrollo se
 * refleja en una partida ya empezada.
 */
function developedYouth(entry: YouthPlayer, years: number, coaching: number): YouthPlayer {
  let player = entry.player;
  // TEMPORADA POR TEMPORADA, no de una. `developPlayer` mide el margen contra
  // el potencial UNA VEZ por llamada, asi que pedirle cuatro temporadas de
  // golpe crece como si el margen del primer dia durara los cuatro anios: un
  // juvenil de potencial 66 llegaba a 74. Aplicado anio por anio, el margen se
  // recalcula y el techo se respeta.
  for (let year = 0; year < years; year += 1) {
    player = developPlayer({
      player,
      weeks: WEEKS_PER_SEASON,
      // Los minutos de inferiores: juega, pero no en primera.
      minutes: 1_100,
      focus: 'general',
      intensity: 0.65,
      coaching,
      seed: `inferiores:${entry.player.id}:${year}`,
    }).player;
  }
  return { ...entry, player };
}

/** Los juveniles que el manager ya subio al plantel profesional. */
function promotedPlayers(development: DevelopmentState, save: SeasonSave): readonly Player[] {
  const academy = composeFacilities(development).find((entry) => entry.id === 'academia');
  const promoted = new Set(save.promoted ?? []);
  return buildYouthSquad(CLUB_ID, academy?.level ?? 1)
    .filter((entry) => promoted.has(entry.player.id))
    .map((entry) => withCondition(entry.player, save.conditions[entry.player.id]));
}

/**
 * Lo que el club le pone al entrenamiento de la fecha (fase 4).
 *
 * `coachingOf` devuelve el efecto real del entrenador de cada linea, ya con el
 * limite de las instalaciones descontado. Si el puesto esta vacante devuelve
 * cero: el plantel desarrolla al ritmo base.
 */
function roundTraining(development: DevelopmentState, plan: TrainingPlan): RoundTraining {
  const cache = new Map<StaffRole, number>();
  return {
    intensity: plan.intensity,
    focusOf: (playerId, position) => focusFor(plan, playerId, position as Position),
    coachingOf: (role) => {
      const cached = cache.get(role);
      if (cached !== undefined) return cached;
      const effect = effectOfRole(development, role);
      const value = effect ? effect.actual : 0;
      cache.set(role, value);
      return value;
    },
  };
}


// ============================================================
// Mercado (fase 5)
// ============================================================

/** Plata en formato corto, para los mensajes del mercado. */
function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')} M`;
  return `$${Math.round(value / 1_000)} k`;
}

/**
 * Anota un fichaje en la caja del club.
 *
 * Sale de la MISMA caja que las mejoras de staff y las obras: hay una sola
 * caja y comprar un jugador compite con mejorar el centro medico. Eso es lo
 * que hace que el presupuesto sea una decision.
 */
function recordTransferSpend(amount: number, label: string): void {
  const development = readDevelopment();
  writeDevelopment({
    ...development,
    investments: [
      ...development.investments,
      { id: `fichaje-${Date.now()}`, kind: 'fichaje', label, cost: amount, recurring: 0 },
    ],
  });
}

/** Anota una venta: entra a la misma caja, con coste negativo. */
function recordTransferIncome(amount: number, label: string): void {
  const development = readDevelopment();
  writeDevelopment({
    ...development,
    investments: [
      ...development.investments,
      { id: `venta-${Date.now()}`, kind: 'venta', label, cost: -amount, recurring: 0 },
    ],
  });
}

/**
 * Quienes estan en el mercado, por id.
 *
 * De los clubes de IA se calcula con `autoTransferList`, asi que la lista se
 * mantiene coherente con su plantel sin que nadie la escriba: vender un
 * suplente cambia a quien publica el club. Del club del manager sale de lo que
 * el manager marco.
 */
function listedIds(save: SeasonSave): readonly string[] {
  const teams = applyTransfers(
    leagueTeams(undefined, undefined, [], 0, save.seasonsClosed ?? 0),
    save.transfers ?? [],
  );
  const ids: string[] = [...(save.listed ?? [])];
  for (const [clubId, team] of teams) {
    if (clubId === CLUB_ID) continue;
    for (const player of autoTransferList(team.players)) ids.push(player.id);
  }
  return ids;
}

/** El mercado como lo ve la interfaz. */
function composeMarket(development: DevelopmentState, save: SeasonSave): GameState['market'] {
  const precision = marketPrecision(
    composeStaff(development),
    composeFacilities(development),
  );
  return {
    offers: save.offers ?? [],
    transfers: save.transfers ?? [],
    listed: save.listed ?? [],
    listedElsewhere: listedIds(save).filter((id) => !(save.listed ?? []).includes(id)),
    scoutMargin: precision.scoutMargin,
    valuerError: precision.valuerError,
    hasScout: precision.hasScout,
    hasValuer: precision.hasValuer,
  };
}

/** Los jugadores que el club del manager compro. */
function signedPlayers(save: SeasonSave): readonly Player[] {
  const incoming = (save.transfers ?? []).filter((entry) => entry.toClubId === CLUB_ID);
  if (incoming.length === 0) return [];

  return incoming
    .map((entry) => findLeaguePlayer(entry.playerId, save.seasonsClosed ?? 0))
    .filter((found): found is { player: Player; clubId: string } => found !== null)
    .map((found) => withCondition(found.player, save.conditions[found.player.id]));
}

/**
 * Las ofertas que los clubes de IA hacen por los jugadores del manager.
 *
 * Se generan al jugar una fecha, por calculo: un club ofrece por un jugador
 * ajeno cuando le conviene —le falta en ese puesto y el jugador es mejor que
 * lo que tiene— y ofrece un porcentaje del valor de mercado segun cuanto lo
 * necesite. Nada de sortear "aparece una oferta".
 */
function generateIncomingOffers(
  save: SeasonSave,
  squad: readonly ClubPlayer[],
  round: number,
): readonly StoredOffer[] {
  const teams = applyTransfers(
    leagueTeams(undefined, undefined, [], 0, save.seasonsClosed ?? 0),
    save.transfers ?? [],
  );
  const alreadyOffered = new Set(
    (save.offers ?? [])
      .filter((entry) => entry.toClubId === CLUB_ID && entry.status === 'enviada')
      .map((entry) => entry.playerId),
  );
  const sold = soldIds(save);
  const listed = new Set(save.listed ?? []);
  /** El mejor jugador del manager que le mejora un puesto a este club. */
  const bestTargetFor = (
    team: Team,
    excluded: ReadonlySet<string>,
  ): { target: ClubPlayer; gain: number } | null => {
    let best: { target: ClubPlayer; gain: number } | null = null;
    for (const entry of squad) {
      if (sold.has(entry.player.id) || alreadyOffered.has(entry.player.id)) continue;
      if (excluded.has(entry.player.id)) continue;
      const ownBest = Math.max(
        0,
        ...team.players
          .filter((other) => other.position === entry.player.position)
          .map((other) => overallForPosition(other.attributes, other.position)),
      );
      const gain =
        overallForPosition(entry.player.attributes, entry.player.position) - ownBest;
      // Menos de tres puntos de mejora no mueve a nadie a hacer una oferta.
      if (gain >= 3 && (!best || gain > best.gain)) best = { target: entry, gain };
    }
    return best;
  };

  // Los clubes ofrecen por orden de billetera, y cada uno elige entre los que
  // quedan libres.
  //
  // Las dos reglas importan. Sin el tope, los diecinueve clubes ofrecian por
  // el MISMO jugador en la misma fecha y por el mismo monto, porque todos
  // evaluan igual. Y sin dejar que cada club busque su segunda opcion, el
  // primero se llevaba el objetivo y los demas no ofrecian nada.
  const contenders = [...teams]
    .filter(([clubId]) => clubId !== CLUB_ID)
    .sort(([, a], [, b]) => b.reputation - a.reputation);

  const offers: StoredOffer[] = [];
  const taken = new Set<string>();

  for (const [clubId, team] of contenders) {
    if (offers.length >= MAX_INCOMING_PER_ROUND) break;
    const wish = bestTargetFor(team, taken);
    if (!wish) continue;
    taken.add(wish.target.player.id);

    // Ofrece por debajo del valor si no lo necesita tanto, y mas si el jugador
    // esta en la lista de transferibles del manager: sabe que se vende. Y un
    // club grande estira mas la oferta que uno chico.
    const value = valuePlayer({
      player: wish.target.player,
      contractMonths: RIVAL_CONTRACT_MONTHS,
    }).value;
    const eagerness = clamp(wish.gain / 12, 0.2, 1);
    const wealth = clamp((team.reputation - 30) / 60, 0, 1);
    const base = listed.has(wish.target.player.id) ? 0.85 : 0.7;
    const factor = base + eagerness * 0.3 + wealth * 0.2;
    const amount = Math.round((value * factor) / 10_000) * 10_000;

    offers.push({
      id: `in-${round}-${clubId}-${wish.target.player.id}`,
      playerId: wish.target.player.id,
      playerName: wish.target.player.name,
      fromClubId: clubId,
      toClubId: CLUB_ID,
      amount,
      status: 'enviada',
      round,
      counter: null,
      reason:
        wish.gain >= 8
          ? `${clubById(clubId).name} lo ve como un salto de calidad para su puesto.`
          : `${clubById(clubId).name} quiere mejorar ese puesto y lo tiene en carpeta.`,
    });
  }

  return offers;
}

/**
 * Cuantas ofertas recibe el manager por fecha.
 *
 * Dos o tres. Diecinueve ofertas simultaneas —una por club— no es un mercado,
 * es ruido.
 */
const MAX_INCOMING_PER_ROUND = 3;

/** Los jugadores propios que se vendieron, por id. */
function soldIds(save: SeasonSave): ReadonlySet<string> {
  return new Set(
    (save.transfers ?? [])
      .filter((entry) => entry.fromClubId === CLUB_ID)
      .map((entry) => entry.playerId),
  );
}

/**
 * El dia de hoy.
 *
 * No es un dato guardado: es el dia de la fecha que se viene. Asi el
 * calendario, la bandeja y el encabezado avanzan solos al jugar, en lugar de
 * quedarse clavados en una fecha escrita a mano.
 */
function todayOf(save: SeasonSave, rounds: number): string {
  return fixtureDate(Math.min(save.round, Math.max(1, rounds)), 0).date;
}

/**
 * El plantel del manager con el estado de la temporada aplicado.
 *
 * Sin esto, jugar una fecha no se veria en ningun lado: el plantel seguiria
 * mostrando la forma, la moral y la fatiga con las que arranco. Los atributos
 * y los datos de gestion (dorsal, contrato, valor) salen de `squad.ts`; lo que
 * cambia partido a partido sale de la temporada guardada.
 *
 * Las amarillas tambien: se cuentan del torneo, no se declaran. Por eso en la
 * fecha 1 todos tienen cero, que es la verdad, y el aviso de riesgo de
 * suspension aparece cuando de verdad hay riesgo.
 */
function composeSquad(
  development: DevelopmentState,
  save: SeasonSave,
  today: string,
): readonly ClubPlayer[] {
  const base = DEMO_SQUAD.map((entry) => ({
    ...entry,
    // El orden importa: primero los atributos desarrollados, despues el
    // estado. Los dos vienen del guardado y ninguno se puede recalcular.
    player: withCondition(
      withAttributes(entry.player, save.attributes?.[entry.player.id]),
      save.conditions[entry.player.id],
    ),
    yellowCards: save.totals[entry.player.id]?.yellowCards ?? 0,
  }));

  // Los juveniles promovidos entran al plantel como cualquier otro. No tienen
  // contrato profesional ni valor de mercado todavia: eso es la fase 5, y
  // mientras tanto figuran con lo minimo en lugar de con numeros inventados.
  const promoted: ClubPlayer[] = promotedPlayers(development, save).map((player) => ({
    player,
    shirtNumber: 0,
    nationality: 'Argentina',
    value: 0,
    salary: 0,
    contractUntil: '2029-06-30',
    yellowCards: save.totals[player.id]?.yellowCards ?? 0,
    unhappy: false,
  }));

  // Los fichajes del mercado (fase 5). Entran con el contrato tipico de un
  // pase: tres anios. El dorsal lo asigna el club, no el jugador.
  const signed: ClubPlayer[] = signedPlayers(save).map((player) => ({
    player,
    shirtNumber: 0,
    nationality: 'Argentina',
    value: 0,
    salary: 0,
    contractUntil: '2029-06-30',
    yellowCards: save.totals[player.id]?.yellowCards ?? 0,
    unhappy: false,
  }));

  // Y los que se vendieron ya no estan. Tampoco los que se retiraron al
  // cerrar la temporada (fase 6): el plantel se regenera del archivo en cada
  // carga, asi que sin esta lista el que colgo los botines volveria.
  const sold = soldIds(save);
  const retired = new Set(save.retired ?? []);
  const seasonsClosed = save.seasonsClosed ?? 0;

  // Y todos tienen un anio mas por cada temporada cerrada. La edad del archivo
  // es la de 1998; el resto es tiempo de juego.
  const aged = [...base, ...promoted, ...signed].map((entry) =>
    seasonsClosed > 0
      ? { ...entry, player: { ...entry.player, age: entry.player.age + seasonsClosed } }
      : entry,
  );

  // El valor y el salario los pone el mercado: se calculan al final, cuando el
  // plantel ya tiene su estado, sus juveniles promovidos y sus fichajes.
  return withMarketValues(
    aged.filter((entry) => !sold.has(entry.player.id) && !retired.has(entry.player.id)),
    today,
  );
}

/** La temporada como la ve la interfaz. */
function composeSeason(save: SeasonSave): GameState['season'] {
  const fixtures = seasonFixtures(save.seed);
  const rounds = totalRounds(fixtures);
  const own = recordsOfClub(save.records, CLUB_ID);

  return {
    seed: save.seed,
    round: save.round,
    totalRounds: rounds,
    finished: save.round > rounds,
    records: save.records,
    totals: save.totals,
    lastUserMatch: own[0] ?? null,
    seasonsClosed: save.seasonsClosed ?? 0,
    chemistry: save.chemistry[CLUB_ID] ?? INITIAL_CHEMISTRY,
  };
}

export function createMockGameService(): GameService {
  return {
    async loadGame(): Promise<GameState> {
      const club = clubById(CLUB_ID);
      const development = readDevelopment();
      const save = readSeason();
      const fixtures = seasonFixtures(save.seed);
      const table = seasonTable(save.records);
      const today = todayOf(save, totalRounds(fixtures));
      const squad = composeSquad(development, save, today);
      return {
        manager: {
          id: 'mgr-1',
          name: 'Director Técnico',
          clubId: CLUB_ID,
          since: '2025-01-15',
        },
        club,
        clubs: CLUBS,
        squad,
        lineup: readStoredLineup() ?? initialLineup(),
        finances: composeFinances(development, squad, save),
        stadium: composeStadium(development, save),
        staff: composeStaff(development),
        vacancies: composeVacancies(development),
        facilities: composeFacilities(development),
        projects: composeProjects(development),
        fixtures: toUiFixtures(fixtures, save.records),
        table: toUiTable(table),
        // Se derivan de las ofertas reales del mercado, no de una lista
        // escrita a mano: una sola fuente de verdad.
        offersReceived: offersFromMarket(save.offers ?? [], CLUB_ID).received,
        offersSent: offersFromMarket(save.offers ?? [], CLUB_ID).sent,
        inbox: composeInbox(development, today),
        season: composeSeason(save),
        youth: composeYouth(development, save),
        training: save.training ?? DEFAULT_TRAINING_PLAN,
        market: composeMarket(development, save),
        currentRound: save.round,
        seasonLabel: SEASON_LABEL,
        today,
      };
    },

    async saveLineup(_clubId: string, selection: LineupSelection): Promise<void> {
      try {
        storage().setItem(LINEUP_STORAGE_KEY, JSON.stringify(selection));
      } catch {
        // Sin almacenamiento disponible la alineacion vive solo en memoria.
      }
    },

    async markMessageRead(messageId: string): Promise<void> {
      readMessages.add(messageId);
    },

    async upgradeStaff(_clubId: string, staffId: string): Promise<void> {
      const development = readDevelopment();
      const member = composeStaff(development).find((entry) => entry.id === staffId);
      if (!member) throw new Error('No encontramos a ese profesional en el cuerpo técnico');
      if (member.level >= MAX_STAFF_LEVEL) {
        throw new Error(`${member.name} ya está en el nivel máximo`);
      }

      const cost = staffUpgradeCost(member.role, member.level);
      if (cost === null) throw new Error(`${member.name} ya está en el nivel máximo`);

      const nextLevel = (member.level + 1) as StaffLevel;
      if (availableCash(development, readSeason()) < cost) {
        throw new Error('No hay caja suficiente para pagar la mejora');
      }

      const salaryDelta = staffSalary(member.role, nextLevel) - staffSalary(member.role, member.level);
      writeDevelopment(
        record(
          development,
          {
            id: `inv-${Date.now()}-${staffId}`,
            kind: 'mejora de staff',
            label: `${member.name} — ${member.role} a nivel ${nextLevel}`,
            cost,
            recurring: salaryDelta,
          },
          { staffLevels: { ...development.staffLevels, [staffId]: nextLevel } },
        ),
      );
    },

    async hireStaff(_clubId: string, role: StaffRole, candidateId: string): Promise<void> {
      const development = readDevelopment();
      const vacancy = composeVacancies(development).find((entry) => entry.role === role);
      if (!vacancy) throw new Error('Ese puesto ya está cubierto');

      const candidate = vacancy.candidates.find((entry) => entry.id === candidateId);
      if (!candidate) throw new Error('Ese candidato ya no está disponible');

      const cost = staffHireCost(role, candidate.level);
      if (availableCash(development, readSeason()) < cost) {
        throw new Error('No hay caja suficiente para pagar la contratación');
      }

      writeDevelopment(
        record(
          development,
          {
            id: `inv-${Date.now()}-${candidateId}`,
            kind: 'contratación',
            label: `${candidate.name} — ${role} de nivel ${candidate.level}`,
            cost,
            recurring: staffSalary(role, candidate.level),
          },
          {
            hires: {
              ...development.hires,
              [role]: { candidateId, name: candidate.name, level: candidate.level },
            },
          },
        ),
      );
    },

    async upgradeFacility(_clubId: string, facilityId: FacilityId): Promise<void> {
      const development = readDevelopment();
      const facility = composeFacilities(development).find((entry) => entry.id === facilityId);
      if (!facility) throw new Error('No encontramos esa instalación');
      if (facility.level >= MAX_FACILITY_LEVEL) {
        throw new Error('Esa instalación ya está en el nivel máximo');
      }

      const cost = facilityUpgradeCost(facilityId, facility.level);
      if (cost === null) throw new Error('Esa instalación ya está en el nivel máximo');

      if (availableCash(development, readSeason()) < cost) {
        throw new Error('No hay caja suficiente para encarar la obra');
      }

      const nextLevel = (facility.level + 1) as FacilityLevel;
      const upkeepDelta = facilityUpkeep(facilityId, nextLevel) - facilityUpkeep(facilityId, facility.level);

      writeDevelopment(
        record(
          development,
          {
            id: `inv-${Date.now()}-${facilityId}`,
            kind: 'mejora de instalación',
            label: `Instalación a nivel ${nextLevel}`,
            cost,
            recurring: upkeepDelta,
          },
          { facilityLevels: { ...development.facilityLevels, [facilityId]: nextLevel } },
        ),
      );
    },
    /**
     * Juega la fecha completa (secciones 13, 49).
     *
     * Los diez partidos pasan por el mismo motor. El del manager con la
     * alineacion que eligio; los otros nueve, IA contra IA. Despues se guarda
     * lo que paso y el estado en que quedaron los planteles.
     */
    async playRound(_clubId: string, selection: LineupSelection): Promise<PlayRoundReport> {
      const save = readSeason();
      const fixtures = seasonFixtures(save.seed);
      const rounds = totalRounds(fixtures);
      if (save.round > rounds) {
        throw new Error('El torneo ya terminó. Podés empezar uno nuevo desde el calendario.');
      }

      // Los planteles base son deterministas; encima se les aplica el estado
      // con el que quedaron de la fecha anterior.
      const development = readDevelopment();
      const base = leagueTeams(
        selection.tactics,
        save.chemistry[CLUB_ID] ?? INITIAL_CHEMISTRY,
        promotedPlayers(development, save),
        // EL FISIOTERAPEUTA (fase 8). Su efecto entra al partido por aca y
        // reduce cuantas lesiones sortea el motor. Antes no entraba a ningun
        // lado y el rol declaraba `pendiente`.
        injuryPreventionOf(staffAssignments(development)),
        // Los rivales tambien cumplen anios (fase 8).
        save.seasonsClosed ?? 0,
      );
      // Los traspasos mueven jugadores entre planteles antes de jugar: el que
      // se vendio el jueves no juega el domingo.
      const teams = restoreTeams(applyTransfers(base, save.transfers ?? []), save);

      const table = seasonTable(save.records);
      const position = table.findIndex((row) => row.clubId === CLUB_ID) + 1;
      const squadForOffers = composeSquad(development, save, todayOf(save, rounds));

      const outcome = playSeasonRound({
        fixtures,
        round: save.round,
        teams,
        userClubId: CLUB_ID,
        // La alineacion elegida por el manager. Los huecos vacios los
        // completa el motor con su propia autoseleccion.
        userLineup: {
          starterIds: selection.starters.filter((id): id is string => id !== null),
          benchIds: selection.bench,
        },
        seed: save.seed,
        // Los mismos dias que muestra el calendario. Que estos dos numeros
        // salgan del mismo lugar es lo que hace que "el jueves y el domingo"
        // se sienta distinto de "domingo a domingo".
        restDays: restDaysBefore(save.round + 1),
        staff: progressionStaff(development),
        training: roundTraining(development, save.training ?? DEFAULT_TRAINING_PLAN),
        ...(position > 0 ? { tableMood: tableMood(position, LEAGUE_CLUB_IDS.length) } : {}),
      });

      // Las ofertas de los clubes de IA por los jugadores del manager se
      // generan al jugar: el mercado se mueve cuando pasa el tiempo, no
      // cuando uno entra a la pantalla.
      const incoming = generateIncomingOffers(save, squadForOffers, save.round);

      // LA RECAUDACION (fase 6). Solo si el club jugo de local esa fecha.
      //
      // Se calcula ACA, con el precio vigente hoy, y se guarda: un partido
      // cobrado es un hecho. Derivarlo despues haria que cambiar el precio en
      // la fecha 15 reescribiera lo que se recaudo en la fecha 3.
      const gate = gateOfRound(development, save, fixtures, position, rounds);

      // La obra del estadio avanza una semana por fecha.
      const work = advanceStadiumWork(development);
      if (work.changed) writeDevelopment(work.state);

      const next: SeasonSave = {
        ...save,
        round: save.round + 1,
        records: [...save.records, ...outcome.records],
        totals: accumulateRound(save.totals, outcome.records),
        conditions: snapshotConditions(outcome.teams),
        // LOS ATRIBUTOS DESARROLLADOS (fase 8). Solo del club del manager: los
        // rivales se derivan de las temporadas cerradas y guardar 418
        // jugadores mas seria medio megabyte por nada.
        attributes: snapshotAttributes(outcome.teams, [CLUB_ID]),
        chemistry: snapshotChemistry(outcome.teams),
        offers: [...(save.offers ?? []), ...incoming],
        ...(gate ? { gates: [...(save.gates ?? []), gate.record] } : {}),
      };
      const written = writeSeason(next);

      return {
        round: save.round,
        record: outcome.records.find((record) => record.userMatch) ?? null,
        injuries: outcome.injuries.map((injury) => ({
          playerName: injury.playerName,
          severity: injury.severity,
          daysOut: injury.daysOut,
        })),
        suspensions: outcome.suspensions.map((entry) => ({
          playerName: entry.playerName,
          matches: entry.matches,
        })),
        skipped: outcome.skipped.map((entry) => entry.reason),
        gate: gate
          ? {
              attendance: gate.revenue.attendance,
              occupancy: gate.revenue.occupancy,
              total: gate.revenue.total,
            }
          : null,
        workFinished: work.finished,
        saveWarning: written.saved
          ? written.trimmed
            ? 'Guardamos la temporada, pero hubo que dejar de lado el detalle de los partidos que no jugaste: el navegador se estaba quedando sin lugar.'
            : null
          : (written.error ?? 'No se pudo guardar la temporada.'),
      };
    },

    async resetSeason(_clubId: string): Promise<void> {
      writeSeason(emptySeason());
    },

    /**
     * CIERRA LA TEMPORADA (fase 6).
     *
     * Lo que hace irreversible a esta accion es el paso del tiempo: al volver
     * todos tienen un anio mas. Por eso solo se puede cuando el torneo
     * termino, y por eso avisa lo que paso.
     *
     * El retiro y el recambio de inferiores los decide el motor
     * (`progression/season-close.ts`). Aca solo se junta el estado, se llama y
     * se guarda el numero de temporadas cerradas, que es lo unico que hace
     * falta: las edades se derivan de ese numero.
     */
    async closeSeason(_clubId: string): Promise<SeasonCloseReport> {
      const save = readSeason();
      const rounds = totalRounds(seasonFixtures(save.seed));
      if (save.round <= rounds) {
        throw new Error(
          `Todavía quedan fechas por jugar (vas por la ${save.round} de ${rounds}). ` +
            'Cerrar ahora sería perder el torneo a medio jugar.',
        );
      }

      const development = readDevelopment();
      const today = todayOf(save, rounds);
      const squad = composeSquad(development, save, today);
      const academy = composeFacilities(development).find((entry) => entry.id === 'academia');
      const seasonsClosed = save.seasonsClosed ?? 0;

      // La camada que produce la academia para la temporada que empieza. Su
      // nivel decide cuantos y con que techo, asi que mejorar la instalacion
      // se ve de una temporada a la otra.
      const intake = buildYouthSquad(
        CLUB_ID,
        academy?.level ?? 1,
        `camada-${seasonsClosed + 1}`,
        0,
      );

      const result = closeSeasonOf({
        players: squad.map((entry) => entry.player),
        // Las inferiores de hoy, tal como las ve la pantalla.
        youth: composeYouth(development, save).map((entry) => ({
          player: entry.player,
          origin: entry.origin,
          yearsAtClub: entry.yearsAtClub,
        })),
        intake,
        seed: `${save.seed}:${seasonsClosed}`,
      });

      // La temporada nueva arranca limpia, menos lo que cruza el anio: los
      // retirados (que ya no estan), las temporadas cerradas y los juveniles
      // que el manager subio al plantel.
      const retiredIds = new Set(result.retired.map((entry) => entry.player.id));

      // LOS ATRIBUTOS CRUZAN EL ANIO (fase 8). `closeSeason` devuelve el
      // plantel con un anio mas encima —y con lo que se desarrollo durante la
      // temporada, porque venia de `composeSquad`— asi que hay que guardarlos
      // en la temporada nueva. Sin esto, cerrar la temporada tiraba todo el
      // crecimiento del anio y el plantel volvia al del archivo.
      const carried: Record<string, readonly number[]> = {};
      for (const player of result.players) {
        carried[player.id] = ATTRIBUTE_KEYS.map((key) => player.attributes[key]);
      }

      writeSeason({
        ...emptySeason(`${save.seed}-t${seasonsClosed + 1}`),
        seasonsClosed: seasonsClosed + 1,
        promoted: (save.promoted ?? []).filter((id) => !retiredIds.has(id)),
        retired: [...(save.retired ?? []), ...retiredIds],
        attributes: carried,
      });

      return {
        seasonNumber: seasonsClosed + 2,
        retired: result.retired.map((entry) => ({
          name: entry.player.name,
          age: entry.player.age,
        })),
        released: result.released.map((entry) => ({
          name: entry.player.name,
          age: entry.player.age,
        })),
        intake: intake.length,
      };
    },

    /** El precio de la entrada (seccion 9, fase 6). */
    async setTicketPrice(_clubId: string, price: number): Promise<void> {
      if (!Number.isFinite(price)) throw new Error('Ese precio no es un número');
      const clamped = Math.round(Math.min(MAX_TICKET_PRICE, Math.max(MIN_TICKET_PRICE, price)));
      const development = readDevelopment();
      writeDevelopment({ ...development, ticketPrice: clamped });
    },

    /** Encara la ampliacion del estadio (seccion 9, fase 6). */
    async expandStadium(_clubId: string, seats: number): Promise<void> {
      const development = readDevelopment();
      if (development.expansion) {
        throw new Error('Ya hay una obra en curso en el estadio');
      }
      if (!(EXPANSION_STEPS as readonly number[]).includes(seats)) {
        throw new Error('Esa ampliación no está entre las opciones');
      }

      const stadium = stadiumOf(CLUB_ID, development.stadiumSeats ?? 0);
      const cost = expansionCost(seats, stadium.capacity);
      if (availableCash(development, readSeason()) < cost) {
        throw new Error('No hay caja suficiente para encarar la ampliación');
      }

      const weeks = expansionWeeks(seats);
      writeDevelopment(
        record(
          development,
          {
            id: `inv-${Date.now()}-estadio`,
            kind: 'ampliación del estadio',
            label: `Ampliación de ${seats.toLocaleString('es-AR')} asientos`,
            cost,
            // El mantenimiento arranca cuando la obra termina, no cuando
            // empieza: todavia no hay asientos que mantener.
            recurring: 0,
          },
          { expansion: { seats, weeksTotal: weeks, weeksLeft: weeks, cost } },
        ),
      );
    },

    async saveTraining(_clubId: string, plan: TrainingPlan): Promise<void> {
      const save = readSeason();
      writeSeason({ ...save, training: plan });
    },

    async promoteYouth(_clubId: string, youthId: string): Promise<void> {
      const save = readSeason();
      const development = readDevelopment();
      const youth = composeYouth(development, save).find((entry) => entry.id === youthId);
      if (!youth) throw new Error('Ese juvenil ya no está en las inferiores');
      if (!youth.promotable) {
        throw new Error(`${youth.name} tiene ${youth.age} años: todavía no puede subir al plantel`);
      }
      writeSeason({ ...save, promoted: [...(save.promoted ?? []), youthId] });
    },
    // ============================================================
    // Mercado (fase 5)
    // ============================================================

    async sendOffer(_clubId: string, playerId: string, amount: number): Promise<OfferOutcome> {
      const save = readSeason();
      const development = readDevelopment();

      const teams = applyTransfers(
    leagueTeams(undefined, undefined, [], 0, save.seasonsClosed ?? 0),
    save.transfers ?? [],
  );
      const found = [...teams].find(([clubId, team]) =>
        clubId !== CLUB_ID && team.players.some((entry) => entry.id === playerId),
      );
      if (!found) throw new Error('Ese jugador ya no está en el club al que le ofreciste');
      const [sellerId, sellerTeam] = found;
      const player = sellerTeam.players.find((entry) => entry.id === playerId) as Player;

      const squad = composeSquad(development, save, todayOf(save, 19));
      const cash = composeFinances(development, squad, save).cash;
      if (amount > cash) {
        throw new Error(
          `La oferta es de ${formatMoney(amount)} y en caja hay ${formatMoney(cash)}.`,
        );
      }

      const listed = new Set(autoTransferList(sellerTeam.players).map((entry) => entry.id));
      const result = negotiate({
        player,
        contractMonths: RIVAL_CONTRACT_MONTHS,
        amount,
        need: squadNeed(player, sellerTeam.players),
        listed: listed.has(playerId),
      });

      const offer: StoredOffer = {
        id: `of-${Date.now()}-${playerId}`,
        playerId,
        playerName: player.name,
        fromClubId: CLUB_ID,
        toClubId: sellerId,
        amount,
        status: result.verdict,
        round: save.round,
        counter: result.counter,
        reason: result.reason,
      };

      const transfers =
        result.verdict === 'aceptada'
          ? [
              ...(save.transfers ?? []),
              {
                playerId,
                playerName: player.name,
                fromClubId: sellerId,
                toClubId: CLUB_ID,
                amount,
                round: save.round,
              },
            ]
          : (save.transfers ?? []);

      writeSeason({ ...save, offers: [...(save.offers ?? []), offer], transfers });
      // La plata sale de la caja de desarrollo, que es la unica caja que hay.
      if (result.verdict === 'aceptada') {
        recordTransferSpend(amount, `${player.name} — compra a ${clubById(sellerId).name}`);
      }

      return {
        verdict: result.verdict,
        counter: result.counter,
        reason: result.reason,
        closed: result.verdict === 'aceptada',
      };
    },

    async respondToOffer(
      _clubId: string,
      offerId: string,
      action: 'aceptar' | 'rechazar' | 'contraofertar',
      counter?: number,
    ): Promise<OfferOutcome> {
      const save = readSeason();
      const offer = (save.offers ?? []).find((entry) => entry.id === offerId);
      if (!offer) throw new Error('Esa oferta ya no está');
      if (offer.toClubId !== CLUB_ID) throw new Error('Esa oferta no es por un jugador tuyo');
      if (offer.status !== 'enviada' && offer.status !== 'contraoferta') {
        throw new Error('Esa oferta ya está resuelta');
      }

      const update = (status: StoredOffer['status'], patch: Partial<StoredOffer> = {}): SeasonSave => ({
        ...save,
        offers: (save.offers ?? []).map((entry) =>
          entry.id === offerId ? { ...entry, status, ...patch } : entry,
        ),
      });

      if (action === 'rechazar') {
        writeSeason(update('rechazada', { reason: 'Rechazaste la oferta.' }));
        return { verdict: 'rechazada', counter: null, reason: 'Rechazaste la oferta.', closed: false };
      }

      if (action === 'contraofertar') {
        const asked = counter ?? Math.round(offer.amount * 1.3);
        // El club comprador acepta si lo que pedis no se pasa mucho de lo que
        // ofrecio. Es una cuenta, no un sorteo: hasta un 25% mas paga.
        const accepts = asked <= offer.amount * 1.25;
        if (!accepts) {
          const reason = `${clubById(offer.fromClubId).name} se bajó: ${formatMoney(asked)} le parece demasiado.`;
          writeSeason(update('rechazada', { counter: asked, reason }));
          return { verdict: 'rechazada', counter: asked, reason, closed: false };
        }

        const reason = `${clubById(offer.fromClubId).name} aceptó tu contraoferta de ${formatMoney(asked)}.`;
        const next = update('aceptada', { amount: asked, counter: asked, reason });
        writeSeason({
          ...next,
          transfers: [
            ...(save.transfers ?? []),
            {
              playerId: offer.playerId,
              playerName: offer.playerName,
              fromClubId: CLUB_ID,
              toClubId: offer.fromClubId,
              amount: asked,
              round: save.round,
            },
          ],
        });
        recordTransferIncome(asked, `${offer.playerName} — venta a ${clubById(offer.fromClubId).name}`);
        return { verdict: 'aceptada', counter: asked, reason, closed: true };
      }

      const reason = `Aceptaste la oferta de ${clubById(offer.fromClubId).name}.`;
      writeSeason({
        ...update('aceptada', { reason }),
        transfers: [
          ...(save.transfers ?? []),
          {
            playerId: offer.playerId,
            playerName: offer.playerName,
            fromClubId: CLUB_ID,
            toClubId: offer.fromClubId,
            amount: offer.amount,
            round: save.round,
          },
        ],
      });
      recordTransferIncome(offer.amount, `${offer.playerName} — venta a ${clubById(offer.fromClubId).name}`);
      return { verdict: 'aceptada', counter: null, reason, closed: true };
    },

    async setTransferListed(_clubId: string, playerId: string, listed: boolean): Promise<void> {
      const save = readSeason();
      const current = new Set(save.listed ?? []);
      if (listed) current.add(playerId);
      else current.delete(playerId);
      writeSeason({ ...save, listed: [...current] });
    },
  };
}
