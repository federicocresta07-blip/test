/**
 * DATOS DE DEMOSTRACION — plantel (seccion 19).
 *
 * Los jugadores son INVENTADOS. No representan a futbolistas reales: el
 * documento pide explicitamente no inventar nombres reales y marcar los datos
 * demo como tales. Los atributos se generan con el mismo generador que usa el
 * motor, asi que son coherentes con la simulacion.
 */

import { createPlayer } from '../../domain/player.ts';
import type { Position } from '../../domain/positions.ts';
import { attributesFor } from '../../data/squad-builder.ts';
import type { ClubPlayer } from '../models/index.ts';
import type { PartialAttributes } from '../../domain/attributes.ts';

type SquadEntry = {
  readonly n: number;
  readonly name: string;
  readonly position: Position;
  readonly overall: number;
  readonly age: number;
  readonly traits?: PartialAttributes;
  readonly secondary?: readonly Position[];
  readonly form?: number;
  readonly morale?: number;
  readonly fatigue?: number;
  readonly sharpness?: number;
  readonly experience?: number;
  readonly consistency?: number;
  readonly value: number;
  readonly salary: number;
  readonly contractUntil: string;
  readonly nationality?: string;
  readonly yellowCards?: number;
  readonly injuryDays?: number;
  readonly suspensionMatches?: number;
  readonly unhappy?: boolean;
};

