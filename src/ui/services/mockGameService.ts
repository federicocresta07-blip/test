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
import { DEMO_SQUAD } from '../data/squad.ts';
import {
  DEMO_FACILITIES,
  DEMO_FINANCES,
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
import type { ClubFacility, ClubPlayer, InboxMessage, StaffMember, StaffVacancy } from '../models/index.ts';
import { SEASON_LABEL } from '../data/competition.ts';
import { DEMO_OFFERS_RECEIVED, DEMO_OFFERS_SENT } from '../data/market.ts';
import { DEMO_INBOX } from '../data/inbox.ts';
import { staffMessages } from '../lib/staff-messages.ts';
import { totalRounds } from '../../competition/fixtures.ts';
import {
  playRound as playSeasonRound,
  type RoundTraining,
} from '../../competition/season.ts';
import { accumulateRound } from '../../competition/stats.ts';
import {
  progressionEffects,
  staffEffect,
  staffSpec,
  type StaffAssignment,
} from '../../domain/staff.ts';
import { LEAGUE_CLUB_IDS, leagueTeams } from '../data/league.ts';
import { buildYouthSquad } from '../data/youth.ts';
import { canPromote, scoutPotential } from '../../domain/youth.ts';
import { focusFor, DEFAULT_TRAINING_PLAN, type TrainingPlan } from '../../domain/training.ts';
import { overallForPosition } from '../../ratings/overall.ts';
import type { Player } from '../../domain/player.ts';
import type { Position } from '../../domain/positions.ts';
import type { ScoutedYouth } from '../models/index.ts';
import {
  fixtureDate,
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
  snapshotChemistry,
  snapshotConditions,
  withCondition,
  writeSeason,
  type SeasonSave,
} from './season-store.ts';
import type { GameService, PlayRoundReport } from './types.ts';

/** Aviso visible en la interfaz: estos datos no son un dataset oficial. */
export const DEMO_DATA_NOTICE =
  'Datos de demostración: los clubes son reales, los jugadores y los números son inventados.';

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
    const raw = localStorage.getItem(LINEUP_STORAGE_KEY);
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

/** Las finanzas con lo invertido descontado y el gasto recurrente sumado. */
function composeFinances(development: DevelopmentState): typeof DEMO_FINANCES {
  const totals = investmentTotals(development);
  return {
    ...DEMO_FINANCES,
    cash: Math.max(0, DEMO_FINANCES.cash - totals.spent),
    monthlyExpenses: DEMO_FINANCES.monthlyExpenses + totals.recurring,
    wageBill:
      DEMO_FINANCES.wageBill +
      development.investments
        .filter((entry) => entry.kind !== 'mejora de instalación')
        .reduce((total, entry) => total + entry.recurring, 0),
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
function progressionStaff(development: DevelopmentState): ReturnType<typeof progressionEffects> {
  const facilities = composeFacilities(development);
  const levelOf = (facilityId: FacilityId): FacilityLevel =>
    facilities.find((facility) => facility.id === facilityId)?.level ?? 1;

  const assignments: StaffAssignment[] = composeStaff(development).map((member) => ({
    role: member.role,
    level: member.level,
    facilityLevel: levelOf(staffSpec(member.role).facility),
  }));

  return progressionEffects(assignments);
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
function composeYouth(development: DevelopmentState, save: SeasonSave): readonly ScoutedYouth[] {
  const academy = composeFacilities(development).find((entry) => entry.id === 'academia');
  const squad = buildYouthSquad(CLUB_ID, academy?.level ?? 1);
  const scout = effectOfRole(development, 'Ojeador juvenil');
  // Sin ojeador juvenil el margen es el del nivel 1 empeorado: el club no
  // tiene a nadie mirando y lo declara en pantalla.
  const spread = scout ? scout.actual : NO_SCOUT_SPREAD;
  const promoted = new Set(save.promoted ?? []);

  return squad
    .filter((entry) => !promoted.has(entry.player.id))
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
function composeSquad(development: DevelopmentState, save: SeasonSave): readonly ClubPlayer[] {
  const base = DEMO_SQUAD.map((entry) => ({
    ...entry,
    player: withCondition(entry.player, save.conditions[entry.player.id]),
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

  return [...base, ...promoted];
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
      return {
        manager: {
          id: 'mgr-1',
          name: 'Director Técnico',
          clubId: CLUB_ID,
          since: '2025-01-15',
        },
        club,
        clubs: CLUBS,
        squad: composeSquad(development, save),
        lineup: readStoredLineup() ?? initialLineup(),
        finances: composeFinances(development),
        staff: composeStaff(development),
        vacancies: composeVacancies(development),
        facilities: composeFacilities(development),
        projects: DEMO_PROJECTS,
        fixtures: toUiFixtures(fixtures, save.records),
        table: toUiTable(table),
        offersReceived: DEMO_OFFERS_RECEIVED,
        offersSent: DEMO_OFFERS_SENT,
        inbox: composeInbox(development, today),
        season: composeSeason(save),
        youth: composeYouth(development, save),
        training: save.training ?? DEFAULT_TRAINING_PLAN,
        currentRound: save.round,
        seasonLabel: SEASON_LABEL,
        today,
      };
    },

    async saveLineup(_clubId: string, selection: LineupSelection): Promise<void> {
      try {
        localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(selection));
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
      const finances = composeFinances(development);
      if (finances.cash < cost) {
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
      const finances = composeFinances(development);
      if (finances.cash < cost) {
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

      const finances = composeFinances(development);
      if (finances.cash < cost) {
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
      );
      const teams = restoreTeams(base, save);

      const table = seasonTable(save.records);
      const position = table.findIndex((row) => row.clubId === CLUB_ID) + 1;

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

      const next: SeasonSave = {
        ...save,
        round: save.round + 1,
        records: [...save.records, ...outcome.records],
        totals: accumulateRound(save.totals, outcome.records),
        conditions: snapshotConditions(outcome.teams),
        chemistry: snapshotChemistry(outcome.teams),
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
  };
}
