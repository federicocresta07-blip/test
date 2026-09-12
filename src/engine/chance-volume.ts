/**
 * ETAPA 2 — CREACION DE OCASIONES (seccion 43).
 *
 * Cuantas oportunidades genera cada equipo. Se mide la capacidad de generar
 * (creacion, mediocampo, ataque) contra la capacidad de impedir (defensa,
 * mediocampo y presion rival), y se corrige por posesion, localia, cruces
 * tacticos y lo abierto que este el partido.
 *
 * Ojo: esta etapa decide CUANTAS ocasiones, no cuan buenas. De eso se ocupa
 * la etapa 3, que usa otra combinacion de dimensiones a proposito: generar
 * muchas ocasiones y generar ocasiones claras no son la misma virtud.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import type { MatchupEffect } from './tactical-matchups.ts';

export type VolumeOutcome = {
  /** Ventaja de generacion en puntos (positiva = genera mas que lo que el rival impide). */
  readonly edge: number;
  /** Remates de juego esperados. */
  readonly expectedShots: number;
  /** Remates de juego efectivos de este partido (con ruido acotado). */
  readonly shots: number;
};

/** Capacidad de generar ocasiones. */
export function creationIndex(team: TeamStrength): number {
  const d = team.dimensions;
  return d.creacion * 0.45 + d.mediocampo * 0.3 + d.ataque * 0.25;
}

/** Capacidad de impedir que el rival genere. */
export function denialIndex(team: TeamStrength): number {
  const d = team.dimensions;
  return d.defensa * 0.5 + d.mediocampo * 0.3 + d.presion * 0.2;
}

export function resolveVolume(
  attacking: TeamStrength,
  defending: TeamStrength,
  possession: number,
  openness: number,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
  rng: Rng,
): VolumeOutcome {
  const cfg = config.chances;
  const edge = creationIndex(attacking) - denialIndex(defending);

  const possessionFactor = Math.pow(possession / 0.5, cfg.possessionElasticity);
  const opennessFactor = 1 + (openness - 0.5) * 0.3;
  const homeFactor = isHome ? cfg.homeShotBonus : 1;
  const matchupFactor = clamp(1 + matchup.shotVolume, 0.6, 1.5);

  const expectedShots =
    cfg.baseShots *
    Math.exp(cfg.qualitySensitivity * edge) *
    possessionFactor *
    opennessFactor *
    homeFactor *
    matchupFactor;

  // Ruido de volumen: hay partidos en los que no se genera nada y otros locos.
  const noise = Math.exp(rng.boundedNormal(0, cfg.volumeNoiseSd, 2.5) - (cfg.volumeNoiseSd ** 2) / 2);
  const shots = clamp(expectedShots * noise, cfg.minShots, cfg.maxShots);

  return { edge, expectedShots, shots };
}
