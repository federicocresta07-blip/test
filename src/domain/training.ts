/**
 * PLANES DE ENTRENAMIENTO (seccion 7 — fase 4 del plan).
 *
 * Un plan no da un bonus: reparte. Elegir "fisico" es elegir crecer mas rapido
 * en lo fisico y mas lento en lo tecnico, y por eso tiene sentido tener un plan
 * distinto por jugador.
 *
 * La otra mitad del modulo es el mapa de puestos a entrenadores. Los cuatro
 * entrenadores por linea de `domain/staff.ts` no cubren "el equipo": cada uno
 * cubre puestos concretos, y por eso mejorar al entrenador de arqueros no le
 * hace nada al 9. Sin este mapa, "velocidad de desarrollo de defensores" seria
 * otra vez una frase sin destinatario.
 */

import type { Position } from './positions.ts';
import type { StaffRole } from './staff.ts';
import type { TrainingFocus } from '../progression/development.ts';

/** El entrenador que trabaja con cada puesto. */
export function coachRoleFor(position: Position): StaffRole {
  switch (position) {
    case 'POR':
      return 'Entrenador de arqueros';
    case 'LD':
    case 'DFC':
    case 'LI':
      return 'Entrenador defensivo';
    case 'MCD':
    case 'MC':
    case 'MCO':
      return 'Entrenador de mediocampistas';
    case 'ED':
    case 'EI':
    case 'SD':
    case 'DC':
      return 'Entrenador ofensivo';
  }
}

/** El plan que le viene naturalmente a cada puesto, como punto de partida. */
export function defaultFocusFor(position: Position): TrainingFocus {
  switch (position) {
    case 'POR':
      return 'arquero';
    case 'LD':
    case 'DFC':
    case 'LI':
      return 'defensivo';
    case 'MCD':
      return 'defensivo';
    case 'MC':
    case 'MCO':
      return 'tecnica';
    case 'ED':
    case 'EI':
    case 'SD':
    case 'DC':
      return 'ofensivo';
  }
}

/**
 * El plan de entrenamiento del club.
 *
 * `intensity` sube el desarrollo de todos y no tiene contraparte en este
 * modulo: la paga la fatiga, que se resuelve en `after-match.ts`. Entrenar
 * fuerte con fechas de mitad de semana es una decision, no una mejora gratis.
 */
export type TrainingPlan = {
  /** Intensidad general del entrenamiento, 0..1. */
  readonly intensity: number;
  /** Plan del equipo, para el que no tiene uno propio. */
  readonly teamFocus: TrainingFocus | 'por puesto';
  /** Planes individuales, por id de jugador. */
  readonly individual: Readonly<Record<string, TrainingFocus>>;
};

export const DEFAULT_TRAINING_PLAN: TrainingPlan = {
  intensity: 0.6,
  // Por defecto cada uno entrena lo de su puesto, que es lo que haria
  // cualquier cuerpo tecnico antes de tocar nada.
  teamFocus: 'por puesto',
  individual: {},
};

/** El plan que le toca a un jugador: el propio, el del equipo o el del puesto. */
export function focusFor(
  plan: TrainingPlan,
  playerId: string,
  position: Position,
): TrainingFocus {
  const own = plan.individual[playerId];
  if (own) return own;
  if (plan.teamFocus === 'por puesto') return defaultFocusFor(position);
  return plan.teamFocus;
}

/** Cuantos jugadores tienen un plan propio, para mostrarlo en pantalla. */
export function individualCount(plan: TrainingPlan): number {
  return Object.keys(plan.individual).length;
}

export const INTENSITY_LABELS: readonly { value: number; label: string; note: string }[] = [
  { value: 0.25, label: 'Suave', note: 'Desarrolla menos, pero el plantel llega entero a la fecha.' },
  { value: 0.45, label: 'Moderada', note: 'Equilibrio entre desarrollo y frescura.' },
  { value: 0.6, label: 'Normal', note: 'Lo que hace un plantel profesional en una semana común.' },
  { value: 0.8, label: 'Alta', note: 'Desarrolla más rápido; con fechas seguidas se siente en las piernas.' },
  { value: 1, label: 'Máxima', note: 'Desarrollo al tope. Solo con una semana entera por delante.' },
];

export function intensityLabel(value: number): string {
  let closest = INTENSITY_LABELS[0] as { value: number; label: string };
  for (const entry of INTENSITY_LABELS) {
    if (Math.abs(entry.value - value) < Math.abs(closest.value - value)) closest = entry;
  }
  return closest.label;
}
