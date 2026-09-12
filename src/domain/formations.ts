/**
 * Formaciones (seccion 31).
 *
 * Una formacion hace dos cosas:
 *  1. define los once puestos y el reparto de tareas de cada uno
 *     (`attackDuty` / `defenseDuty`), que es lo que redistribuye la fuerza;
 *  2. aplica modificadores pequenios a las dimensiones del equipo.
 *
 * Regla de disenio: la suma de los modificadores de cada formacion es ~0.
 * Ninguna formacion es mejor que otra en absoluto; cambia el reparto.
 * El test `formations.test.ts` verifica esa suma.
 */

import type { DimensionModifiers } from './dimensions.ts';
import type { Position } from './positions.ts';

export type FormationSlot = {
  readonly position: Position;
  /** Cuanto participa el puesto en ataque, 0..1. */
  readonly attackDuty: number;
  /** Cuanto participa el puesto en defensa, 0..1. */
  readonly defenseDuty: number;
};

export type FormationTraits = {
  /** Amplitud estructural, 0 (muy estrecho) .. 1 (muy abierto). */
  readonly width: number;
  /** Cuanta gente llega al area rival, 0..1. */
  readonly boxPresence: number;
  /** Proteccion del area propia, 0..1. */
  readonly boxProtection: number;
  /** Facilidad estructural para presionar arriba, 0..1. */
  readonly pressingBias: number;
  /** Facilidad estructural para salir de contra, 0..1. */
  readonly counterBias: number;
};

export type Formation = {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly FormationSlot[];
  readonly modifiers: DimensionModifiers;
  readonly traits: FormationTraits;
};

const GK: FormationSlot = { position: 'POR', attackDuty: 0.02, defenseDuty: 1 };

function slot(position: Position, attackDuty: number, defenseDuty: number): FormationSlot {
  return { position, attackDuty, defenseDuty };
}

