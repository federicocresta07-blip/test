/**
 * EVOLUCION DESPUES DEL PARTIDO (secciones 35, 36, 37, 38, 39).
 *
 * El motor de partido no muta nada: recibe equipos y devuelve un resultado.
 * Este modulo es el que cierra el ciclo y produce los equipos actualizados
 * para la fecha siguiente: forma, moral, fatiga, cohesion, lesionados y
 * sancionados.
 *
 * Esto es lo que hace que la rotacion y la profundidad del plantel importen a
 * lo largo de una temporada (seccion 48).
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { DEFAULT_CONFIG } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import type { Player } from '../domain/player.ts';
import { isAvailable } from '../domain/player.ts';
import type { Position } from '../domain/positions.ts';
import { NO_STAFF_EFFECTS, type ProgressionStaffEffects } from '../domain/staff.ts';
import { fatigueRatePerMinute } from '../engine/live-team.ts';
import type { Team } from '../domain/team.ts';
import type { MatchResult, PlayerMatchStats } from '../engine/match-types.ts';

export type ProgressionInput = {
  readonly team: Team;
  readonly result: MatchResult;
  readonly side: 'local' | 'visitante';
  /** Dias de descanso hasta el proximo partido: define cuanto se recupera. */
  readonly restDays?: number;
  /** Estado contractual medio del plantel 1..100 (seccion 35). */
  readonly contractMood?: number;
  /** Animo por la posicion en la tabla, -1 .. +1 (seccion 35). */
  readonly tableMood?: number;
  /** Cuantos jugadores llegaron en el ultimo mercado (seccion 39). */
  readonly newSignings?: number;
  /**
   * Efectos del cuerpo tecnico (seccion 7): recuperacion fisica, tiempo de
   * lesion y recuperacion de moral. Sin staff, el plantel evoluciona solo.
   */
  readonly staff?: ProgressionStaffEffects;
  readonly config?: EngineConfig;
};

/** Gravedad de una lesion y cuanto tiempo deja afuera al jugador (seccion 38). */
export type InjurySeverity = 'leve' | 'moderada' | 'grave';

export type InjuryReport = {
  readonly playerId: string;
  readonly playerName: string;
  readonly severity: InjurySeverity;
  readonly daysOut: number;
};

export type ProgressionResult = {
  readonly team: Team;
  readonly chemistryBefore: number;
  readonly chemistryAfter: number;
  readonly injuries: readonly InjuryReport[];
  readonly suspensions: readonly { readonly playerId: string; readonly playerName: string; readonly matches: number }[];
  readonly notes: readonly string[];
};

/**
 * Sortea la gravedad de una lesion. La mayoria son leves; las graves existen
 * pero son raras. El sorteo depende de la semilla del partido y del jugador,
 * asi que el resultado es reproducible.
 */
function drawInjury(playerId: string, seed: number | string, proneness: number): InjuryReport['severity'] {
  const rng = new Rng(`${seed}:${playerId}`);
  // Un jugador fragil se lesiona mas seguido y tambien mas fuerte.
  const pull = (proneness - 40) / 300;
  const roll = rng.next() - pull;
  if (roll < 0.6) return 'leve';
  if (roll < 0.91) return 'moderada';
  return 'grave';
}

function injuryDays(severity: InjurySeverity, playerId: string, seed: number | string): number {
  const rng = new Rng(`dias:${seed}:${playerId}`);
  switch (severity) {
    case 'leve':
      return rng.intBetween(3, 11);
    case 'moderada':
      return rng.intBetween(14, 38);
    case 'grave':
      return rng.intBetween(50, 170);
  }
}

/**
 * Aplica un cambio a un valor 1..100 con rendimientos decrecientes.
 *
 * Subir de 50 a 60 es facil; subir de 90 a 95 cuesta mucho mas. Sin esto, un
 * equipo que gana diez partidos seguidos termina con moral y cohesion clavadas
 * en 100 y las dos variables dejan de decir nada (secciones 35, 39).
 */
function approachLimit(current: number, delta: number): number {
  if (delta === 0) return current;
  const room = delta > 0 ? (100 - current) / 45 : current / 45;
  return clamp(current + delta * clamp(room, 0, 1), 1, 100);
}

