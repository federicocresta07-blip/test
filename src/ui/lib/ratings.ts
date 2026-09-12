/**
 * Reglas visuales de ratings y estados (seccion 18).
 *
 * Una sola escala de color para overall, forma y energia en toda la app.
 */

import { formLabel } from '../../domain/player.ts';
import type { Player } from '../../domain/player.ts';

export type RatingTier = 'elite' | 'great' | 'good' | 'average' | 'poor' | 'bad';

export function ratingTier(value: number): RatingTier {
  if (value >= 85) return 'elite';
  if (value >= 78) return 'great';
  if (value >= 70) return 'good';
  if (value >= 62) return 'average';
  if (value >= 52) return 'poor';
  return 'bad';
}

export function ratingColor(value: number): string {
  return `var(--rating-${ratingTier(value)})`;
}

/** Energia visible: el inverso de la fatiga (seccion 6.2). */
export function energyOf(player: Player): number {
  return Math.max(0, Math.min(100, 100 - player.condition.fatigue));
}

export function energyColor(energy: number): string {
  if (energy >= 85) return 'var(--ok)';
  if (energy >= 70) return 'var(--rating-good)';
  if (energy >= 55) return 'var(--warn)';
  return 'var(--danger)';
}

export function formColor(form: number): string {
  if (form >= 74) return 'var(--ok)';
  if (form >= 60) return 'var(--rating-good)';
  if (form >= 44) return 'var(--text-secondary)';
  if (form >= 28) return 'var(--warn)';
  return 'var(--danger)';
}

export function formText(form: number): string {
  return formLabel(form);
}

/** Flecha compacta de tendencia de forma, para las tablas densas. */
export function formArrow(form: number): string {
  if (form >= 74) return '▲';
  if (form >= 60) return '▵';
  if (form >= 44) return '–';
  if (form >= 28) return '▿';
  return '▼';
}
