/**
 * FUERZA DEL EQUIPO POR DIMENSIONES (secciones 30, 31, 33).
 *
 * El motor nunca usa "la media del equipo". Calcula nueve capacidades
 * (ataque, mediocampo, defensa, arquero, fisico, creacion, presion,
 * contraataque, balon parado) a partir de:
 *
 *   - los atributos concretos que importan en cada capacidad,
 *   - el rendimiento efectivo de cada titular (forma, moral, fatiga...),
 *   - el puesto y las tareas que le asigna la formacion,
 *   - los modificadores de la formacion y de la tactica.
 *
 * Para que los cracks se noten (seccion 33) el promedio no es aritmetico
 * sino una media de potencia con exponente > 1: un 92 levanta la dimension
 * mas de lo que la hunde un 60.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import type { AttributeKey, Attributes } from '../domain/attributes.ts';
import { DIMENSIONS, type Dimension, type DimensionRatings } from '../domain/dimensions.ts';
import type { Lineup } from '../domain/lineup.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { TacticalProfile } from '../domain/tactics.ts';
import type { Team } from '../domain/team.ts';
import { findPlayer } from '../domain/team.ts';
import { clampRating, weightedMean } from '../core/math.ts';
import type { Player } from '../domain/player.ts';
import type { PerformanceContext, RatedPlayer } from './effective-rating.ts';
import { evaluatePerformance } from './effective-rating.ts';
import type { Rng } from '../core/rng.ts';

/** Atributos que definen cada dimension, con su peso relativo. */
const DIMENSION_ATTRIBUTES: Readonly<Record<Dimension, Partial<Record<AttributeKey, number>>>> = {
  ataque: {
    definicion: 18,
    posicionamiento: 14,
    remate: 12,
    regate: 10,
    tecnica: 9,
    control: 9,
    aceleracion: 8,
    velocidad: 8,
    juegoAereo: 7,
    decisiones: 5,
  },
  mediocampo: {
    paseCorto: 18,
    control: 13,
    decisiones: 12,
    vision: 12,
    tecnica: 11,
    quite: 10,
    resistencia: 8,
    trabajoEquipo: 8,
    paseLargo: 8,
  },
  defensa: {
    marcaje: 18,
    quite: 16,
    posicionamiento: 16,
    concentracion: 12,
    fuerza: 11,
    juegoAereo: 10,
    velocidad: 9,
    decisiones: 8,
  },
  arquero: {
    reflejos: 22,
    manos: 18,
    posicionamiento: 16,
    achique: 13,
    concentracion: 12,
    agilidad: 11,
    decisiones: 8,
  },
  fisico: {
    resistencia: 26,
    fuerza: 22,
    velocidad: 20,
    aceleracion: 18,
    salto: 14,
  },
  creacion: {
    vision: 22,
    paseCorto: 17,
    paseLargo: 13,
    tecnica: 13,
    decisiones: 12,
    regate: 11,
    centros: 12,
  },
  presion: {
    resistencia: 22,
    quite: 18,
    trabajoEquipo: 16,
    agresividad: 14,
    aceleracion: 14,
    concentracion: 16,
  },
  contraataque: {
    velocidad: 24,
    aceleracion: 20,
    paseLargo: 14,
    regate: 14,
    definicion: 14,
    decisiones: 14,
  },
  balonParado: {
    tirosLibres: 20,
    centros: 16,
    juegoAereo: 18,
    salto: 14,
    fuerza: 12,
    remate: 10,
    penales: 10,
  },
};

/** Peso de un puesto en cada dimension, segun linea y tareas de la formacion. */
function slotWeight(rated: RatedPlayer, dimension: Dimension): number {
  const line = POSITION_META[rated.position].line;
  const isWide = POSITION_META[rated.position].isWide;
  const attack = rated.slot.attackDuty;
  const defense = rated.slot.defenseDuty;

  if (dimension === 'arquero') return line === 'POR' ? 1 : 0;
  if (line === 'POR') {
    // El arquero casi no participa del resto de las dimensiones.
    return dimension === 'defensa' ? 0.12 : dimension === 'balonParado' ? 0.05 : 0.02;
  }

  switch (dimension) {
    case 'ataque':
      return 0.1 + Math.pow(attack, 1.35) * 1.4;
    case 'defensa':
      return 0.1 + Math.pow(defense, 1.35) * 1.4;
    case 'mediocampo':
      return line === 'MED' ? 1.35 : line === 'DEF' ? 0.45 : 0.4;
    case 'fisico':
      return 1;
    case 'creacion':
      return 0.25 + attack * 0.9 + (line === 'MED' ? 0.5 : 0) + (isWide ? 0.2 : 0);
    case 'presion':
      return 0.5 + defense * 0.4 + attack * 0.4;
    case 'contraataque':
      return 0.2 + Math.pow(attack, 1.2) * 1.2 + (isWide ? 0.25 : 0);
    case 'balonParado':
      return 0.6 + (line === 'DEL' ? 0.3 : 0) + (isWide ? 0.2 : 0);
  }
}