export const FORMATIONS: readonly Formation[] = [
  {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      GK,
      slot('LD', 0.35, 0.85),
      slot('DFC', 0.12, 1),
      slot('DFC', 0.12, 1),
      slot('LI', 0.35, 0.85),
      slot('ED', 0.6, 0.55),
      slot('MC', 0.45, 0.7),
      slot('MC', 0.5, 0.65),
      slot('EI', 0.6, 0.55),
      slot('DC', 0.95, 0.15),
      slot('DC', 0.95, 0.15),
    ],
    modifiers: {
      ataque: 1.5,
      balonParado: 1.5,
      fisico: 1,
      mediocampo: -2,
      creacion: -1.5,
      presion: -0.5,
    },
    traits: { width: 0.6, boxPresence: 0.7, boxProtection: 0.55, pressingBias: 0.45, counterBias: 0.5 },
  },
  {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      GK,
      slot('LD', 0.45, 0.8),
      slot('DFC', 0.12, 1),
      slot('DFC', 0.12, 1),
      slot('LI', 0.45, 0.8),
      slot('MCD', 0.25, 0.9),
      slot('MC', 0.55, 0.65),
      slot('MC', 0.6, 0.6),
      slot('ED', 0.85, 0.3),
      slot('DC', 0.95, 0.12),
      slot('EI', 0.85, 0.3),
    ],
    modifiers: {
      ataque: 2,
      presion: 2,
      creacion: 1.5,
      defensa: -2.5,
      contraataque: -1.5,
      balonParado: -1,
      fisico: -0.5,
    },
    traits: { width: 0.85, boxPresence: 0.6, boxProtection: 0.4, pressingBias: 0.8, counterBias: 0.45 },
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      GK,
      slot('LD', 0.4, 0.82),
      slot('DFC', 0.12, 1),
      slot('DFC', 0.12, 1),
      slot('LI', 0.4, 0.82),
      slot('MCD', 0.2, 0.95),
      slot('MCD', 0.3, 0.88),
      slot('ED', 0.8, 0.38),
      slot('MCO', 0.85, 0.35),
      slot('EI', 0.8, 0.38),
      slot('DC', 0.95, 0.12),
    ],
    modifiers: {
      creacion: 2.5,
      mediocampo: 1.5,
      defensa: 0.5,
      ataque: -1,
      fisico: -1,
      contraataque: -1,
      balonParado: -1.5,
    },
    traits: { width: 0.7, boxPresence: 0.5, boxProtection: 0.6, pressingBias: 0.65, counterBias: 0.55 },
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    slots: [
      GK,
      slot('LD', 0.35, 0.85),
      slot('DFC', 0.1, 1),
      slot('DFC', 0.1, 1),
      slot('LI', 0.35, 0.85),
      slot('MCD', 0.15, 1),
      slot('ED', 0.65, 0.55),
      slot('MC', 0.4, 0.75),
      slot('MC', 0.45, 0.72),
      slot('EI', 0.65, 0.55),
      slot('DC', 0.92, 0.15),
    ],
    modifiers: {
      defensa: 2,
      mediocampo: 2,
      presion: 0.5,
      ataque: -2.5,
      creacion: -1,
      contraataque: -0.5,
      balonParado: -0.5,
    },
    traits: { width: 0.65, boxPresence: 0.4, boxProtection: 0.75, pressingBias: 0.5, counterBias: 0.6 },
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      GK,
      slot('DFC', 0.12, 1),
      slot('DFC', 0.1, 1),
      slot('DFC', 0.12, 1),
      slot('LD', 0.6, 0.65),
      slot('MCD', 0.22, 0.92),
      slot('MC', 0.5, 0.7),
      slot('MCO', 0.75, 0.42),
      slot('LI', 0.6, 0.65),
      slot('DC', 0.92, 0.15),
      slot('SD', 0.9, 0.2),
    ],
    modifiers: {
      mediocampo: 3,
      creacion: 1,
      presion: 0.5,
      defensa: -0.5,
      ataque: -1,
      fisico: -1,
      contraataque: -1,
      balonParado: -1,
    },
    traits: { width: 0.75, boxPresence: 0.55, boxProtection: 0.6, pressingBias: 0.6, counterBias: 0.55 },
  },
  {
    id: '5-3-2',
    name: '5-3-2',
    slots: [
      GK,
      slot('LD', 0.4, 0.85),
      slot('DFC', 0.08, 1),
      slot('DFC', 0.08, 1),
      slot('DFC', 0.08, 1),
      slot('LI', 0.4, 0.85),
      slot('MCD', 0.2, 0.95),
      slot('MC', 0.45, 0.7),
      slot('MC', 0.5, 0.68),
      slot('DC', 0.92, 0.14),
      slot('SD', 0.88, 0.2),
    ],
    modifiers: {
      defensa: 3,
      contraataque: 2.5,
      fisico: 0.5,
      mediocampo: -2,
      creacion: -2,
      presion: -1.5,
      ataque: -0.5,
    },
    traits: { width: 0.6, boxPresence: 0.4, boxProtection: 0.9, pressingBias: 0.25, counterBias: 0.85 },
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    slots: [
      GK,
      slot('DFC', 0.14, 1),
      slot('DFC', 0.1, 1),
      slot('DFC', 0.14, 1),
      slot('LD', 0.65, 0.6),
      slot('MC', 0.5, 0.72),
      slot('MC', 0.55, 0.68),
      slot('LI', 0.65, 0.6),
      slot('ED', 0.88, 0.25),
      slot('DC', 0.95, 0.1),
      slot('EI', 0.88, 0.25),
    ],
    modifiers: {
      ataque: 3,
      presion: 2,
      creacion: 1,
      defensa: -3.5,
      contraataque: -1.5,
      balonParado: -0.5,
      fisico: -0.5,
    },
    traits: { width: 0.9, boxPresence: 0.7, boxProtection: 0.3, pressingBias: 0.85, counterBias: 0.35 },
  },
  {
    id: '4-5-1',
    name: '4-5-1',
    slots: [
      GK,
      slot('LD', 0.32, 0.88),
      slot('DFC', 0.1, 1),
      slot('DFC', 0.1, 1),
      slot('LI', 0.32, 0.88),
      slot('MCD', 0.15, 1),
      slot('MCD', 0.22, 0.92),
      slot('ED', 0.62, 0.58),
      slot('MC', 0.45, 0.72),
      slot('EI', 0.62, 0.58),
      slot('DC', 0.9, 0.18),
    ],
    modifiers: {
      mediocampo: 2.5,
      defensa: 2,
      contraataque: 0.5,
      ataque: -3.5,
      creacion: -1,
      balonParado: -0.5,
    },
    traits: { width: 0.7, boxPresence: 0.3, boxProtection: 0.8, pressingBias: 0.45, counterBias: 0.65 },
  },
];

const FORMATION_BY_ID = new Map(FORMATIONS.map((f) => [f.id, f]));

export function getFormation(id: string): Formation {
  const found = FORMATION_BY_ID.get(id);
  if (!found) {
    throw new Error(`Formacion desconocida: ${id}. Disponibles: ${FORMATIONS.map((f) => f.id).join(', ')}`);
  }
  return found;
}

export function formationIds(): string[] {
  return FORMATIONS.map((f) => f.id);
}
