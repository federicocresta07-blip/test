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

  // Presion alta: exige resistencia, agresividad y entradas.
  const pressingAbility = avg([
    attributes.resistencia,
    attributes.agresividad,
    attributes.entradas,
  ]);
  demands.push(demand(profile.pressing, pressingAbility));

  // Juego de posesion: exige pase y calidad en todo el equipo.
  const possessionAbility = avg([attributes.pase, attributes.calidad]);
  demands.push(demand(1 - profile.directness, possessionAbility));

  // Juego directo: arriba exige empuje y velocidad para pelear el pelotazo;
  // atras, pase largo y fisico para mandarlo. El archivo no separa el juego
  // aereo, asi que la agresividad hace ese papel.
  const directAbility = meta.line === 'DEL'
    ? avg([attributes.agresividad, attributes.remate, attributes.velocidad])
    : avg([attributes.pase, attributes.agresividad]);
  demands.push(demand(profile.directness, directAbility));

  // Ritmo alto: exige resistencia y velocidad para sostenerlo.
  demands.push(demand(profile.tempo, avg([attributes.resistencia, attributes.velocidad])));

  // Linea alta: exige velocidad y lectura a la ultima linea. La concentracion
  // era un atributo propio y ahora vive dentro de la calidad.
  if (meta.line === 'DEF' || assigned === 'MCD') {
    demands.push(
      demand(profile.defensiveLine, avg([attributes.velocidad, attributes.calidad])),
    );
  }

  // Juego por bandas: exige pase y regate a los puestos anchos. Los centros
  // eran un atributo propio y ahora viven dentro del pase.
  if (meta.isWide) {
    demands.push(demand(profile.wingFocus, avg([attributes.pase, attributes.regate, attributes.velocidad])));
  }

  // Mucha tarea ofensiva y defensiva a la vez exige motor.
  const twoWayLoad = clamp(slot.attackDuty * slot.defenseDuty * 2, 0, 1);
  demands.push(demand(twoWayLoad, avg([attributes.resistencia, attributes.calidad])));

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