/** Puntaje del jugador en una dimension: atributos del area + como esta jugando hoy. */
function playerDimensionScore(rated: RatedPlayer, dimension: Dimension): number {
  const weights = DIMENSION_ATTRIBUTES[dimension];
  const entries: { value: number; weight: number }[] = [];
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const w = weights[key];
    if (w === undefined || w <= 0) continue;
    entries.push({ value: rated.player.attributes[key], weight: w });
  }
  const attributeScore = weightedMean(entries);
  // El estado del jugador desplaza todas sus capacidades en la misma cantidad
  // de puntos en que su rendimiento se aparta de su overall.
  const conditionShift = rated.rating - rated.performance.baseOverall;
  return clampRating(attributeScore + conditionShift);
}

/** Media de potencia ponderada: hace que la calidad individual se note (seccion 33). */
function weightedPowerMean(
  values: readonly { value: number; weight: number }[],
  exponent: number,
): number {
  let num = 0;
  let den = 0;
  for (const { value, weight } of values) {
    if (weight <= 0) continue;
    num += weight * Math.pow(Math.max(value, 1), exponent);
    den += weight;
  }
  if (den <= 0) return 0;
  return Math.pow(num / den, 1 / exponent);
}

/** Jugador decisivo detectado por el motor (seccion 33). */
export type KeyPlayer = {
  readonly player: Player;
  readonly position: string;
  readonly rating: number;
  readonly role: 'goleador' | 'creador' | 'lider defensivo' | 'arquero';
  readonly score: number;
};

export type TeamStrength = {
  readonly team: Team;
  readonly lineup: Lineup;
  readonly profile: TacticalProfile;
  readonly players: readonly RatedPlayer[];
  readonly goalkeeper: RatedPlayer;
  /**
   * Nivel individual del arquero (seccion 45), sin mezclar con la defensa.
   * Es el valor que usa la etapa de conversion para tapar goles.
   */
  readonly goalkeeperRating: number;
  readonly dimensions: DimensionRatings;
  /** Capacidad por banda: define si sirve atacar por afuera (seccion 32). */
  readonly wingQuality: number;
  /** Juego aereo ofensivo y defensivo. */
  readonly aerialQuality: number;
  /** Mejor definidor del once (seccion 33). */
  readonly topFinisher: number;
  /** Mejor generador del once (seccion 33). */
  readonly topCreator: number;
  /** Mejor defensor del once. */
  readonly topDefender: number;
  /** Resistencia media ponderada: cuanto aguanta el equipo el ritmo (seccion 37). */
  readonly stamina: number;
  /** Experiencia media del once (seccion 40). */
  readonly experience: number;
  readonly keyPlayers: readonly KeyPlayer[];
  /** Promedio simple del once. Solo se usa para mostrar, no para simular. */
  readonly averageOverall: number;
};

/** Califica a los once titulares para este partido. */
export function rateLineup(
  lineup: Lineup,
  profile: TacticalProfile,
  context: PerformanceContext,
  config: EngineConfig,
  rng: Rng,
): RatedPlayer[] {
  return lineup.starters.map((assignment) => {
    const performance = evaluatePerformance(
      assignment.player,
      assignment.position,
      assignment.slot,
      profile,
      context,
      config,
      rng,
    );
    return {
      player: assignment.player,
      position: assignment.position,
      slot: assignment.slot,
      performance,
      rating: performance.effective,
    };
  });
}

