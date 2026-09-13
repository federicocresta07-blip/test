/**
 * Equipo: plantel, tactica, cohesion y designados de balon parado
 * (secciones 39, 46, 47, 48).
 */

import { clamp } from '../core/math.ts';
import type { Player } from './player.ts';
import { isAvailable } from './player.ts';
import { DEFAULT_TACTICS, type Tactics } from './tactics.ts';

/** Ejecutores designados (seccion 46). Son ids de jugador. */
export type SetPieceTakers = {
  readonly penales?: string;
  readonly tirosLibres?: string;
  readonly corners?: string;
};

/**
 * Instrucciones condicionales (seccion 47).
 * Ejemplo: "si voy perdiendo al minuto 60, pasar a tactica ofensiva".
 */
export type ConditionalInstruction = {
  readonly minute: number;
  readonly when: 'perdiendo' | 'ganando' | 'empatando' | 'siempre';
  readonly changes: Partial<Tactics>;
  readonly label?: string;
};

export type Team = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly players: readonly Player[];
  readonly tactics: Tactics;
  /** Cohesion del plantel 1..100 (seccion 39). */
  readonly chemistry: number;
  /** Reputacion 1..100: solo informativa para el resto del juego. */
  readonly reputation: number;
  /**
   * TRABAJO PREVENTIVO DEL CUERPO MEDICO, 0..100 (seccion 38, fase 8).
   *
   * Reduce el riesgo de que un jugador de este equipo se lesione durante el
   * partido. Es una propiedad del CLUB, como la cohesion: dos equipos con los
   * mismos jugadores y distinto fisioterapeuta no se lesionan igual.
   *
   * Existe porque el fisioterapeuta prometia "reduccion del riesgo de lesion
   * durante el partido" y no lo hacia: el motor tomaba el riesgo de su
   * configuracion global, igual para los veinte clubes, asi que mejorarlo no
   * movia nada. Era el ultimo rol del cuerpo tecnico que declaraba
   * `pendiente`.
   */
  readonly injuryPrevention: number;
  readonly setPieceTakers: SetPieceTakers;
  readonly instructions: readonly ConditionalInstruction[];
};

export type TeamInput = {
  readonly id: string;
  readonly name: string;
  readonly players: readonly Player[];
  readonly shortName?: string;
  readonly tactics?: Tactics;
  readonly chemistry?: number;
  readonly reputation?: number;
  readonly injuryPrevention?: number;
  readonly setPieceTakers?: SetPieceTakers;
  readonly instructions?: readonly ConditionalInstruction[];
};

export function createTeam(input: TeamInput): Team {
  return {
    id: input.id,
    name: input.name,
    shortName: input.shortName ?? input.name.slice(0, 3).toUpperCase(),
    players: input.players,
    tactics: input.tactics ?? DEFAULT_TACTICS,
    chemistry: clamp(input.chemistry ?? 60, 1, 100),
    reputation: clamp(input.reputation ?? 60, 1, 100),
    // Por defecto CERO: un club sin fisioterapeuta no previene nada, y el
    // riesgo base del motor es el de un equipo sin trabajo preventivo. Si el
    // defecto fuera un valor medio, contratar a uno restaria en lugar de
    // sumar en la mitad de los casos.
    injuryPrevention: clamp(input.injuryPrevention ?? 0, 0, 100),
    setPieceTakers: input.setPieceTakers ?? {},
    instructions: input.instructions ?? [],
  };
}

export function availablePlayers(team: Team): Player[] {
  return team.players.filter(isAvailable);
}

export function findPlayer(team: Team, playerId: string | undefined): Player | undefined {
  if (!playerId) return undefined;
  return team.players.find((p) => p.id === playerId);
}

/** Copia del equipo con otra tactica (sin mutar el original). */
export function withTactics(team: Team, tactics: Tactics): Team {
  return { ...team, tactics };
}
