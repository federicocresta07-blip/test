/**
 * ETAPA 3 — CALIDAD DE LAS OCASIONES (secciones 43, 44).
 *
 * No todas las ocasiones valen lo mismo. Cada remate se convierte en una
 * ocasion con su tipo y su xG:
 *
 *   - ocasion clara      xG alto, mano a mano o remate dentro del area chica
 *   - ocasion buena      remate limpio dentro del area
 *   - remate lejano      xG bajo, de afuera
 *   - cabezazo           centro al area
 *   - contraataque       campo abierto, xG alto
 *   - balon parado       corner o falta lateral (seccion 46)
 *   - tiro libre         directo al arco (seccion 46)
 *   - penal              (seccion 46)
 *
 * El reparto depende de la ventaja ofensiva y de la tactica: un equipo que
 * ataca por las bandas genera mas cabezazos, uno que busca la contra genera
 * mas ocasiones de campo abierto.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { RatedPlayer } from '../ratings/effective-rating.ts';
import type { TeamStrength } from '../ratings/team-strength.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { MatchupEffect } from './tactical-matchups.ts';

export type ChanceKind =
  | 'ocasionClara'
  | 'ocasionBuena'
  | 'remateLejano'
  | 'cabezazo'
  | 'contraataque'
  | 'balonParado'
  | 'tiroLibre'
  | 'penal';

export type Side = 'local' | 'visitante';

export type Chance = {
  readonly id: number;
  readonly side: Side;
  readonly kind: ChanceKind;
  /** Goles esperados de esta ocasion. */
  readonly xg: number;
  readonly shooter: RatedPlayer;
  readonly assist: RatedPlayer | undefined;
  /** Nace de una jugada de balon parado (seccion 46). */
  readonly fromSetPiece: boolean;
  /** Minuto asignado en la etapa 5. */
  minute: number;
};

export type ChanceMix = Record<'ocasionClara' | 'ocasionBuena' | 'remateLejano' | 'cabezazo' | 'contraataque', number>;

/** Capacidad de generar ocasiones CLARAS (no solo muchas). */
export function attackQualityIndex(team: TeamStrength): number {
  return team.dimensions.ataque * 0.55 + team.topFinisher * 0.25 + team.wingQuality * 0.2;
}

/** Capacidad de defender el area. */
export function boxDefenseIndex(team: TeamStrength): number {
  return team.dimensions.defensa * 0.6 + team.topDefender * 0.25 + team.aerialQuality * 0.15;
}

/** Reparto de los remates de juego entre tipos de ocasion. */
export function resolveChanceMix(
  attacking: TeamStrength,
  qualityEdge: number,
  config: EngineConfig,
): ChanceMix {
  const base = config.chanceQuality.baseMix;
  const profile = attacking.profile;
  const delta = config.chanceQuality.edgeToClearChances * qualityEdge;

  const mix: ChanceMix = {
    // La ventaja ofensiva convierte remates de afuera en ocasiones claras.
    ocasionClara: base.ocasionClara + delta * 0.55 + (profile.boxPresence - 0.5) * 0.04,
    ocasionBuena: base.ocasionBuena + delta * 0.3,
    remateLejano: base.remateLejano - delta * 0.85 + (profile.directness - 0.5) * 0.04,
    // Atacar por las bandas produce centros, y los centros producen cabezazos.
    cabezazo: base.cabezazo + (profile.wingFocus - 0.5) * 0.12 + (profile.width - 0.5) * 0.04,
    contraataque: base.contraataque + (profile.counterIntent - 0.4) * 0.16,
  };

  // Nada puede ser negativo y el reparto tiene que sumar 1.
  let total = 0;
  for (const key of Object.keys(mix) as (keyof ChanceMix)[]) {
    mix[key] = Math.max(0.01, mix[key]);
    total += mix[key];
  }
  for (const key of Object.keys(mix) as (keyof ChanceMix)[]) {
    mix[key] = mix[key] / total;
  }
  return mix;
}

/**
 * CALIDAD DE LA POSICION DE REMATE (etapa 3).
 *
 * Mide lo BUENA que es la ocasion que el jugador se genera: donde se ubica,
 * como llega, si la controla. Deliberadamente NO usa `remate`: acertar el
 * remate es la etapa 4. Asi ningun atributo se cobra dos veces.
 *
 * Con diez atributos estas mezclas quedaron mas cortas, y en dos casos hubo
 * que decidir en lugar de renombrar. El viejo `posicionamiento` colapso en
 * `entradas`, que para un atacante no significa nada: donde media "sabe
 * ubicarse en el area" ahora pesan la calidad y la velocidad, no las entradas.
 */
