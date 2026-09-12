/**
 * Adecuacion a la posicion (seccion 26).
 *
 * Jugar fuera de posicion penaliza, y la penalizacion depende de cuan
 * distinta es la posicion. Una posicion secundaria casi no penaliza.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { familiarityTier, type FamiliarityTier, type Position } from '../domain/positions.ts';
import type { Player } from '../domain/player.ts';

export type PositionFit = {
  readonly natural: Position;
  readonly assigned: Position;
  readonly tier: FamiliarityTier;
  /** Penalizacion 0 (natural) .. 0.6 (jugador de campo al arco). */
  readonly penalty: number;
  /** La posicion asignada figura entre las secundarias del jugador. */
  readonly isSecondary: boolean;
  /** Etiqueta legible para la interfaz. */
  readonly label: 'natural' | 'secundaria' | 'adaptado' | 'incomodo' | 'fuera de posicion';
};

export function evaluatePositionFit(
  player: Player,
  assigned: Position,
  config: EngineConfig,
): PositionFit {
  const natural = player.position;
  const tier = familiarityTier(natural, assigned);
  const tierPenalty = config.performance.positionPenaltyByTier[tier];
  const isSecondary = player.secondaryPositions.includes(assigned);

  let penalty = tierPenalty;
  if (natural === assigned) {
    penalty = 0;
  } else if (isSecondary) {
    // Una posicion secundaria la tiene trabajada: nunca penaliza mas que el minimo.
    penalty = Math.min(tierPenalty, config.performance.secondaryPositionPenalty);
  }

  return {
    natural,
    assigned,
    tier,
    penalty,
    isSecondary,
    label: fitLabel(natural, assigned, isSecondary, tier),
  };
}

function fitLabel(
  natural: Position,
  assigned: Position,
  isSecondary: boolean,
  tier: FamiliarityTier,
): PositionFit['label'] {
  if (natural === assigned) return 'natural';
  if (isSecondary) return 'secundaria';
  if (tier <= 1) return 'adaptado';
  if (tier === 2) return 'incomodo';
  return 'fuera de posicion';
}