/** Cuanta fatiga suma un jugador por los minutos jugados (seccion 37). */
function fatigueFromMinutes(
  player: Player,
  position: Position,
  minutes: number,
  config: EngineConfig,
): number {
  if (minutes <= 0) return 0;
  return fatigueRatePerMinute(player.attributes.resistencia, position, config) * minutes;
}

/**
 * Cuanto se recupera un jugador con los dias de descanso.
 * El preparador fisico acelera esta recuperacion (seccion 7).
 */
function recovery(
  player: Player,
  restDays: number,
  minutes: number,
  staffRecovery = 0,
  config: EngineConfig = DEFAULT_CONFIG,
): number {
  const { recoveryBasePerDay, recoveryStaminaPerDay, idleRecoveryBonus } = config.progression;
  const stamina = player.attributes.resistencia;
  const perDay =
    (recoveryBasePerDay + (stamina / 100) * recoveryStaminaPerDay) * (1 + staffRecovery / 100);
  // El que no jugo recupera mas rapido.
  const bonus = minutes <= 0 ? idleRecoveryBonus : 0;
  return perDay * Math.max(0, restDays) + bonus;
}

export function updateAfterMatch(input: ProgressionInput): ProgressionResult {
  const config = input.config ?? DEFAULT_CONFIG;
  const report = input.side === 'local' ? input.result.home : input.result.away;
  const goalsFor = input.side === 'local' ? input.result.score.home : input.result.score.away;
  const goalsAgainst = input.side === 'local' ? input.result.score.away : input.result.score.home;
  const outcome = goalsFor > goalsAgainst ? 'victoria' : goalsFor === goalsAgainst ? 'empate' : 'derrota';
  const restDays = input.restDays ?? 4;
  const staff = input.staff ?? NO_STAFF_EFFECTS;
  const notes: string[] = [];
  const injuries: InjuryReport[] = [];
  const suspensions: { playerId: string; playerName: string; matches: number }[] = [];

  const statsById = new Map<string, PlayerMatchStats>();
  for (const line of report.players) statsById.set(line.player.id, line);

  const teamMoraleShift = outcome === 'victoria' ? 6 : outcome === 'empate' ? 0 : -6;
  const tableShift = (input.tableMood ?? 0) * 3;
  const contractShift = ((input.contractMood ?? 65) - 65) / 10;

  const players = input.team.players.map((player): Player => {
    const line = statsById.get(player.id);
    const minutes = line?.minutesPlayed ?? 0;

    // --- Fatiga (seccion 37) ---
    const fatigue = clamp(
      player.condition.fatigue +
        fatigueFromMinutes(player, line?.position ?? player.position, minutes, config) -
        recovery(player, restDays, minutes, staff.recovery, config),
      0,
      100,
    );

    // --- Forma: se mueve hacia el rendimiento reciente (seccion 36) ---
    let form = player.condition.form;
    if (line && minutes >= 20) {
      // Nota 6.2 es rendimiento normal: por encima sube, por debajo baja.
      const target = clamp(50 + (line.rating - config.ratings.base) * 12, 5, 99);
      const inertia = clamp(minutes / 90, 0.25, 1) * 0.45;
      form = clamp(form + (target - form) * inertia, 1, 100);
    } else if (minutes === 0) {
      // El que no juega pierde ritmo de a poco.
      form = clamp(form - 1.5, 1, 100);
    }

    // --- Moral (seccion 35) ---
    let moraleShift = teamMoraleShift + tableShift + contractShift;
    if (line && minutes >= 60) moraleShift += 2;
    else if (minutes === 0) moraleShift -= 2.5;
    if (line) {
      moraleShift += (line.rating - config.ratings.base) * 1.8;
      if (line.goals > 0) moraleShift += 2 * line.goals;
      if (line.redCard) moraleShift -= 4;
    }
    // El psicologo deportivo ayuda a levantar la moral, no a blindarla: el
    // efecto se aplica a lo que sube, no a lo que baja (seccion 7).
    const moraleWithStaff = moraleShift > 0 ? moraleShift * (1 + staff.morale / 100) : moraleShift;
    const morale = approachLimit(player.condition.morale, moraleWithStaff);

    // --- Puesta a punto ---
    const sharpness = clamp(
      player.condition.sharpness + (minutes >= 45 ? 4 : minutes > 0 ? 1.5 : -2.5),
      20,
      100,
    );

    // --- Lesiones y sanciones (seccion 38) ---
    let injuryDaysRemaining = Math.max(0, player.injuryDaysRemaining - restDays);
    if (line?.injured) {
      const severity = drawInjury(player.id, input.result.seed, player.injuryProneness);
      const rawDays = injuryDays(severity, player.id, input.result.seed);
      // El medico acorta la recuperacion (seccion 7). Nunca por debajo de dos
      // dias: una lesion siempre saca del partido siguiente.
      const daysOut = Math.max(2, Math.round(rawDays * (1 - staff.injuryRecovery / 100)));
      injuryDaysRemaining = Math.max(injuryDaysRemaining, daysOut);
      injuries.push({ playerId: player.id, playerName: player.name, severity, daysOut });
      notes.push(`${player.name} se lesionó (${severity}): ${daysOut} días afuera`);
    }

    // La suspension se descuenta al jugar el partido, no al pasar los dias.
    let suspensionMatchesRemaining = player.suspensionMatchesRemaining;
    if (suspensionMatchesRemaining > 0) suspensionMatchesRemaining -= 1;
    if (line?.redCard) {
      // Roja directa: dos fechas. Doble amarilla: una.
      const matches = line.yellowCards >= 2 ? 1 : 2;
      suspensionMatchesRemaining += matches;
      suspensions.push({ playerId: player.id, playerName: player.name, matches });
      notes.push(`${player.name} fue expulsado: ${matches} ${matches === 1 ? 'fecha' : 'fechas'} de suspensión`);
    }

    return {
      ...player,
      condition: {
        form: Math.round(form),
        morale: Math.round(morale),
        fatigue: Math.round(fatigue),
        sharpness: Math.round(sharpness),
      },
      injuryDaysRemaining,
      suspensionMatchesRemaining,
    };
  });

  // --- Cohesion del equipo (seccion 39) ---
  const chemistryBefore = input.team.chemistry;
  const resultShift = outcome === 'victoria' ? 2 : outcome === 'empate' ? 0.5 : -1.5;
  const signingsShift = -(input.newSignings ?? 0) * 1.8;
  const lowMoraleCount = players.filter((p) => p.condition.morale < 35).length;
  const moraleShift = -lowMoraleCount * 0.6;
  // Mantener el mismo once hace crecer la cohesion.
  const starters = new Set(report.startingXI);
  const stability = report.players.filter((p) => p.wasStarter && starters.has(p.player.id)).length / 11;
  const stabilityShift = (stability - 0.8) * 3;

  // Las bajas (incorporaciones, mala moral) golpean de lleno; las subidas
  // cuestan cada vez mas a medida que el grupo ya esta acoplado.
  const chemistryGain = resultShift + stabilityShift;
  const chemistryLoss = signingsShift + moraleShift;
  const chemistryAfter = clamp(
    approachLimit(chemistryBefore, chemistryGain) + chemistryLoss,
    1,
    100,
  );

  return {
    team: { ...input.team, players, chemistry: Math.round(chemistryAfter) },
    chemistryBefore,
    chemistryAfter: Math.round(chemistryAfter),
    injuries,
    suspensions,
    notes,
  };
}

/**
 * Hace pasar el tiempo sin jugar: recupera fatiga y descuenta dias de lesion.
 * Sirve para parones, pretemporada o cuando el equipo no tiene partido.
 */
export function advanceDays(
  team: Team,
  days: number,
  staff: ProgressionStaffEffects = NO_STAFF_EFFECTS,
  config: EngineConfig = DEFAULT_CONFIG,
): Team {
  const players = team.players.map((player): Player => ({
    ...player,
    condition: {
      ...player.condition,
      fatigue: clamp(player.condition.fatigue - recovery(player, days, 0, staff.recovery, config), 0, 100),
      sharpness: clamp(player.condition.sharpness - days * 0.4, 20, 100),
    },
    injuryDaysRemaining: Math.max(0, player.injuryDaysRemaining - days),
  }));
  return { ...team, players };
}

/** Cuantos jugadores tiene disponibles el equipo (seccion 48). */
export function availableCount(team: Team): number {
  return team.players.filter(isAvailable).length;
}
