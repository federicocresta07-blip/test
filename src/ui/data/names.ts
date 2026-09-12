/**
 * NOMBRES INVENTADOS PARA LOS PLANTELES DE DEMOSTRACION (seccion 19).
 *
 * El documento pide no usar nombres de futbolistas reales. Estos se arman
 * combinando nombres y apellidos comunes en la Argentina, de forma
 * determinista: el mismo club y el mismo puesto dan siempre el mismo nombre,
 * asi que el goleador del torneo no cambia de identidad al recargar.
 *
 * Quedan afuera a proposito los apellidos que identifican a un futbolista
 * concreto y famoso. El objetivo es que suenen argentinos, no que suenen
 * conocidos.
 */

import { Rng } from '../../core/rng.ts';

const GIVEN: readonly string[] = [
  'Agustín', 'Alan', 'Alexis', 'Ariel', 'Bautista', 'Benjamín', 'Braian',
  'Brian', 'Camilo', 'Cristian', 'Damián', 'Dante', 'Dylan', 'Elías',
  'Emanuel', 'Enzo', 'Ezequiel', 'Facundo', 'Federico', 'Felipe', 'Franco',
  'Gastón', 'Gonzalo', 'Ignacio', 'Iván', 'Joaquín', 'Jonatan', 'Julián',
  'Kevin', 'Lautaro', 'Leandro', 'Lucas', 'Luciano', 'Maximiliano', 'Mateo',
  'Matías', 'Nahuel', 'Nicolás', 'Octavio', 'Pablo', 'Ramiro', 'Rodrigo',
  'Santiago', 'Sebastián', 'Thiago', 'Tomás', 'Valentín', 'Walter',
];

const SURNAME: readonly string[] = [
  'Acuña', 'Aguirre', 'Alcaraz', 'Almada', 'Álvarez', 'Arriaga', 'Ávalos',
  'Barrios', 'Benítez', 'Bustos', 'Cáceres', 'Calderón', 'Cardozo',
  'Carrizo', 'Ceballos', 'Cordero', 'Correa', 'Coronel', 'Duarte', 'Escalante',
  'Espinoza', 'Falcón', 'Ferreyra', 'Figueroa', 'Franco', 'Gaitán', 'Galván',
  'Garay', 'Godoy', 'Herrera', 'Ibarra', 'Juárez', 'Ledesma', 'Leguizamón',
  'Lescano', 'Maidana', 'Mansilla', 'Medina', 'Méndez', 'Miranda', 'Molina',
  'Monzón', 'Morales', 'Moyano', 'Nieva', 'Ojeda', 'Olivera', 'Paredes',
  'Peralta', 'Pereyra', 'Quiroga', 'Ramallo', 'Recalde', 'Ríos', 'Rivero',
  'Roldán', 'Romero', 'Salvatierra', 'Sandoval', 'Sarmiento', 'Sosa',
  'Suárez', 'Tapia', 'Toledo', 'Torres', 'Valdez', 'Vega', 'Velázquez',
  'Villalba', 'Zárate', 'Zalazar',
];

/**
 * Un nombre estable para un jugador generado.
 *
 * Lleva la semilla del club adentro, asi que dos clubes no comparten el mismo
 * plantel de nombres. Los repetidos dentro de un club se evitan en
 * `uniqueNames`, que es donde importa.
 */
export function inventedName(seed: string): string {
  const rng = new Rng(seed);
  const given = GIVEN[rng.int(GIVEN.length)] as string;
  const surname = SURNAME[rng.int(SURNAME.length)] as string;
  return `${given} ${surname}`;
}

/**
 * Una lista de nombres distintos entre si.
 *
 * Dos jugadores del mismo club con el mismo nombre y apellido confunden en la
 * alineacion y en la tabla de goleadores, asi que si sale repetido se vuelve
 * a sortear con otra semilla hasta que no choque.
 */
export function uniqueNames(count: number, seed: string): readonly string[] {
  const used = new Set<string>();
  const names: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let attempt = 0;
    let name = inventedName(`${seed}:${index}`);
    while (used.has(name) && attempt < 40) {
      attempt += 1;
      name = inventedName(`${seed}:${index}:${attempt}`);
    }
    used.add(name);
    names.push(name);
  }
  return names;
}