/** Calcula las nueve dimensiones y los indicadores individuales del equipo. */
export function computeTeamStrength(
  team: Team,
  lineup: Lineup,
  profile: TacticalProfile,
  rated: readonly RatedPlayer[],
  config: EngineConfig,
): TeamStrength {
  const exponent = config.teamStrength.powerMeanExponent;
  const goalkeeper = rated.find((r) => r.position === 'POR') ?? (rated[0] as RatedPlayer);

  const raw = {} as Record<Dimension, number>;
  for (const dimension of DIMENSIONS) {
    const entries = rated.map((r) => ({
      value: playerDimensionScore(r, dimension),
      weight: slotWeight(r, dimension),
    }));
    raw[dimension] = weightedPowerMean(entries, exponent);
  }

  // El arquero es casi toda la dimension ARQUERO (seccion 45).
  const gkWeight = config.teamStrength.goalkeeperDimensionWeight;
  const gkScore = playerDimensionScore(goalkeeper, 'arquero');
  raw.arquero = gkScore * gkWeight + raw.defensa * (1 - gkWeight);

  const formationMods = profile.formation.modifiers;
  const tacticMods = tacticalModifiers(profile);

  const dimensions = {} as Record<Dimension, number>;
  for (const dimension of DIMENSIONS) {
    const value =
      (raw[dimension] ?? 0) + (formationMods[dimension] ?? 0) + (tacticMods[dimension] ?? 0);
    dimensions[dimension] = clampRating(value);
  }

  const fieldPlayers = rated.filter((r) => r.position !== 'POR');
  const widePlayers = fieldPlayers.filter((r) => POSITION_META[r.position].isWide);
  const attackers = fieldPlayers.filter((r) => r.slot.attackDuty >= 0.55);
  const defenders = fieldPlayers.filter((r) => r.slot.defenseDuty >= 0.6);

  const wingQuality = widePlayers.length
    ? weightedPowerMean(
        widePlayers.map((r) => ({
          value: clampRating(
            weightedMean([
              { value: r.player.attributes.regate, weight: 3 },
              { value: r.player.attributes.velocidad, weight: 3 },
              { value: r.player.attributes.centros, weight: 3 },
              { value: r.player.attributes.aceleracion, weight: 2 },
            ]) + (r.rating - r.performance.baseOverall),
          ),
          weight: 1,
        })),
        exponent,
      )
    : clampRating(dimensions.ataque - 6);

  const aerialQuality = weightedPowerMean(
    fieldPlayers.map((r) => ({
      value: attributeBlend(r.player.attributes, { juegoAereo: 3, salto: 2, fuerza: 2 }) +
        (r.rating - r.performance.baseOverall),
      weight: r.slot.attackDuty + r.slot.defenseDuty,
    })),
    exponent,
  );

  const topFinisher = maxOf(attackers.length ? attackers : fieldPlayers, (r) =>
    attributeBlend(r.player.attributes, { definicion: 4, posicionamiento: 3, remate: 2 }) +
    (r.rating - r.performance.baseOverall));

  const topCreator = maxOf(fieldPlayers, (r) =>
    attributeBlend(r.player.attributes, { vision: 4, paseCorto: 3, tecnica: 2, paseLargo: 2 }) +
    (r.rating - r.performance.baseOverall));

  const topDefender = maxOf(defenders.length ? defenders : fieldPlayers, (r) =>
    attributeBlend(r.player.attributes, { marcaje: 3, quite: 3, posicionamiento: 3 }) +
    (r.rating - r.performance.baseOverall));

  const stamina = weightedMean(
    fieldPlayers.map((r) => ({ value: r.player.attributes.resistencia, weight: 1 })),
  );
  const experience = weightedMean(rated.map((r) => ({ value: r.player.experience, weight: 1 })));

  return {
    team,
    lineup,
    profile,
    players: rated,
    goalkeeper,
    goalkeeperRating: clampRating(gkScore),
    dimensions,
    wingQuality: clampRating(wingQuality),
    aerialQuality: clampRating(aerialQuality),
    topFinisher: clampRating(topFinisher),
    topCreator: clampRating(topCreator),
    topDefender: clampRating(topDefender),
    stamina,
    experience,
    keyPlayers: detectKeyPlayers(rated),
    averageOverall: Math.round(
      weightedMean(rated.map((r) => ({ value: r.performance.baseOverall, weight: 1 }))),
    ),
  };
}

