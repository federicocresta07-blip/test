/**
 * CUANTO SE VE DE UN RIVAL (secciones 7, 13).
 *
 * El analista de rivales declara un "nivel de detalle del informe", de 1 a 5.
 * Este archivo es lo que hace que ese numero signifique algo: decide que
 * partes del perfil de un rival se muestran.
 *
 * Sin esto, la pantalla de rivales mostraba las nueve dimensiones siempre, con
 * analista o sin analista, y la ficha del profesional decia "todavia no se
 * aplica" prometiendo una fase que ya estaba entregada. Era una mentira chica
 * pero era una mentira.
 */

import type { StaffEffect } from '../../domain/staff.ts';

export type ScoutingDetail = {
  /** Nivel informado por el analista, 0 si el puesto esta vacante. */
  readonly level: number;
  /** La fuerza general del rival: se ve siempre. */
  readonly showsOverall: boolean;
  /** Las nueve dimensiones de fuerza. */
  readonly showsDimensions: boolean;
  /** El veredicto de fortalezas y debilidades. */
  readonly showsVerdict: boolean;
  /** El plantel completo del rival con sus overalls. */
  readonly showsSquad: boolean;
  /** Su formacion y su estilo de juego. */
  readonly showsTactics: boolean;
  /** Que falta y con que nivel de analista se destraba. */
  readonly missing: readonly string[];
};

/**
 * Que muestra el informe segun el nivel del analista.
 *
 * El reparto por nivel:
 *   sin analista -> posicion, forma y resultados. Lo que se ve en la tabla.
 *   nivel 1-2    -> + su formacion y su estilo
 *   nivel 3-4    -> + las nueve dimensiones y el veredicto
 *   nivel 5      -> + el plantel completo
 */
export function scoutingDetail(effect: StaffEffect | null): ScoutingDetail {
  const level = effect ? Math.round(effect.actual) : 0;
  const missing: string[] = [];

  if (level < 1) missing.push('Con un analista de rivales verías su formación y su estilo de juego.');
  if (level < 3) missing.push('Con nivel 3 de informe verías sus nueve dimensiones de fuerza y en qué es fuerte y flojo.');
  if (level < 5) missing.push('Con nivel 5 verías su plantel completo con el overall de cada jugador.');

  return {
    level,
    showsOverall: true,
    showsTactics: level >= 1,
    showsDimensions: level >= 3,
    showsVerdict: level >= 3,
    showsSquad: level >= 5,
    missing,
  };
}
