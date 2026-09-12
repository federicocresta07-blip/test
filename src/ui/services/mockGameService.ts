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
import type { ClubFacility, InboxMessage, StaffMember, StaffVacancy } from '../models/index.ts';
import {
  CURRENT_ROUND,
  DEMO_FIXTURES,
  DEMO_TABLE,
  SEASON_LABEL,
  TODAY,
} from '../data/competition.ts';
import { DEMO_OFFERS_RECEIVED, DEMO_OFFERS_SENT } from '../data/market.ts';
import { DEMO_INBOX } from '../data/inbox.ts';
import { staffMessages } from '../lib/staff-messages.ts';
import type { GameService } from './types.ts';

/** Aviso visible en la interfaz: estos datos no son un dataset oficial. */
export const DEMO_DATA_NOTICE =
  'Datos de demostración: los clubes son reales, los jugadores y los números son inventados.';

const CLUB_ID = 'river';
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
function composeInbox(development: DevelopmentState): readonly InboxMessage[] {
  const derived = staffMessages(
    composeStaff(development),
    composeVacancies(development),
    composeFacilities(development),
    TODAY,
  );
  return [...DEMO_INBOX, ...derived]
    .map((message) => (readMessages.has(message.id) ? { ...message, unread: false } : message))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function createMockGameService(): GameService {
  return {
    async loadGame(): Promise<GameState> {
      const club = clubById(CLUB_ID);
      const development = readDevelopment();
      return {
        manager: {
          id: 'mgr-1',
          name: 'Director Técnico',
          clubId: CLUB_ID,
          since: '2025-01-15',
        },
        club,
        clubs: CLUBS,
        squad: DEMO_SQUAD,
        lineup: readStoredLineup() ?? initialLineup(),
        finances: composeFinances(development),
        staff: composeStaff(development),
        vacancies: composeVacancies(development),
        facilities: composeFacilities(development),
        projects: DEMO_PROJECTS,
        fixtures: DEMO_FIXTURES,
        table: DEMO_TABLE,
        offersReceived: DEMO_OFFERS_RECEIVED,
        offersSent: DEMO_OFFERS_SENT,
        inbox: composeInbox(development),
        currentRound: CURRENT_ROUND,
        seasonLabel: SEASON_LABEL,
        today: TODAY,
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
  };
}
