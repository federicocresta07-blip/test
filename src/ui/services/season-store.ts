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
import { ATTRIBUTE_KEYS, type AttributeKey } from '../../domain/attributes.ts';
import type { Team } from '../../domain/team.ts';
import type { MatchRecord } from '../../competition/season.ts';
import { EMPTY_TOTALS, type SeasonTotals } from '../../competition/stats.ts';
import { DEFAULT_TRAINING_PLAN, type TrainingPlan } from '../../domain/training.ts';
import { storage } from './storage.ts';

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
  /** Recaudacion de cada partido de local ya jugado (fase 6). */
  readonly gates?: readonly GateRecord[];
  /** Temporadas cerradas: cuantas veces se paso de anio (fase 6). */
  readonly seasonsClosed?: number;
  /**
   * Jugadores retirados, por id (fase 6).
   *
   * Hay que guardarlos porque el plantel se REGENERA del archivo en cada
   * carga: si no estuviera esta lista, un jugador que se retiro a los 38
   * volveria a aparecer en la temporada siguiente con 38 otra vez. Es la
   * misma razon por la que se guardan los traspasos.
   */
  readonly retired?: readonly string[];
  /**
   * LOS ATRIBUTOS DESARROLLADOS, por id de jugador (fase 8).
   *
   * ============================================================
   * EL BUG QUE ESTO ARREGLA
   * ============================================================
   *
   * El desarrollo existia desde la fase 4 —los jugadores crecen fecha a
   * fecha, hay una pantalla de entrenamiento y una tabla medida en la
   * documentacion— y NO SE GUARDABA. Este archivo guardaba la forma, la
   * moral, la fatiga y las lesiones, y los atributos quedaban afuera; como el
   * plantel se reconstruye del archivo del juego en cada carga, todo el
   * crecimiento se tiraba a la basura en cada recarga.
   *
   * Se vio midiendo: despues de tres temporadas jugadas y cerradas, el mejor
   * once de River seguia clavado en 83,7 mientras los rivales subian a 86,2.
   * El juego se ponia mas dificil cada temporada sin que el manager hiciera
   * nada mal, y el entrenamiento era una pantalla que no servia para nada.
   *
   * Se guardan CON DECIMALES a proposito. Es la leccion de la "muerte por
   * redondeo" de la fase 4: una ganancia de 0,4 puntos por semana redondeada
   * a entero es cero, y nunca se acumula.
   */
  readonly attributes?: Readonly<Record<string, readonly number[]>>;
};

/**
 * LA RECAUDACION DE UN PARTIDO JUGADO ES HISTORIA, NO ESTADO DERIVADO.
 *
 * Casi todo en este archivo se guarda porque no se puede recalcular. Esto
 * tambien, y por una razon que no es obvia: la recaudacion depende del PRECIO
 * DE LA ENTRADA, que el manager puede cambiar cuando quiera. Si se derivara,
 * subir el precio en la fecha 15 reescribiria hacia atras lo que se recaudo en
 * la fecha 3, y la historia del club cambiaria sola.
 *
 * Un partido cobrado es un hecho, igual que su resultado.
 */
export type GateRecord = {
  readonly round: number;
  readonly opponentId: string;
  readonly attendance: number;
  /** El precio que estaba vigente ese dia. */
  readonly ticketPrice: number;
  /** Lo que le quedo al club, ya descontada la parte del visitante. */
  readonly total: number;
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

export const SEASON_VERSION = 2;
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
    gates: [],
    seasonsClosed: 0,
    retired: [],
    attributes: {},
  };
}

const STORAGE_KEY = 'manager:temporada:v1';

/**
 * Si esta partida ya tiene un guardado, sin importar qué dice.
 *
 * Lo usa el elector de equipo para distinguir dos cosas que `readSeason` no
 * distingue: una partida NUEVA (hay que elegir club) de una partida VIEJA sin
 * club anotado (es River, porque antes todas lo eran). Sin esta diferencia, a
 * quien ya tenía una carrera de River en el navegador se le pediría elegir
 * equipo y empezaría de cero.
 */
export function hasStoredSeason(): boolean {
  try {
    return storage().getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readSeason(): SeasonSave {
  try {
    const raw = storage().getItem(STORAGE_KEY);
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
      gates: parsed.gates ?? [],
      seasonsClosed: parsed.seasonsClosed ?? 0,
      retired: parsed.retired ?? [],
      attributes: parsed.attributes ?? {},
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
    storage().setItem(STORAGE_KEY, JSON.stringify(save));
    return { saved: true, trimmed: false };
  } catch {
    try {
      const trimmed: SeasonSave = { ...save, records: save.records.map(slim) };
      storage().setItem(STORAGE_KEY, JSON.stringify(trimmed));
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
    storage().removeItem(STORAGE_KEY);
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

/**
 * Los atributos de cada jugador, para guardarlos.
 *
 * Se guardan como arreglo en el orden de `ATTRIBUTE_KEYS` y no como objeto:
 * diez numeros por jugador contra diez pares clave-valor es la diferencia
 * entre unos kilobytes y unas decenas, y el navegador tiene un limite de
 * espacio que esta temporada ya roza.
 */
export function snapshotAttributes(
  teams: ReadonlyMap<string, Team>,
  clubIds?: readonly string[],
): Readonly<Record<string, readonly number[]>> {
  const wanted = clubIds ? new Set(clubIds) : null;
  const snapshot: Record<string, readonly number[]> = {};
  for (const [clubId, team] of teams) {
    if (wanted && !wanted.has(clubId)) continue;
    for (const player of team.players) {
      snapshot[player.id] = ATTRIBUTE_KEYS.map((key) => player.attributes[key]);
    }
  }
  return snapshot;
}

/** Un jugador con sus atributos desarrollados aplicados. */
export function withAttributes(
  player: Player,
  values: readonly number[] | undefined,
): Player {
  if (!values || values.length !== ATTRIBUTE_KEYS.length) return player;
  const attributes = {} as Record<AttributeKey, number>;
  ATTRIBUTE_KEYS.forEach((key, index) => {
    attributes[key] = values[index] as number;
  });
  // El POTENCIAL no se toca: sale del jugador reconstruido del archivo, que es
  // donde se derivo una vez. Recalcularlo sobre el overall ya desarrollado lo
  // haria crecer junto con el jugador, y entonces nadie llegaria nunca a su
  // techo.
  return { ...player, attributes };
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
 * Los planteles vienen del generador determinista; esto les pone encima los
 * atributos desarrollados, la forma, la moral, la fatiga y las lesiones con
 * las que quedaron.
 *
 * Los ATRIBUTOS tambien: sin ellos el partido se juega con el jugador del
 * archivo y todo el desarrollo de la temporada no cuenta para nada. Era el
 * bug de la fase 4 que aparecio recien en la 8.
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
      players: team.players.map((player) =>
        withCondition(
          withAttributes(player, save.attributes?.[player.id]),
          save.conditions[player.id],
        ),
      ),
    });
  }
  return restored;
}
