/**
 * Jugador: atributos + estado (secciones 25, 35, 36, 37, 38, 40).
 */

import {
  buildAttributes,
  type Attributes,
  type PartialAttributes,
} from './attributes.ts';
import { clamp } from '../core/math.ts';
import { overallForPosition } from '../ratings/overall.ts';
import type { Position } from './positions.ts';

/** Etiquetas de forma visibles para el usuario (seccion 36). */
export const FORM_LABELS = [
  'Muy mala',
  'Mala',
  'Normal',
  'Buena',
  'Muy buena',
  'Excelente',
] as const;

export type FormLabel = (typeof FORM_LABELS)[number];

/** Estado del jugador. Internamente todo es numerico; la etiqueta es presentacion. */
export type PlayerCondition = {
  /** Forma: rendimiento reciente, 1..100 (seccion 36). */
  readonly form: number;
  /** Moral, 1..100 (seccion 35). */
  readonly morale: number;
  /** Fatiga acumulada, 0 (fresco) .. 100 (fundido) (seccion 37). */
  readonly fatigue: number;
  /** Puesta a punto / ritmo de competencia, 1..100. */
  readonly sharpness: number;
};

export type Player = {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  /** Posicion principal. */
  readonly position: Position;
  /** Posiciones secundarias: las juega casi sin penalizacion (seccion 26). */
  readonly secondaryPositions: readonly Position[];
  readonly attributes: Attributes;
  readonly condition: PlayerCondition;
  /** Experiencia 1..100: consistencia y respuesta en partidos grandes (seccion 40). */
  readonly experience: number;
  /** Consistencia 1..100: a mayor valor, menor variacion entre partidos. */
  readonly consistency: number;
  /** Potencial 1..100 (informativo para el resto del juego). */
  readonly potential: number;
  /** Propension a lesionarse 1..100 (seccion 38). */
  readonly injuryProneness: number;
  readonly preferredFoot: 'izquierdo' | 'derecho' | 'ambos';
  /** Dias que le faltan para volver de una lesion, 0 si esta sano (seccion 38). */
  readonly injuryDaysRemaining: number;
  /** Partidos de suspension que le quedan por cumplir, 0 si esta habilitado. */
  readonly suspensionMatchesRemaining: number;
};

export type PlayerInput = {
  readonly id: string;
  readonly name: string;
  readonly position: Position;
  readonly attributes: PartialAttributes;
  readonly age?: number;
  readonly secondaryPositions?: readonly Position[];
  readonly condition?: Partial<PlayerCondition>;
  readonly experience?: number;
  readonly consistency?: number;
  readonly potential?: number;
  readonly injuryProneness?: number;
  readonly preferredFoot?: 'izquierdo' | 'derecho' | 'ambos';
  /** Atajo: `true` lo deja lesionado dos semanas. */
  readonly injured?: boolean;
  readonly injuryDaysRemaining?: number;
  /** Atajo: `true` le da un partido de suspension. */
  readonly suspended?: boolean;
  readonly suspensionMatchesRemaining?: number;
};

export const DEFAULT_CONDITION: PlayerCondition = {
  form: 55,
  morale: 60,
  fatigue: 10,
  sharpness: 85,
};

/** Crea un jugador completando todo lo que no se especifique. */
export function createPlayer(input: PlayerInput): Player {
  const isGk = input.position === 'POR';
  const age = input.age ?? 25;
  return {
    id: input.id,
    name: input.name,
    age,
    position: input.position,
    secondaryPositions: input.secondaryPositions ?? [],
    attributes: buildAttributes(input.attributes, isGk),
    condition: {
      form: clamp(input.condition?.form ?? DEFAULT_CONDITION.form, 1, 100),
      morale: clamp(input.condition?.morale ?? DEFAULT_CONDITION.morale, 1, 100),
      fatigue: clamp(input.condition?.fatigue ?? DEFAULT_CONDITION.fatigue, 0, 100),
      sharpness: clamp(input.condition?.sharpness ?? DEFAULT_CONDITION.sharpness, 1, 100),
    },
    // Sin dato explicito, la experiencia crece con la edad.
    experience: clamp(input.experience ?? defaultExperienceForAge(age), 1, 100),
    consistency: clamp(input.consistency ?? 60, 1, 100),
    potential: clamp(input.potential ?? overallForPosition(buildAttributes(input.attributes, isGk), input.position), 1, 100),
    injuryProneness: clamp(input.injuryProneness ?? 40, 1, 100),
    preferredFoot: input.preferredFoot ?? 'derecho',
    injuryDaysRemaining: Math.max(
      0,
      input.injuryDaysRemaining ?? (input.injured ? DEFAULT_INJURY_DAYS : 0),
    ),
    suspensionMatchesRemaining: Math.max(
      0,
      input.suspensionMatchesRemaining ?? (input.suspended ? 1 : 0),
    ),
  };
}

/** Dias de baja cuando solo se dice "esta lesionado" sin precisar cuanto. */
export const DEFAULT_INJURY_DAYS = 14;

function defaultExperienceForAge(age: number): number {
  // 17 anios -> ~12 ; 25 -> ~55 ; 32+ -> ~90
  return clamp(Math.round((age - 16) * 5.4), 5, 95);
}

/** Overall del jugador en su posicion principal (seccion 25). */
export function playerOverall(player: Player): number {
  return overallForPosition(player.attributes, player.position);
}

/** Etiqueta de forma a partir del valor numerico (seccion 36). */
export function formLabel(form: number): FormLabel {
  if (form >= 88) return 'Excelente';
  if (form >= 74) return 'Muy buena';
  if (form >= 60) return 'Buena';
  if (form >= 44) return 'Normal';
  if (form >= 28) return 'Mala';
  return 'Muy mala';
}

/** Valor numerico representativo de una etiqueta de forma. */
export function formValue(label: FormLabel): number {
  switch (label) {
    case 'Excelente':
      return 93;
    case 'Muy buena':
      return 80;
    case 'Buena':
      return 66;
    case 'Normal':
      return 52;
    case 'Mala':
      return 36;
    case 'Muy mala':
      return 18;
  }
}

export function isInjured(player: Player): boolean {
  return player.injuryDaysRemaining > 0;
}

export function isSuspended(player: Player): boolean {
  return player.suspensionMatchesRemaining > 0;
}

/** Disponible para jugar (ni lesionado ni suspendido). */
export function isAvailable(player: Player): boolean {
  return !isInjured(player) && !isSuspended(player);
}

/** Condicion fisica visible 0..100 (inverso de la fatiga). */
export function physicalCondition(player: Player): number {
  return clamp(100 - player.condition.fatigue, 0, 100);
}