/** Como desplaza la tactica elegida cada dimension (seccion 31). */
function tacticalModifiers(profile: TacticalProfile): Partial<Record<Dimension, number>> {
  return {
    // La mentalidad reparte: lo que suma en ataque lo resta en defensa.
    ataque: profile.mentality * 2.5,
    defensa: -profile.mentality * 2.5,
    presion: (profile.pressing - 0.5) * 8,
    contraataque: (profile.counterIntent - 0.4) * 7 + (profile.directness - 0.5) * 3,
    creacion: (0.5 - profile.directness) * 5,
    mediocampo: (0.5 - profile.directness) * 2 - (profile.tempo - 0.5) * 1,
    balonParado: (profile.setPieceIntent - 0.3) * 5,
  };
}

function attributeBlend(
  attributes: Attributes,
  weights: Partial<Record<AttributeKey, number>>,
): number {
  const entries: { value: number; weight: number }[] = [];
  for (const key of Object.keys(weights) as AttributeKey[]) {
    const w = weights[key];
    if (w === undefined) continue;
    entries.push({ value: attributes[key], weight: w });
  }
  return weightedMean(entries);
}

function maxOf(items: readonly RatedPlayer[], score: (r: RatedPlayer) => number): number {
  let best = 0;
  for (const item of items) best = Math.max(best, score(item));
  return best;
}

/** Detecta a los jugadores que pueden marcar diferencias (seccion 33). */
function detectKeyPlayers(rated: readonly RatedPlayer[]): KeyPlayer[] {
  const candidates: KeyPlayer[] = [];
  for (const r of rated) {
    const attrs = r.player.attributes;
    const options: { role: KeyPlayer['role']; score: number }[] = [];
    if (r.position === 'POR') {
      options.push({ role: 'arquero', score: attributeBlend(attrs, { reflejos: 3, manos: 2, posicionamiento: 2 }) });
    } else {
      options.push({
        role: 'goleador',
        score: attributeBlend(attrs, { definicion: 4, posicionamiento: 3, remate: 2 }) * (0.55 + r.slot.attackDuty * 0.55),
      });
      options.push({
        role: 'creador',
        score: attributeBlend(attrs, { vision: 4, paseCorto: 3, regate: 2, tecnica: 2 }) * (0.7 + r.slot.attackDuty * 0.35),
      });
      options.push({
        role: 'lider defensivo',
        score: attributeBlend(attrs, { marcaje: 3, quite: 3, posicionamiento: 2, concentracion: 2 }) * (0.6 + r.slot.defenseDuty * 0.5),
      });
    }
    const best = options.reduce((a, b) => (b.score > a.score ? b : a));
    candidates.push({
      player: r.player,
      position: r.position,
      rating: r.rating,
      role: best.role,
      score: best.score * (0.75 + (r.rating / 100) * 0.5),
    });
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Resuelve los ejecutores de balon parado (seccion 46). */
export function resolveSetPieceTakers(
  team: Team,
  rated: readonly RatedPlayer[],
): {
  readonly penalty: RatedPlayer;
  readonly freeKick: RatedPlayer;
  readonly corner: RatedPlayer;
} {
  const fieldPlayers = rated.filter((r) => r.position !== 'POR');
  const pool = fieldPlayers.length > 0 ? fieldPlayers : rated;

  const designated = (id: string | undefined): RatedPlayer | undefined => {
    const player = findPlayer(team, id);
    if (!player) return undefined;
    return pool.find((r) => r.player.id === player.id);
  };

  const bestBy = (weights: Partial<Record<AttributeKey, number>>): RatedPlayer => {
    let best = pool[0] as RatedPlayer;
    let bestScore = -Infinity;
    for (const r of pool) {
      const score = attributeBlend(r.player.attributes, weights) + (r.rating - r.performance.baseOverall) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best;
  };

  return {
    penalty:
      designated(team.setPieceTakers.penales) ??
      bestBy({ penales: 4, definicion: 3, concentracion: 2, tecnica: 1 }),
    freeKick:
      designated(team.setPieceTakers.tirosLibres) ??
      bestBy({ tirosLibres: 5, tecnica: 2, remate: 1 }),
    corner:
      designated(team.setPieceTakers.corners) ??
      bestBy({ centros: 5, tecnica: 2, paseLargo: 1 }),
  };
}
