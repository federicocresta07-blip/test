/**
 * EL PUENTE DEL ESTADIO Y LAS FINANZAS (fase 6).
 *
 * La interfaz no calcula plata. Acá se arma el estadio del club a partir del
 * dato real del archivo y se llama a `domain/finances.ts`, que es donde vive
 * el ejercicio. Lo único que hace este archivo es juntar el estado disperso
 * —plantel, staff, instalaciones, obras, partidos jugados— y pasarlo.
 *
 * LA CAPACIDAD NO SE PISA. El aforo del archivo es dato histórico: River
 * jugaba en un estadio de 76.687 en 1998. Si el manager amplía, los asientos
 * construidos se guardan aparte y la capacidad de juego es la suma. Así el
 * dato original sigue siendo consultable y la ampliación sigue siendo nuestra.
 */

import {
  DEFAULT_STADIUM_CONFIG,
  REFERENCE_TICKET_PRICE,
  expansionUpkeep,
  matchRevenue,
  reputationFromStadium,
  type MatchRevenue,
  type Stadium,
} from '../../domain/stadium.ts';
import { financeReport, type FinanceInput, type FinanceReport } from '../../domain/finances.ts';
import { facilityUpkeep } from '../../domain/facilities.ts';
import { staffSalary } from '../../domain/staff.ts';
import { apertura98Club } from '../../data/apertura98.ts';
import type { ClubFacility, ClubPlayer, StaffMember } from '../models/index.ts';
import type { GateRecord } from '../services/season-store.ts';

/**
 * El estadio del club, tal como se juega.
 *
 * `builtSeats` son los asientos que agregó el manager. Cero al empezar.
 */
export function stadiumOf(clubId: string, builtSeats = 0): Stadium {
  const club = apertura98Club(clubId);
  return {
    name: club.stadium ?? 'Estadio sin nombre en el archivo',
    capacity: (club.capacity ?? 15_000) + Math.max(0, builtSeats),
    members: club.members ?? 2_000,
  };
}

/** El aforo original del archivo, sin las ampliaciones. Para poder mostrarlo. */
export function originalCapacity(clubId: string): number {
  return apertura98Club(clubId).capacity ?? 15_000;
}

export function reputationOf(clubId: string, builtSeats = 0): number {
  return reputationFromStadium(stadiumOf(clubId, builtSeats));
}

/** El momento del equipo, 0..1, a partir de sus últimos cinco resultados. */
export function momentumFrom(form: readonly ('V' | 'E' | 'D')[]): number {
  if (form.length === 0) return 0.5;
  const points = form.reduce(
    (total, result) => total + (result === 'V' ? 1 : result === 'E' ? 0.5 : 0),
    0,
  );
  return points / form.length;
}

export type GateInput = {
  readonly clubId: string;
  readonly builtSeats: number;
  readonly ticketPrice: number;
  readonly opponentId: string;
  readonly position: number;
  readonly clubsInLeague: number;
  readonly form: readonly ('V' | 'E' | 'D')[];
  /** Importancia del partido, 0..1. */
  readonly importance: number;
};

/** La recaudación de un partido de local. */
export function gateFor(input: GateInput): MatchRevenue {
  return matchRevenue({
    stadium: stadiumOf(input.clubId, input.builtSeats),
    ticketPrice: input.ticketPrice,
    opponentReputation: reputationOf(input.opponentId),
    position: input.position,
    clubsInLeague: input.clubsInLeague,
    momentum: momentumFrom(input.form),
    importance: input.importance,
  });
}

export type FinanceBridgeInput = {
  readonly clubId: string;
  readonly builtSeats: number;
  readonly squad: readonly ClubPlayer[];
  readonly staff: readonly StaffMember[];
  readonly facilities: readonly ClubFacility[];
  readonly position: number;
  readonly clubsInLeague: number;
  readonly gates: readonly GateRecord[];
  readonly openingCash: number;
  readonly capitalSpent: number;
  readonly capitalReceived: number;
  readonly homeMatchesLeft: number;
};

/**
 * El balance del club.
 *
 * Todas las líneas salen de acá, ninguna está escrita a mano. Los sueldos son
 * la suma de los contratos —del plantel y del cuerpo técnico—, el
 * mantenimiento sale del nivel de cada instalación, y la recaudación de los
 * partidos que realmente se jugaron.
 */
export function financesOf(input: FinanceBridgeInput): FinanceReport {
  const playerWages = input.squad.reduce((total, entry) => total + entry.salary, 0);
  const staffWages = input.staff.reduce(
    (total, member) => total + staffSalary(member.role, member.level),
    0,
  );
  const upkeep = input.facilities.reduce(
    (total, facility) => total + facilityUpkeep(facility.id, facility.level),
    0,
  );
  const gateTotal = input.gates.reduce((total, gate) => total + gate.total, 0);

  const report: FinanceInput = {
    stadium: stadiumOf(input.clubId, input.builtSeats),
    reputation: reputationOf(input.clubId, input.builtSeats),
    position: input.position,
    clubsInLeague: input.clubsInLeague,
    playerWages,
    staffWages,
    facilityUpkeep: upkeep,
    stadiumUpkeep: expansionUpkeep(Math.max(0, input.builtSeats)),
    gateTotal,
    homeMatchesPlayed: input.gates.length,
    openingCash: input.openingCash,
    capitalSpent: input.capitalSpent,
    capitalReceived: input.capitalReceived,
    homeMatchesLeft: input.homeMatchesLeft,
  };
  return financeReport(report);
}

export { DEFAULT_STADIUM_CONFIG, REFERENCE_TICKET_PRICE };
export type { FinanceReport, MatchRevenue, Stadium, GateRecord };
