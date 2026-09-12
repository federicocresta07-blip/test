/**
 * LA TEMPORADA GUARDADA.
 *
 * Guarda lo que no se puede volver a calcular —los partidos que se jugaron y
 * el estado en que quedaron los planteles— y nada mas. El fixture, la tabla,
 * los planteles base y los atributos se reconstruyen: son deterministas.
 *
 * Por que importa: guardar 440 jugadores completos serian varios megabytes y
 * ademas quedaria congelado. Guardando solo lo que cambia, un ajuste en los
 * numeros del juego se refleja en una temporada ya empezada.
 *
 * Presupuesto de espacio, medido: ~8,7 kB por partido del manager (con las
 * lineas individuales completas) y ~2,6 kB por partido de IA. Una temporada de
 * 19 fechas ocupa unos 730 kB. Si el navegador se queja, `writeSeason`
 * adelgaza los partidos de IA y reintenta una vez antes de darse por vencido.
 */

import type { Player } from '../../domain/player.ts';
import type { Team } from '../../domain/team.ts';
import type { MatchRecord } from '../../competition/season.ts';
import { EMPTY_TOTALS, type SeasonTotals } from '../../competition/stats.ts';
import { DEFAULT_TRAINING_PLAN, type TrainingPlan } from '../../domain/training.ts';

/** Lo que cambia de un jugador entre partidos, como tupla para ahorrar lugar. */
export type ConditionTuple = readonly [
  form: number,
  morale: number,
  fatigue: number,
  sharpness: number,
  injuryDays: number,
  suspensionMatches: number,
];

export type SeasonSave = {
  readonly version: number;
  /** Semilla del torneo: define el fixture y los partidos. */
  readonly seed: string;
  /** Proxima fecha a jugar. Si es mayor que el total, el torneo termino. */
  readonly round: number;
  readonly records: readonly MatchRecord[];
  readonly totals: SeasonTotals;
  /** Estado de cada jugador, por id. */
  readonly conditions: Readonly<Record<string, ConditionTuple>>;
  /** Cohesion de cada club, por id. */
  readonly chemistry: Readonly<Record<string, number>>;
  /** Plan de entrenamiento del club del manager (fase 4). */
  readonly training?: TrainingPlan;
  /** Juveniles ya subidos al plantel profesional, por id (fase 4). */
  readonly promoted?: readonly string[];
  /** Ofertas del mercado, enviadas y recibidas (fase 5). */
  readonly offers?: readonly StoredOffer[];
  /** Traspasos cerrados (fase 5). Definen quien juega en que club. */
  readonly transfers?: readonly StoredTransfer[];
  /** Jugadores del club del manager puestos en el mercado (fase 5). */
  readonly listed?: readonly string[];
};

/**
 * Una oferta del mercado.
 *
 * Guarda el motivo de la respuesta para poder mostrarlo: el club vendedor
 * explica por que aceptó, contraofertó o rechazó, y eso no se recalcula porque
 * depende del estado del plantel en el momento de la oferta.
 */
export type StoredOffer = {
  readonly id: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly fromClubId: string;
  readonly toClubId: string;
  readonly amount: number;
  readonly status: 'enviada' | 'contraoferta' | 'aceptada' | 'rechazada' | 'vencida';
  /** Fecha del torneo en la que se envio. */
  readonly round: number;
  /** Lo que pide el club vendedor, si contraoferto. */
  readonly counter: number | null;
  /** Por que respondio asi. */
  readonly reason: string;
};

export type StoredTransfer = {
  readonly playerId: string;
  readonly playerName: string;
  readonly fromClubId: string;
  readonly toClubId: string;
  readonly amount: number;
  readonly round: number;
};

export const SEASON_VERSION = 1;
export const DEFAULT_SEASON_SEED = 'clausura-2026';

export function emptySeason(seed = DEFAULT_SEASON_SEED): SeasonSave {
  return {
    version: SEASON_VERSION,
    seed,
    round: 1,
    records: [],
    totals: EMPTY_TOTALS,
    conditions: {},
    chemistry: {},
    training: DEFAULT_TRAINING_PLAN,
    promoted: [],
    offers: [],
    transfers: [],
    listed: [],
  };
}

const STORAGE_KEY = 'manager:temporada:v1';

