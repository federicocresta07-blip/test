/**
 * LAS INFERIORES DEL CLUB (secciones 7, 8, 19 — fase 4).
 *
 * La camada se genera de forma determinista a partir del nivel de la academia
 * juvenil: cuantos suben y con que techo lo decide la instalacion, como dice
 * la seccion 8. Con una academia de dos estrellas salen cuatro pibes con
 * potencial medio 62; con cinco, seis y con techos mas altos.
 *
 * El potencial que se genera es el REAL. Lo que la pantalla muestra es el
 * informe del ojeador, que es un rango: eso se calcula en `domain/youth.ts` y
 * su ancho sale del efecto del ojeador juvenil.
 */

import { createPlayer, defaultPotential, type Player } from '../../domain/player.ts';
import type { Position } from '../../domain/positions.ts';
import { attributesFor } from '../../data/squad-builder.ts';
import { Rng } from '../../core/rng.ts';
import { clamp } from '../../core/math.ts';
import { intakeShape, YOUTH_POSITIONS, type YouthPlayer } from '../../domain/youth.ts';
import { uniqueNames } from './names.ts';

/** De donde salen los juveniles. Da contexto a la decision de firmarlos. */
const ORIGINS: readonly string[] = [
  'de la séptima del club',
  'captado en un torneo de Santa Fe',
  'llegó de un club de barrio de La Matanza',
  'lo trajo el ojeador desde Entre Ríos',
  'de la pensión, llegó de Corrientes',
  'hijo de un exjugador del club',
  'venía de una escuelita de Mendoza',
  'lo vieron en un torneo de Tucumán',
  'de la octava, nunca jugó en otro club',
  'llegó a prueba desde Chaco y se quedó',
];

/**
 * La camada de inferiores del club.
 *
 * Determinista: el mismo club con la misma academia tiene siempre los mismos
 * juveniles. El nivel de la academia cambia la camada entera, asi que mejorar
 * la instalacion se ve de una temporada a la otra.
 */
export function buildYouthSquad(
  clubId: string,
  academyLevel: number,
  seed = 'camada-2026',
  /**
   * Cuantos anios lleva esta camada en el club (fase 6).
   *
   * Al cerrar la temporada los juveniles cumplen anios. En lugar de guardar la
   * edad de cada uno, la camada se vuelve a generar igual y se le suman los
   * anios transcurridos: el pibe es el mismo, un anio mas grande. El que pasa
   * de `YOUTH_MAX_AGE` deja de estar en la lista, que es la consecuencia de no
   * haberlo subido.
   */
  yearsElapsed = 0,
): readonly YouthPlayer[] {
  const shape = intakeShape(academyLevel);
  const rng = new Rng(`${seed}:${clubId}:${academyLevel}`);
  const names = uniqueNames(shape.count, `juveniles:${clubId}:${academyLevel}:${seed}`);

  return Array.from({ length: shape.count }, (_, index) => {
    const position = YOUTH_POSITIONS[rng.int(YOUTH_POSITIONS.length)] as Position;
    const bornAge = rng.intBetween(15, 19);
    const age = bornAge + yearsElapsed;

    // El potencial es el techo real. Sale de la camada, no de la edad: un pibe
    // de 15 y otro de 19 pueden tener el mismo techo, y el de 15 tiene mas
    // tiempo para llegar.
    const potential = clamp(
      Math.round(rng.boundedNormal(shape.potentialMean, shape.potentialSpread, 2)),
      40,
      95,
    );

    // El nivel de hoy: lejos de su techo, y mas lejos cuanto mas chico es.
    const gap = clamp(Math.round(rng.boundedNormal(20 - (bornAge - 15) * 2.5, 4, 2)), 4, 30);
    const overall = clamp(potential - gap, 30, 80);

    const player: Player = createPlayer({
      id: `${clubId}-juv-${seed}-${index + 1}`,
      name: names[index] as string,
      position,
      age,
      potential,
      attributes: attributesFor(position, overall),
      // Un juvenil no tiene experiencia de primera, y eso lo castiga en los
      // partidos importantes (seccion 40).
      experience: clamp(Math.round((age - 14) * 4 + rng.normal(0, 4)), 3, 30),
      condition: {
        form: clamp(Math.round(rng.normal(58, 10)), 20, 90),
        morale: clamp(Math.round(rng.normal(70, 10)), 30, 95),
        fatigue: clamp(Math.round(rng.normal(8, 5)), 0, 30),
        sharpness: clamp(Math.round(rng.normal(78, 8)), 45, 100),
      },
    });

    return {
      player,
      origin: ORIGINS[rng.int(ORIGINS.length)] as string,
      yearsAtClub: clamp(rng.intBetween(0, bornAge - 13) + yearsElapsed, 0, 8),
    };
  });
}

/** Comprobacion util para los tests y el desarrollo: el techo real de la camada. */
export function truePotentials(youth: readonly YouthPlayer[]): readonly number[] {
  return youth.map((entry) => entry.player.potential);
}

export { defaultPotential };
