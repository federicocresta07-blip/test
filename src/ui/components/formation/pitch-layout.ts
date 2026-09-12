/**
 * DISPOSICION VISUAL DE LA CANCHA (seccion 6.3).
 *
 * Cuantos jugadores van en cada linea, del arco hacia adelante. Es una
 * decision de diseño y por eso vive en la UI, no en el motor: el motor define
 * los puestos y sus tareas, esto define como se leen en pantalla.
 *
 * El orden de los slots del motor ya va de arco a delantera, asi que las
 * filas se llenan en ese orden. `pitch-layout.test.ts` verifica que cada
 * formacion sume exactamente sus once puestos.
 */

import { getFormation, type FormationSlot } from '../../../domain/formations.ts';
import { POSITION_META } from '../../../domain/positions.ts';

export const FORMATION_ROWS: Readonly<Record<string, readonly number[]>> = {
  '4-4-2': [1, 4, 4, 2],
  '4-3-3': [1, 4, 3, 3],
  '4-2-3-1': [1, 4, 2, 3, 1],
  '4-3-1-2': [1, 4, 3, 1, 2],
  '4-1-4-1': [1, 4, 1, 4, 1],
  '3-5-2': [1, 3, 5, 2],
  '5-3-2': [1, 5, 3, 2],
  '3-4-3': [1, 3, 4, 3],
  '4-5-1': [1, 4, 5, 1],
};

export type PitchSlotLayout = {
  readonly slotIndex: number;
  readonly slot: FormationSlot;
  /** Posicion en la cancha, 0..1. x: izquierda a derecha. y: arco propio a rival. */
  readonly x: number;
  readonly y: number;
};

/**
 * Reparte los once puestos en la cancha.
 *
 * Las filas centrales se comprimen hacia el medio y las que tienen jugadores
 * de banda se abren: asi un mediocampo de tres no queda tan ancho como una
 * linea de tres delanteros.
 */
export function layoutFormation(formationId: string): readonly PitchSlotLayout[] {
  const slots = getFormation(formationId).slots;
  const rows = FORMATION_ROWS[formationId] ?? inferRows(slots);

  const layout: PitchSlotLayout[] = [];
  let cursor = 0;

  rows.forEach((count, rowIndex) => {
    const rowSlots = slots
      .slice(cursor, cursor + count)
      .map((slot, offset) => ({ slot, slotIndex: cursor + offset }));
    cursor += count;
    if (rowSlots.length === 0) return;

    // Dentro de la fila se ordena por amplitud: el zurdo a la izquierda.
    const ordered = [...rowSlots].sort(
      (a, b) =>
        POSITION_META[a.slot.position].width - POSITION_META[b.slot.position].width ||
        a.slotIndex - b.slotIndex,
    );

    // `spread` es la fraccion del ancho de la cancha que ocupa la fila: una
    // linea con laterales se abre casi entera, un mediocampo central se
    // comprime al medio.
    const maxWidth = Math.max(...ordered.map((item) => Math.abs(POSITION_META[item.slot.position].width)));
    const spread = 0.5 + maxWidth * 0.42;
    const y = rows.length > 1 ? rowIndex / (rows.length - 1) : 0.5;

    ordered.forEach((item, indexInRow) => {
      const t = ordered.length === 1 ? 0.5 : (indexInRow + 0.5) / ordered.length;
      layout.push({
        slotIndex: item.slotIndex,
        slot: item.slot,
        x: 0.5 + (t - 0.5) * spread,
        y,
      });
    });
  });

  return layout.sort((a, b) => a.slotIndex - b.slotIndex);
}

/**
 * Fallback si alguien agrega una formacion al motor y se olvida de declarar
 * sus filas: se agrupan por profundidad. No es tan prolijo, pero nunca queda
 * una formacion sin dibujar.
 */
function inferRows(slots: readonly FormationSlot[]): readonly number[] {
  const depths = slots.map((slot) => POSITION_META[slot.position].depth);
  const rows: number[] = [];
  let currentDepth = -Infinity;
  depths.forEach((depth) => {
    if (depth - currentDepth > 1.2) {
      rows.push(1);
      currentDepth = depth;
      return;
    }
    rows[rows.length - 1] = (rows[rows.length - 1] ?? 0) + 1;
  });
  return rows;
}