/** Plantel de 24 jugadores: once, banco y alternativas por puesto. */
const ENTRIES: readonly SquadEntry[] = [
  // --- Arqueros ---
  { n: 1, name: 'Maximiliano Ibarra', position: 'POR', overall: 84, age: 30, traits: { reflejos: 88, manos: 86, achique: 82, concentracion: 85 }, experience: 80, consistency: 78, form: 71, morale: 74, fatigue: 8, value: 9_200_000, salary: 5_400_000, contractUntil: '2027-06-30' },
  { n: 23, name: 'Ramiro Quiroga', position: 'POR', overall: 74, age: 24, form: 52, morale: 48, fatigue: 4, value: 2_100_000, salary: 1_500_000, contractUntil: '2026-06-30', unhappy: true },
  { n: 25, name: 'Bautista Leone', position: 'POR', overall: 62, age: 19, form: 55, morale: 66, fatigue: 2, value: 450_000, salary: 380_000, contractUntil: '2028-06-30' },

  // --- Defensores ---
  { n: 4, name: 'Lucas Peralta', position: 'LD', overall: 80, age: 27, traits: { centros: 84, resistencia: 88 }, secondary: ['ED'], form: 76, morale: 72, fatigue: 22, value: 6_800_000, salary: 4_100_000, contractUntil: '2027-12-31', yellowCards: 4 },
  { n: 2, name: 'Emiliano Racedo', position: 'DFC', overall: 83, age: 29, traits: { marcaje: 87, juegoAereo: 88, concentracion: 85 }, experience: 78, consistency: 80, form: 78, morale: 80, fatigue: 26, value: 8_100_000, salary: 4_800_000, contractUntil: '2026-12-31' },
  { n: 6, name: 'Nahuel Sosa', position: 'DFC', overall: 81, age: 24, traits: { velocidad: 82, quite: 84 }, form: 68, morale: 70, fatigue: 18, value: 7_400_000, salary: 3_600_000, contractUntil: '2028-06-30' },
  { n: 3, name: 'Tomás Vidal', position: 'LI', overall: 78, age: 26, traits: { velocidad: 86, centros: 82 }, secondary: ['EI'], form: 72, morale: 68, fatigue: 31, value: 5_200_000, salary: 3_200_000, contractUntil: '2026-06-30' },
  { n: 13, name: 'Alan Bustos', position: 'DFC', overall: 76, age: 32, secondary: ['MCD'], experience: 88, consistency: 82, form: 60, morale: 58, fatigue: 12, value: 2_400_000, salary: 3_000_000, contractUntil: '2026-06-30' },
  { n: 22, name: 'Santiago Coria', position: 'LI', overall: 73, age: 21, secondary: ['LD'], form: 64, morale: 72, fatigue: 6, value: 1_900_000, salary: 900_000, contractUntil: '2028-12-31' },
  { n: 26, name: 'Lisandro Ferreyra', position: 'DFC', overall: 70, age: 20, form: 58, morale: 64, fatigue: 4, value: 1_100_000, salary: 620_000, contractUntil: '2029-06-30' },
  { n: 18, name: 'Gastón Almada', position: 'LD', overall: 72, age: 28, form: 44, morale: 40, fatigue: 9, value: 1_400_000, salary: 1_900_000, contractUntil: '2026-06-30', unhappy: true },

  // --- Mediocampistas ---
  { n: 5, name: 'Julián Correa', position: 'MCD', overall: 82, age: 31, traits: { quite: 88, posicionamiento: 86, paseCorto: 83 }, experience: 88, consistency: 82, form: 74, morale: 76, fatigue: 34, value: 6_100_000, salary: 5_000_000, contractUntil: '2026-06-30', yellowCards: 5 },
  { n: 8, name: 'Miguel Fernández', position: 'MC', overall: 84, age: 28, traits: { vision: 90, paseCorto: 89, tecnica: 87, decisiones: 88 }, consistency: 84, form: 86, morale: 84, fatigue: 29, value: 11_500_000, salary: 6_200_000, contractUntil: '2028-06-30' },
  { n: 14, name: 'Bruno Aguirre', position: 'MC', overall: 79, age: 22, traits: { resistencia: 88, trabajoEquipo: 85 }, consistency: 48, form: 80, morale: 78, fatigue: 16, value: 6_400_000, salary: 2_400_000, contractUntil: '2029-06-30' },
  { n: 10, name: 'Diego Alcaraz', position: 'MCO', overall: 81, age: 25, traits: { vision: 86, tirosLibres: 88, regate: 84 }, secondary: ['MC', 'SD'], form: 66, morale: 62, fatigue: 20, value: 8_900_000, salary: 4_600_000, contractUntil: '2027-06-30' },
  { n: 16, name: 'Matías Vera', position: 'MCD', overall: 76, age: 29, secondary: ['MC'], form: 58, morale: 60, fatigue: 11, value: 2_700_000, salary: 2_600_000, contractUntil: '2026-12-31' },
  { n: 20, name: 'Thiago Navarro', position: 'MC', overall: 71, age: 19, consistency: 36, form: 70, morale: 80, fatigue: 5, value: 2_200_000, salary: 520_000, contractUntil: '2029-12-31' },
  { n: 27, name: 'Joaquín Benegas', position: 'MCO', overall: 68, age: 18, consistency: 32, form: 62, morale: 74, fatigue: 3, value: 1_300_000, salary: 400_000, contractUntil: '2029-12-31' },

  // --- Delanteros ---
  { n: 7, name: 'Facundo Rivas', position: 'ED', overall: 83, age: 25, traits: { regate: 88, velocidad: 90, centros: 84 }, secondary: ['EI'], form: 82, morale: 80, fatigue: 24, value: 13_200_000, salary: 5_800_000, contractUntil: '2027-12-31' },
  { n: 9, name: 'Gonzalo Arriaga', position: 'DC', overall: 87, age: 27, traits: { definicion: 92, posicionamiento: 90, remate: 87, penales: 88 }, consistency: 78, form: 90, morale: 88, fatigue: 30, value: 21_000_000, salary: 8_500_000, contractUntil: '2027-06-30' },
  { n: 11, name: 'Iván Mendoza', position: 'EI', overall: 81, age: 23, traits: { regate: 87, aceleracion: 89 }, secondary: ['ED'], consistency: 50, form: 58, morale: 64, fatigue: 19, value: 9_600_000, salary: 4_000_000, contractUntil: '2028-12-31' },
  { n: 19, name: 'Hernán Ledesma', position: 'DC', overall: 77, age: 33, traits: { juegoAereo: 86, fuerza: 85 }, experience: 92, consistency: 80, form: 62, morale: 56, fatigue: 10, value: 1_800_000, salary: 4_200_000, contractUntil: '2026-06-30' },
  { n: 21, name: 'Pedro Salas', position: 'ED', overall: 74, age: 20, secondary: ['EI'], consistency: 40, form: 74, morale: 76, fatigue: 7, value: 3_100_000, salary: 700_000, contractUntil: '2029-06-30' },
  { n: 28, name: 'Valentín Ocaña', position: 'SD', overall: 69, age: 18, consistency: 34, form: 68, morale: 72, fatigue: 2, value: 1_500_000, salary: 430_000, contractUntil: '2029-12-31' },

  // --- Bajas ---
  { n: 15, name: 'Rodrigo Cáceres', position: 'MC', overall: 78, age: 26, form: 70, morale: 44, fatigue: 14, value: 4_900_000, salary: 3_400_000, contractUntil: '2027-06-30', injuryDays: 23 },
  { n: 17, name: 'Ignacio Duarte', position: 'DFC', overall: 75, age: 27, form: 64, morale: 52, fatigue: 8, value: 3_200_000, salary: 2_800_000, contractUntil: '2026-12-31', suspensionMatches: 1, yellowCards: 0 },
];

export const DEMO_SQUAD: readonly ClubPlayer[] = ENTRIES.map((entry) => ({
  player: createPlayer({
    id: `riv-${entry.n}`,
    name: entry.name,
    position: entry.position,
    age: entry.age,
    attributes: attributesFor(entry.position, entry.overall, entry.traits ?? {}),
    secondaryPositions: entry.secondary ?? [],
    condition: {
      form: entry.form ?? 62,
      morale: entry.morale ?? 68,
      fatigue: entry.fatigue ?? 12,
      sharpness: entry.sharpness ?? 88,
    },
    ...(entry.experience !== undefined ? { experience: entry.experience } : {}),
    consistency: entry.consistency ?? 65,
    ...(entry.injuryDays !== undefined ? { injuryDaysRemaining: entry.injuryDays } : {}),
    ...(entry.suspensionMatches !== undefined
      ? { suspensionMatchesRemaining: entry.suspensionMatches }
      : {}),
  }),
  shirtNumber: entry.n,
  nationality: entry.nationality ?? 'ARG',
  value: entry.value,
  salary: entry.salary,
  contractUntil: entry.contractUntil,
  yellowCards: entry.yellowCards ?? 0,
  unhappy: entry.unhappy ?? false,
}));
