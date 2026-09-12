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
    | 'venta';
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
};

export const EMPTY_DEVELOPMENT: DevelopmentState = {
  staffLevels: {},
  hires: {},
  facilityLevels: {},
  investments: [],
};

const STORAGE_KEY = 'manager:desarrollo:v1';

export function readDevelopment(): DevelopmentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DEVELOPMENT;
    const parsed = JSON.parse(raw) as DevelopmentState;
    // Validación mínima: si el formato cambió, se arranca limpio.
    if (!parsed.staffLevels || !parsed.hires || !parsed.facilityLevels) return EMPTY_DEVELOPMENT;
    return { ...EMPTY_DEVELOPMENT, ...parsed, investments: parsed.investments ?? [] };
  } catch {
    return EMPTY_DEVELOPMENT;
  }
}

export function writeDevelopment(state: DevelopmentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
