/**
 * ESTADO DE PREPARACION DEL EQUIPO (seccion 5.2).
 *
 * Le dice al manager, de un vistazo, si puede irse tranquilo o si le falta
 * resolver algo antes del partido. Todo se deriva del estado actual.
 */

import { isInjured, isSuspended } from '../../domain/player.ts';
import type { GameState } from '../models/index.ts';
import { energyOf } from './ratings.ts';
import { suspensionRisk } from './engine-bridge.ts';

export type PreparationLevel = 'listo' | 'atencion' | 'incompleto';

export type Preparation = {
  readonly level: PreparationLevel;
  readonly headline: string;
  /** Cosas concretas por revisar, ya ordenadas por gravedad. */
  readonly issues: readonly string[];
};

export function preparationStatus(state: GameState): Preparation {
  const byId = new Map(state.squad.map((entry) => [entry.player.id, entry]));
  const starters = state.lineup.starters;
  const missing = starters.filter((id) => id === null).length;
  const issues: string[] = [];

  const picked = starters
    .filter((id): id is string => id !== null)
    .map((id) => byId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  const unavailable = picked.filter(
    (entry) => isInjured(entry.player) || isSuspended(entry.player),
  );
  const tired = picked.filter((entry) => energyOf(entry.player) < 72);
  const atRisk = picked.filter((entry) => suspensionRisk(entry));
  const noCaptain = state.lineup.roles.captainId === null;
  const captainOnPitch =
    state.lineup.roles.captainId !== null && starters.includes(state.lineup.roles.captainId);

  if (missing > 0) {
    issues.push(`${missing} ${missing === 1 ? 'puesto sin cubrir' : 'puestos sin cubrir'}`);
  }
  if (unavailable.length > 0) {
    issues.push(
      `${unavailable.length} ${unavailable.length === 1 ? 'titular no disponible' : 'titulares no disponibles'}: ${unavailable
        .map((entry) => entry.player.name)
        .join(', ')}`,
    );
  }
  if (tired.length > 0) {
    issues.push(
      `${tired.length} ${tired.length === 1 ? 'titular por debajo del 72% de energía' : 'titulares por debajo del 72% de energía'}`,
    );
  }
  if (atRisk.length > 0) {
    issues.push(`${atRisk.length} al límite de amarillas`);
  }
  if (noCaptain) {
    issues.push('Falta designar capitán');
  } else if (!captainOnPitch) {
    issues.push('El capitán designado no está entre los titulares');
  }
  if (state.lineup.bench.length < 5) {
    issues.push(`Solo ${state.lineup.bench.length} suplentes en el banco`);
  }

  if (missing > 0 || unavailable.length > 0) {
    return {
      level: 'incompleto',
      headline: 'La alineación necesita cambios antes del partido',
      issues,
    };
  }
  if (issues.length > 0) {
    return { level: 'atencion', headline: 'El equipo está armado, pero hay cosas para revisar', issues };
  }
  return { level: 'listo', headline: 'Equipo listo para jugar', issues };
}
