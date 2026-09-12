/**
 * Etiquetas legibles de las opciones tacticas (seccion 18).
 *
 * El motor usa claves sin acentos ('posesion', 'rapido'); la interfaz muestra
 * texto en castellano correcto. Un solo lugar para la traduccion.
 */

import type { Tactics } from '../../domain/tactics.ts';

const MENTALITY: Record<Tactics['mentality'], string> = {
  'muy defensiva': 'Muy defensiva',
  defensiva: 'Defensiva',
  equilibrada: 'Equilibrada',
  ofensiva: 'Ofensiva',
  'muy ofensiva': 'Muy ofensiva',
};

const PASSING: Record<Tactics['passingStyle'], string> = {
  posesion: 'Posesión',
  mixto: 'Mixto',
  directo: 'Directo',
};

const TEMPO: Record<Tactics['tempo'], string> = {
  lento: 'Bajo',
  equilibrado: 'Normal',
  rapido: 'Alto',
};

const LEVEL: Record<Tactics['pressing'], string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const FOCUS: Record<Tactics['attackFocus'], string> = {
  centro: 'Por el centro',
  mixto: 'Mixto',
  bandas: 'Por las bandas',
};

const WIDTH: Record<Tactics['width'], string> = {
  estrecho: 'Estrecho',
  normal: 'Normal',
  ancho: 'Ancho',
};

export const tacticsLabel = {
  mentality: (value: Tactics['mentality']): string => MENTALITY[value],
  passingStyle: (value: Tactics['passingStyle']): string => PASSING[value],
  tempo: (value: Tactics['tempo']): string => TEMPO[value],
  level: (value: Tactics['pressing']): string => LEVEL[value],
  attackFocus: (value: Tactics['attackFocus']): string => FOCUS[value],
  width: (value: Tactics['width']): string => WIDTH[value],
};