export function readSeason(): SeasonSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySeason();
    const parsed = JSON.parse(raw) as SeasonSave;
    // Validacion minima: si el formato cambio, se arranca de cero. Preferimos
    // una temporada nueva a una a medias que no se entienda.
    if (parsed.version !== SEASON_VERSION || typeof parsed.round !== 'number') {
      return emptySeason();
    }
    return {
      ...emptySeason(parsed.seed ?? DEFAULT_SEASON_SEED),
      ...parsed,
      records: parsed.records ?? [],
      totals: parsed.totals ?? EMPTY_TOTALS,
      conditions: parsed.conditions ?? {},
      chemistry: parsed.chemistry ?? {},
      training: parsed.training ?? DEFAULT_TRAINING_PLAN,
      promoted: parsed.promoted ?? [],
      offers: parsed.offers ?? [],
      transfers: parsed.transfers ?? [],
      listed: parsed.listed ?? [],
    };
  } catch {
    return emptySeason();
  }
}

/** Un partido de IA sin lo que solo sirve para la ficha detallada. */
function slim(record: MatchRecord): MatchRecord {
  if (record.userMatch) return record;
  return {
    ...record,
    events: record.events.filter((event) => event.type === 'gol'),
    narrative: '',
  };
}

export type SaveOutcome = { readonly saved: boolean; readonly trimmed: boolean; readonly error?: string };

/**
 * Guarda la temporada.
 *
 * Si el navegador no tiene lugar, adelgaza los partidos que no son del
 * manager y reintenta una vez. Si sigue sin entrar, lo dice: perder la
 * temporada en silencio seria peor.
 */
export function writeSeason(save: SeasonSave): SaveOutcome {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    return { saved: true, trimmed: false };
  } catch {
    try {
      const trimmed: SeasonSave = { ...save, records: save.records.map(slim) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return { saved: true, trimmed: true };
    } catch {
      return {
        saved: false,
        trimmed: false,
        error:
          'No hay lugar en el almacenamiento del navegador para guardar la temporada. ' +
          'La fecha se jugó, pero al recargar la página se va a perder.',
      };
    }
  }
}

export function clearSeason(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

// ============================================================
// Traducir entre el estado guardado y los equipos del motor
// ============================================================

function tupleOf(player: Player): ConditionTuple {
  return [
    player.condition.form,
    player.condition.morale,
    player.condition.fatigue,
    player.condition.sharpness,
    player.injuryDaysRemaining,
    player.suspensionMatchesRemaining,
  ];
}

/** El estado de todos los planteles, listo para guardar. */
export function snapshotConditions(
  teams: ReadonlyMap<string, Team>,
): Readonly<Record<string, ConditionTuple>> {
  const snapshot: Record<string, ConditionTuple> = {};
  for (const team of teams.values()) {
    for (const player of team.players) snapshot[player.id] = tupleOf(player);
  }
  return snapshot;
}

export function snapshotChemistry(teams: ReadonlyMap<string, Team>): Readonly<Record<string, number>> {
  const snapshot: Record<string, number> = {};
  for (const [clubId, team] of teams) snapshot[clubId] = team.chemistry;
  return snapshot;
}

/** Un jugador con su estado guardado aplicado. Los atributos no se tocan. */
export function withCondition(player: Player, tuple: ConditionTuple | undefined): Player {
  if (!tuple) return player;
  const [form, morale, fatigue, sharpness, injuryDays, suspensionMatches] = tuple;
  return {
    ...player,
    condition: { form, morale, fatigue, sharpness },
    injuryDaysRemaining: injuryDays,
    suspensionMatchesRemaining: suspensionMatches,
  };
}

/**
 * Los equipos del torneo con el estado de la temporada aplicado.
 *
 * Los planteles vienen del generador determinista; esto les pone encima la
 * forma, la moral, la fatiga y las lesiones con las que quedaron.
 */
export function restoreTeams(
  teams: ReadonlyMap<string, Team>,
  save: SeasonSave,
): ReadonlyMap<string, Team> {
  const restored = new Map<string, Team>();
  for (const [clubId, team] of teams) {
    restored.set(clubId, {
      ...team,
      chemistry: save.chemistry[clubId] ?? team.chemistry,
      players: team.players.map((player) => withCondition(player, save.conditions[player.id])),
    });
  }
  return restored;
}
