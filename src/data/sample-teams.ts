/**
 * Equipos de ejemplo.
 *
 * Planteles de prueba para la demo y los tests. Los jugadores son ficticios.
 * Cada uno se define con su puesto, su nivel general y los rasgos que lo
 * distinguen; el resto de los atributos sale del perfil del puesto.
 */

import { createPlayer, type Player } from '../domain/player.ts';
import type { PartialAttributes } from '../domain/attributes.ts';
import type { Position } from '../domain/positions.ts';
import { createTactics } from '../domain/tactics.ts';
import { createTeam, type Team } from '../domain/team.ts';
import { attributesFor } from './squad-builder.ts';

type SamplePlayer = {
  readonly id: string;
  readonly name: string;
  readonly position: Position;
  readonly level: number;
  readonly age: number;
  readonly traits?: PartialAttributes;
  readonly secondary?: readonly Position[];
  readonly experience?: number;
  readonly consistency?: number;
  readonly form?: number;
  readonly morale?: number;
  readonly fatigue?: number;
};

function build(entries: readonly SamplePlayer[]): Player[] {
  return entries.map((entry) =>
    createPlayer({
      id: entry.id,
      name: entry.name,
      position: entry.position,
      age: entry.age,
      attributes: attributesFor(entry.position, entry.level, entry.traits ?? {}),
      secondaryPositions: entry.secondary ?? [],
      experience: entry.experience ?? undefined,
      consistency: entry.consistency ?? 65,
      condition: {
        form: entry.form ?? 62,
        morale: entry.morale ?? 68,
        fatigue: entry.fatigue ?? 12,
        sharpness: 88,
      },
    } as Parameters<typeof createPlayer>[0]),
  );
}

const RIVER_PLAYERS: readonly SamplePlayer[] = [
  { id: 'riv-1', name: 'Maximiliano Ibarra', position: 'POR', level: 84, age: 30, traits: { reflejos: 88, manos: 86, achique: 82, concentracion: 84 }, experience: 78 },
  { id: 'riv-2', name: 'Lucas Peralta', position: 'LD', level: 80, age: 27, traits: { centros: 84, resistencia: 87 }, secondary: ['ED'] },
  { id: 'riv-3', name: 'Emiliano Racedo', position: 'DFC', level: 83, age: 29, traits: { marcaje: 86, juegoAereo: 87, concentracion: 84 }, experience: 76 },
  { id: 'riv-4', name: 'Nahuel Sosa', position: 'DFC', level: 81, age: 24, traits: { velocidad: 80, quite: 83 } },
  { id: 'riv-5', name: 'Tomás Vidal', position: 'LI', level: 79, age: 26, traits: { velocidad: 85, centros: 81 }, secondary: ['EI'] },
  { id: 'riv-6', name: 'Julián Correa', position: 'MCD', level: 82, age: 31, traits: { quite: 87, posicionamiento: 86, paseCorto: 82 }, experience: 85, consistency: 78 },
  { id: 'riv-7', name: 'Miguel Fernández', position: 'MC', level: 84, age: 28, traits: { vision: 90, paseCorto: 89, tecnica: 86, decisiones: 87 }, consistency: 80 },
  { id: 'riv-8', name: 'Bruno Aguirre', position: 'MC', level: 79, age: 22, traits: { resistencia: 86, trabajoEquipo: 84 }, consistency: 48 },
  { id: 'riv-9', name: 'Facundo Rivas', position: 'ED', level: 83, age: 25, traits: { regate: 88, velocidad: 89, centros: 84 } },
  { id: 'riv-10', name: 'Gonzalo Arriaga', position: 'DC', level: 87, age: 27, traits: { definicion: 92, posicionamiento: 90, remate: 86, penales: 86 }, consistency: 76 },
  { id: 'riv-11', name: 'Iván Mendoza', position: 'EI', level: 81, age: 23, traits: { regate: 86, aceleracion: 88 }, consistency: 52 },
  // Banco
  { id: 'riv-12', name: 'Ramiro Quiroga', position: 'POR', level: 74, age: 25 },
  { id: 'riv-13', name: 'Alan Bustos', position: 'DFC', level: 76, age: 32, secondary: ['MCD'], experience: 84 },
  { id: 'riv-14', name: 'Santiago Coria', position: 'LI', level: 74, age: 21 },
  { id: 'riv-15', name: 'Matías Vera', position: 'MCD', level: 76, age: 29, secondary: ['MC'] },
  { id: 'riv-16', name: 'Diego Alcaraz', position: 'MCO', level: 78, age: 24, traits: { vision: 84, tirosLibres: 86 }, secondary: ['MC', 'SD'] },
  { id: 'riv-17', name: 'Pedro Salas', position: 'ED', level: 75, age: 20, secondary: ['EI'], consistency: 40 },
  { id: 'riv-18', name: 'Hernán Ledesma', position: 'DC', level: 77, age: 33, traits: { juegoAereo: 85, fuerza: 84 }, experience: 90 },
];