export function positioningAbility(rated: RatedPlayer, kind: ChanceKind): number {
  const a = rated.player.attributes;
  const shift = rated.rating - rated.performance.baseOverall;
  switch (kind) {
    case 'cabezazo':
    case 'balonParado':
      // Ganar la posicion en el area es un duelo fisico. PC Futbol no tiene
      // juego aereo ni salto: lo mas cercano es la agresividad.
      return a.agresividad * 0.65 + a.calidad * 0.2 + a.velocidad * 0.15 + shift;
    case 'remateLejano':
      return a.calidad * 0.7 + a.agresividad * 0.2 + a.regate * 0.1 + shift;
    case 'contraataque':
      return a.velocidad * 0.45 + a.calidad * 0.35 + a.regate * 0.2 + shift;
    case 'tiroLibre':
      return a.calidad + shift;
    case 'penal':
      return a.calidad + shift;
    default:
      return a.calidad * 0.45 + a.velocidad * 0.3 + a.regate * 0.25 + shift;
  }
}

/**
 * DEFINICION (etapa 4).
 *
 * Mide la capacidad de convertir la ocasion una vez creada. Es el atributo que
 * usa `conversion.ts`, y el que hace que un 9 con remate 94 sea otra cosa
 * (seccion 33).
 *
 * En PC Futbol la definicion es `remate` (RM) y la potencia de disparo es
 * `tiro` (TI). Son dos atributos distintos del archivo, asi que el remate de
 * cerca y el tiro de afuera siguen separados. Los tiros libres y los penales,
 * en cambio, ya no: los tres eran atributos propios y ahora son `tiro`.
 */
export function finishingAbility(rated: RatedPlayer, kind: ChanceKind): number {
  const a = rated.player.attributes;
  const shift = rated.rating - rated.performance.baseOverall;
  switch (kind) {
    case 'cabezazo':
    case 'balonParado':
      return a.remate * 0.55 + a.agresividad * 0.3 + a.tiro * 0.15 + shift;
    case 'remateLejano':
      return a.tiro * 0.65 + a.remate * 0.2 + a.calidad * 0.15 + shift;
    case 'contraataque':
      return a.remate * 0.7 + a.calidad * 0.3 + shift;
    case 'tiroLibre':
      return a.tiro * 0.8 + a.calidad * 0.2 + shift;
    case 'penal':
      return a.tiro * 0.6 + a.calidad * 0.25 + a.remate * 0.15 + shift;
    default:
      return a.remate * 0.75 + a.tiro * 0.15 + a.calidad * 0.1 + shift;
  }
}

/** Peso de un jugador para ser el que remate esta ocasion. */
export function shooterWeight(rated: RatedPlayer, kind: ChanceKind): number {
  if (rated.position === 'POR') return 0;
  const meta = POSITION_META[rated.position];
  // Un jugador remata porque llega a la posicion y porque sabe definir.
  const ability = (positioningAbility(rated, kind) + finishingAbility(rated, kind)) / 2;
  const abilityFactor = Math.max(0.15, 1 + (ability - 65) / 60);

  if (kind === 'balonParado' || kind === 'cabezazo') {
    // En los centros y en la pelota quieta tambien aparecen los defensores.
    const presence = kind === 'balonParado'
      ? 0.35 + rated.slot.attackDuty * 0.65 + (meta.line === 'DEF' ? 0.3 : 0)
      : 0.15 + Math.pow(rated.slot.attackDuty, 1.1) * 1.1;
    return presence * abilityFactor;
  }
  if (kind === 'remateLejano') {
    return (0.25 + rated.slot.attackDuty * 0.85) * abilityFactor;
  }
  return (0.06 + Math.pow(rated.slot.attackDuty, 1.35) * 1.5) * abilityFactor;
}

/** Peso de un jugador para dar la asistencia. */
function assistWeight(rated: RatedPlayer, kind: ChanceKind): number {
  if (rated.position === 'POR') return kind === 'contraataque' ? 0.05 : 0.01;
  const a = rated.player.attributes;
  const meta = POSITION_META[rated.position];
  const creation =
    kind === 'cabezazo'
      ? a.pase * 0.7 + a.calidad * 0.3
      : a.calidad * 0.6 + a.pase * 0.25 + a.regate * 0.15;
  const abilityFactor = Math.max(0.15, 1 + (creation - 65) / 60);
  const wideBonus = kind === 'cabezazo' && meta.isWide ? 1.6 : 1;
  return (0.15 + rated.slot.attackDuty * 1.1) * abilityFactor * wideBonus;
}

/** Probabilidad de que la ocasion venga de una asistencia. */
function assistProbability(kind: ChanceKind): number {
  switch (kind) {
    case 'ocasionClara':
      return 0.82;
    case 'ocasionBuena':
      return 0.7;
    case 'cabezazo':
      return 0.94;
    case 'balonParado':
      return 0.9;
    case 'contraataque':
      return 0.78;
    case 'remateLejano':
      return 0.22;
    default:
      return 0;
  }
}

