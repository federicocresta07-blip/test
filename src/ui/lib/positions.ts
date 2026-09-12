/**
 * Reglas visuales de posiciones (seccion 18: centralizar enums y reglas).
 *
 * La informacion futbolistica sale del motor (`POSITION_META`); aca solo se
 * define como se agrupa y se pinta.
 */

import { POSITION_META, type Position } from '../../domain/positions.ts';
import type { PositionFit } from '../../ratings/position-fit.ts';
import type { PositionGroup } from '../models/index.ts';

/** Grupo de la posicion, para filtros y colores. */
export function positionGroup(position: Position): PositionGroup {
  const line = POSITION_META[position].line;
  return line === 'DEL' ? 'ATA' : line;
}

export const POSITION_GROUPS: readonly PositionGroup[] = ['POR', 'DEF', 'MED', 'ATA'];

export const POSITION_GROUP_LABEL: Record<PositionGroup, string> = {
  POR: 'Arqueros',
  DEF: 'Defensores',
  MED: 'Mediocampistas',
  ATA: 'Delanteros',
};

/** Color del grupo, como variable CSS. */
export function positionGroupColor(group: PositionGroup): string {
  switch (group) {
    case 'POR':
      return 'var(--warn)';
    case 'DEF':
      return 'var(--info)';
    case 'MED':
      return 'var(--ok)';
    case 'ATA':
      return 'var(--danger)';
  }
}

export function positionName(position: Position): string {
  return POSITION_META[position].name;
}

/** Orden futbolistico: del arco hacia adelante. */
export function positionSortIndex(position: Position): number {
  return POSITION_META[position].depth;
}

/**
 * Etiqueta legible de la adecuacion al puesto.
 * El motor usa claves sin acentos; la interfaz muestra castellano correcto.
 */
export function fitLabel(label: PositionFit['label']): string {
  switch (label) {
    case 'natural':
      return 'Posición natural';
    case 'secundaria':
      return 'Posición secundaria';
    case 'adaptado':
      return 'Se adapta bien';
    case 'incomodo':
      return 'Incómodo';
    case 'fuera de posicion':
      return 'Fuera de posición';
  }
}