const RACING_PLAYERS: readonly SamplePlayer[] = [
  { id: 'rac-1', name: 'Federico Ojeda', position: 'POR', level: 80, age: 33, traits: { reflejos: 83, manos: 82 }, experience: 88 },
  { id: 'rac-2', name: 'Marcos Duarte', position: 'LD', level: 77, age: 25, traits: { velocidad: 84 } },
  { id: 'rac-3', name: 'Leandro Páez', position: 'DFC', level: 81, age: 28, traits: { marcaje: 85, fuerza: 86, juegoAereo: 85 } },
  { id: 'rac-4', name: 'Cristian Molina', position: 'DFC', level: 78, age: 30, traits: { concentracion: 82 } },
  { id: 'rac-5', name: 'Ezequiel Ferrer', position: 'LI', level: 76, age: 23, traits: { resistencia: 85 } },
  { id: 'rac-6', name: 'Rodrigo Iriarte', position: 'MCD', level: 79, age: 29, traits: { quite: 84, agresividad: 80 } },
  { id: 'rac-7', name: 'Sebastián Ayala', position: 'MC', level: 78, age: 26, traits: { paseCorto: 83, resistencia: 84 } },
  { id: 'rac-8', name: 'Franco Bazán', position: 'MCO', level: 82, age: 24, traits: { vision: 86, regate: 85, tecnica: 86, tirosLibres: 84 }, consistency: 58 },
  { id: 'rac-9', name: 'Nicolás Roldán', position: 'ED', level: 79, age: 27, traits: { velocidad: 88, aceleracion: 88 } },
  { id: 'rac-10', name: 'Damián Sarmiento', position: 'DC', level: 82, age: 31, traits: { definicion: 86, posicionamiento: 85, juegoAereo: 84 }, experience: 82 },
  { id: 'rac-11', name: 'Lautaro Benítez', position: 'EI', level: 77, age: 22, traits: { regate: 84 }, consistency: 45 },
  // Banco
  { id: 'rac-12', name: 'Gustavo Miranda', position: 'POR', level: 70, age: 28 },
  { id: 'rac-13', name: 'Joaquín Ríos', position: 'DFC', level: 73, age: 24 },
  { id: 'rac-14', name: 'Elías Cabrera', position: 'LD', level: 72, age: 31, secondary: ['LI'] },
  { id: 'rac-15', name: 'Braian Ocampo', position: 'MC', level: 74, age: 26, secondary: ['MCD'] },
  { id: 'rac-16', name: 'Thiago Navarro', position: 'MC', level: 72, age: 19, consistency: 38 },
  { id: 'rac-17', name: 'Agustín Leiva', position: 'EI', level: 73, age: 25, secondary: ['ED'] },
  { id: 'rac-18', name: 'Walter Godoy', position: 'DC', level: 75, age: 29 },
];

/** River Plate: buen mediocampo y un 9 decisivo, juega a presionar y atacar. */
export function riverPlate(): Team {
  return createTeam({
    id: 'river',
    name: 'River Plate',
    shortName: 'RIV',
    players: build(RIVER_PLAYERS),
    chemistry: 74,
    reputation: 88,
    tactics: createTactics({
      formationId: '4-3-3',
      mentality: 'ofensiva',
      pressing: 'alta',
      defensiveLine: 'alta',
      tempo: 'rapido',
      passingStyle: 'posesion',
      attackFocus: 'bandas',
      width: 'ancho',
      aggression: 'media',
    }),
    setPieceTakers: { penales: 'riv-10', tirosLibres: 'riv-7', corners: 'riv-9' },
  });
}

/** Racing Club: bloque medio-bajo, sale de contra y tiene un 10 desequilibrante. */
export function racingClub(): Team {
  return createTeam({
    id: 'racing',
    name: 'Racing Club',
    shortName: 'RAC',
    players: build(RACING_PLAYERS),
    chemistry: 68,
    reputation: 82,
    tactics: createTactics({
      formationId: '4-4-2',
      mentality: 'defensiva',
      pressing: 'baja',
      defensiveLine: 'baja',
      tempo: 'equilibrado',
      passingStyle: 'directo',
      attackFocus: 'mixto',
      width: 'estrecho',
      aggression: 'alta',
      counterAttack: true,
    }),
    setPieceTakers: { penales: 'rac-10', tirosLibres: 'rac-8', corners: 'rac-8' },
    instructions: [
      {
        minute: 60,
        when: 'perdiendo',
        changes: { mentality: 'ofensiva', pressing: 'alta', defensiveLine: 'media' },
        label: 'Racing Club pasa a una táctica ofensiva porque va perdiendo',
      },
      {
        minute: 75,
        when: 'ganando',
        changes: { mentality: 'muy defensiva', tempo: 'lento' },
        label: 'Racing Club se repliega para cuidar la ventaja',
      },
    ],
  });
}

/** Cruce de ejemplo listo para simular. */
export function sampleFixture(): { home: Team; away: Team } {
  return { home: riverPlate(), away: racingClub() };
}
