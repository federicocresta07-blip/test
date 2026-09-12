/**
 * Adecuacion tactica (seccion 27).
 *
 * Un jugador puede ser muy bueno y no encajar en lo que le pide el entrenador:
 * un DFC lento sufre con linea alta, un MC sin resistencia sufre presionando
 * noventa minutos, un delantero bajito no sirve para juego directo.
 *
 * Devuelve un valor 0..1 donde 0.5 es "encaja normal".
 */

import { clamp, mapRange } from '../core/math.ts';
import type { Attributes } from '../domain/attributes.ts';
import type { FormationSlot } from '../domain/formations.ts';
import type { Position } from '../domain/positions.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { TacticalProfile } from '../domain/tactics.ts';

export function evaluateTacticalFit(
  attributes: Attributes,
  assigned: Position,
  slot: FormationSlot,
  profile: TacticalProfile,
): number {
  const meta = POSITION_META[assigned];
  const demands: number[] = [];

  // Presion alta: exige resistencia, trabajo de equipo y agresividad.
  const pressingAbility = avg([
    attributes.resistencia,
    attributes.trabajoEquipo,
    attributes.agresividad,
    attributes.quite,
  ]);
  demands.push(demand(profile.pressing, pressingAbility));

  // Juego de posesion: exige pase corto, tecnica y control en todo el equipo.
  const possessionAbility = avg([attributes.paseCorto, attributes.tecnica, attributes.control]);
  demands.push(demand(1 - profile.directness, possessionAbility));

  // Juego directo: exige juego aereo, fuerza y pase largo (o velocidad arriba).
  const directAbility = meta.line === 'DEL'
    ? avg([attributes.juegoAereo, attributes.fuerza, attributes.velocidad])
    : avg([attributes.paseLargo, attributes.fuerza, attributes.juegoAereo]);
  demands.push(demand(profile.directness, directAbility));

  // Ritmo alto: exige resistencia y agilidad para sostenerlo.
  demands.push(demand(profile.tempo, avg([attributes.resistencia, attributes.agilidad, attributes.aceleracion])));

  // Linea alta: exige velocidad y concentracion a la ultima linea.
  if (meta.line === 'DEF' || assigned === 'MCD') {
    demands.push(
      demand(profile.defensiveLine, avg([attributes.velocidad, attributes.aceleracion, attributes.concentracion])),
    );
  }

  // Juego por bandas: exige centros y regate a los puestos anchos.
  if (meta.isWide) {
    demands.push(demand(profile.wingFocus, avg([attributes.centros, attributes.regate, attributes.velocidad])));
  }

  // Mucha tarea ofensiva y defensiva a la vez exige motor.
  const twoWayLoad = clamp(slot.attackDuty * slot.defenseDuty * 2, 0, 1);
  demands.push(demand(twoWayLoad, avg([attributes.resistencia, attributes.trabajoEquipo])));

  return clamp(avg(demands) , 0, 1);
}

/**
 * Cuanto encaja una capacidad con lo que exige la tactica.
 * Si la tactica no exige nada de esto (`intensity` bajo), el resultado es neutro.
 */
function demand(intensity: number, ability: number): number {
  const abilityScore = mapRange(ability, 35, 90, 0, 1);
  return 0.5 + (abilityScore - 0.5) * clamp(intensity, 0, 1);
}

function avg(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return values.length > 0 ? total / values.length : 50;
}