export function pickShooter(team: TeamStrength, kind: ChanceKind, rng: Rng): RatedPlayer {
  const weights = team.players.map((p) => shooterWeight(p, kind));
  return team.players[rng.weightedIndex(weights)] as RatedPlayer;
}

function pickAssist(
  team: TeamStrength,
  kind: ChanceKind,
  shooter: RatedPlayer,
  rng: Rng,
): RatedPlayer | undefined {
  if (!rng.chance(assistProbability(kind))) return undefined;
  const candidates = team.players.filter((p) => p.player.id !== shooter.player.id);
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((p) => assistWeight(p, kind));
  return candidates[rng.weightedIndex(weights)] as RatedPlayer;
}

/** xG de una ocasion concreta: tipo + calidad del ejecutor + cruces + localia. */
export function chanceXg(
  kind: ChanceKind,
  shooter: RatedPlayer,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
): number {
  const cfg = config.chanceQuality;
  const base =
    kind === 'tiroLibre'
      ? config.setPieces.freeKickBaseGoal
      : kind === 'penal'
        ? cfg.baseXg.penal
        : cfg.baseXg[kind];

  if (kind === 'penal') return clamp(base, cfg.minXgPerShot, cfg.maxXgPerShot);

  // Calidad individual del ejecutor para GENERARSE la ocasion (seccion 33).
  const ability = positioningAbility(shooter, kind);
  const abilityFactor = 1 + cfg.attackerQualityEffect * ((ability - config.performance.leagueAverageRating) / 100);

  const matchupFactor = 1 + matchup.chanceQuality + (kind === 'contraataque' ? matchup.counterBonus : 0) +
    (kind === 'balonParado' || kind === 'tiroLibre' ? matchup.setPieceBonus : 0);
  const homeFactor = isHome ? config.homeAdvantage.xgMultiplier : 1;

  return clamp(base * abilityFactor * clamp(matchupFactor, 0.55, 1.6) * homeFactor, cfg.minXgPerShot, cfg.maxXgPerShot);
}

let chanceCounter = 0;

/** Crea una ocasion completa (tipo, ejecutor, asistencia y xG). */
export function createChance(
  side: Side,
  kind: ChanceKind,
  team: TeamStrength,
  matchup: MatchupEffect,
  isHome: boolean,
  config: EngineConfig,
  rng: Rng,
  options: { readonly shooter?: RatedPlayer; readonly fromSetPiece?: boolean } = {},
): Chance {
  const shooter = options.shooter ?? pickShooter(team, kind, rng);
  const assist = options.shooter ? undefined : pickAssist(team, kind, shooter, rng);
  chanceCounter += 1;
  return {
    id: chanceCounter,
    side,
    kind,
    xg: chanceXg(kind, shooter, matchup, isHome, config),
    shooter,
    assist,
    fromSetPiece:
      options.fromSetPiece ?? (kind === 'balonParado' || kind === 'tiroLibre' || kind === 'penal'),
    minute: 0,
  };
}

/**
 * Ocasion planificada: se sabe de que tipo es y en que minuto llega, pero
 * todavia no quien la remata.
 *
 * Se separa a proposito: el ejecutor y el xG se resuelven en el momento del
 * remate, con los jugadores que esten en cancha en ese minuto. Asi los cambios
 * y las expulsiones cambian de verdad lo que pasa despues (secciones 47, 48).
 */
export type PlannedChance = {
  readonly side: Side;
  readonly kind: ChanceKind;
  minute: number;
  readonly fromSetPiece: boolean;
};

/** Planifica los remates de juego de un equipo (etapas 2 y 3). */
export function planOpenPlayChances(
  side: Side,
  team: TeamStrength,
  shots: number,
  qualityEdge: number,
  config: EngineConfig,
  rng: Rng,
): PlannedChance[] {
  const mix = resolveChanceMix(team, qualityEdge, config);
  const kinds = Object.keys(mix) as (keyof ChanceMix)[];
  const weights = kinds.map((k) => mix[k]);

  // Los remates esperados son fraccionarios: la parte decimal se sortea.
  const count = Math.floor(shots) + (rng.next() < shots - Math.floor(shots) ? 1 : 0);
  const planned: PlannedChance[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[rng.weightedIndex(weights)] as ChanceKind;
    planned.push({ side, kind, minute: 0, fromSetPiece: false });
  }
  return planned;
}

/** Promedio de una habilidad entre los candidatos a remate, ponderado por quien remata. */
export function shooterWeightedAbility(
  team: TeamStrength,
  kind: ChanceKind,
  ability: (rated: RatedPlayer, kind: ChanceKind) => number,
): number {
  let num = 0;
  let den = 0;
  for (const rated of team.players) {
    const w = shooterWeight(rated, kind);
    if (w <= 0) continue;
    num += w * ability(rated, kind);
    den += w;
  }
  return den > 0 ? num / den : 50;
}
