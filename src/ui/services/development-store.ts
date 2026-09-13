/**
 * Estado de desarrollo del club que el prototipo persiste localmente.
 *
 * Guarda solo las DECISIONES del usuario —a quién contrató, qué mejoró—, no
 * el estado derivado. Los salarios, los efectos y los costes se recalculan
 * siempre desde el modelo de dominio, así que un cambio en los números del
 * juego se refleja en una partida ya empezada en lugar de quedar congelado.
 *
 * Cuando exista el backend, esto se reemplaza por sus endpoints y la interfaz
 * no se entera.
 */

import type { FacilityId, FacilityLevel } from '../../domain/facilities.ts';
import type { StaffLevel, StaffRole } from '../../domain/staff.ts';
import { storage } from './storage.ts';
import {
  MAX_TICKET_PRICE,
  MIN_TICKET_PRICE,
  REFERENCE_TICKET_PRICE,
} from '../../domain/stadium.ts';

/** Una inversión ya hecha, para que el usuario vea en qué gastó. */
export type InvestmentRecord = {
  readonly id: string;
  readonly kind:
    | 'mejora de staff'
    | 'contratación'
    | 'mejora de instalación'
    /** Compra de un jugador: sale de la misma caja (fase 5). */
    | 'fichaje'
    /** Venta de un jugador: entra a la misma caja, con coste negativo. */
    | 'venta'
    /** Ampliación del estadio (fase 6): la inversión más grande del juego. */
    | 'ampliación del estadio';
  readonly label: string;
  readonly cost: number;
  /** Cuánto sumó al gasto mensual recurrente. */
  readonly recurring: number;
};

export type DevelopmentState = {
  /** Niveles alcanzados por mejora, por id de profesional. */
  readonly staffLevels: Record<string, StaffLevel>;
  /** Puestos cubiertos por contratación. */
  readonly hires: Record<string, { readonly candidateId: string; readonly name: string; readonly level: StaffLevel }>;
  /** Niveles alcanzados por obra, por instalación. */
  readonly facilityLevels: Partial<Record<FacilityId, FacilityLevel>>;
  readonly investments: readonly InvestmentRecord[];
  /**
   * Precio de la entrada, en pesos. Es la decisión del manager (fase 6) y no
   * se puede derivar de nada: por eso se guarda.
   */
  readonly ticketPrice?: number;
  /**
   * Asientos construidos por ampliación. La capacidad total es el aforo real
   * del archivo más esto, así que el dato original no se pisa nunca.
   */
  readonly stadiumSeats?: number;
  /**
   * La obra del estadio en curso, si hay una.
   *
   * Las semanas bajan al jugar cada fecha y al llegar a cero los asientos
   * pasan a `stadiumSeats`. Es la única obra del juego que lleva tiempo real,
   * y tiene que llevarlo: la ampliación grande no entra en una temporada.
   */
  readonly expansion?: StadiumWork;
};

export type StadiumWork = {
  readonly seats: number;
  readonly weeksTotal: number;
  readonly weeksLeft: number;
  readonly cost: number;
};

export const EMPTY_DEVELOPMENT: DevelopmentState = {
  staffLevels: {},
  hires: {},
  facilityLevels: {},
  investments: [],
  ticketPrice: REFERENCE_TICKET_PRICE,
  stadiumSeats: 0,
};

const STORAGE_KEY = 'manager:desarrollo:v1';

function clampTicketPrice(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return REFERENCE_TICKET_PRICE;
  return Math.round(Math.min(MAX_TICKET_PRICE, Math.max(MIN_TICKET_PRICE, value)));
}

export function readDevelopment(): DevelopmentState {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DEVELOPMENT;
    const parsed = JSON.parse(raw) as DevelopmentState;
    // Validación mínima: si el formato cambió, se arranca limpio.
    if (!parsed.staffLevels || !parsed.hires || !parsed.facilityLevels) return EMPTY_DEVELOPMENT;
    return {
      ...EMPTY_DEVELOPMENT,
      ...parsed,
      investments: parsed.investments ?? [],
      // Los dos campos de la fase 6 pueden faltar en una partida vieja. Y el
      // precio se ACOTA al leer: la escala de plata del juego cambio una vez
      // (ver `domain/stadium.ts`), asi que una partida guardada puede traer un
      // precio que hoy esta fuera de rango. Sin este clamp, un 25 guardado
      // sobrevivia y dejaba al club recaudando nada para siempre.
      ticketPrice: clampTicketPrice(parsed.ticketPrice),
      stadiumSeats: Math.max(0, parsed.stadiumSeats ?? 0),
    };
  } catch {
    return EMPTY_DEVELOPMENT;
  }
}

export function writeDevelopment(state: DevelopmentState): void {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento, las decisiones viven solo en memoria.
  }
}

/** Total invertido y total sumado al gasto mensual. */
export function investmentTotals(state: DevelopmentState): {
  readonly spent: number;
  readonly recurring: number;
} {
  return state.investments.reduce(
    (totals, entry) => ({
      spent: totals.spent + entry.cost,
      recurring: totals.recurring + entry.recurring,
    }),
    { spent: 0, recurring: 0 },
  );
}

export type { StaffLevel, StaffRole, FacilityId, FacilityLevel };
