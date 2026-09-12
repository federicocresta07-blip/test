/**
 * Alineacion: quien juega y en que puesto.
 *
 * `buildAutomaticLineup` arma el once por rendimiento esperado (sin azar: la
 * IA no puede ver la suerte del partido). Lo usan tanto los equipos de la IA
 * como los del usuario que no definan alineacion, y garantiza que HUMANO vs IA
 * y IA vs IA pasen por el mismo camino (seccion 49).
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { evaluatePerformance, type PerformanceContext } from '../ratings/effective-rating.ts';
import { getFormation, type Formation, type FormationSlot } from './formations.ts';
import { isAvailable, type Player } from './player.ts';
import type { Position } from './positions.ts';
import { buildTacticalProfile, type TacticalProfile } from './tactics.ts';
import type { Team } from './team.ts';

export type LineupSlotAssignment = {
  readonly player: Player;
  readonly position: Position;
  readonly slot: FormationSlot;
  readonly slotIndex: number;
};

export type Lineup = {
  readonly formation: Formation;
  readonly starters: readonly LineupSlotAssignment[];
  readonly bench: readonly Player[];
};

export type LineupOverride = {
  /** Ids de titulares en el orden de los puestos de la formacion. */
  readonly starterIds?: readonly string[];
  readonly benchIds?: readonly string[];
};

export const MAX_BENCH = 9;

/**
 * El equipo no tiene once jugadores disponibles.
 *
 * Es un error del estado del juego, no de la simulacion: le corresponde al
 * juego resolverlo (juveniles, reservas, o dar el partido por perdido). Se
 * expone como clase propia para que se pueda distinguir y atrapar.
 */
export class InsufficientPlayersError extends Error {
  readonly teamName: string;
  readonly available: number;
  readonly required: number;

  constructor(teamName: string, available: number, required: number) {
    super(`${teamName}: hacen falta ${required} jugadores disponibles y hay ${available}`);
    this.name = 'InsufficientPlayersError';
    this.teamName = teamName;
    this.available = available;
    this.required = required;
  }
}

/**
 * Arma el mejor once posible para la formacion elegida.
 *
 * Algoritmo: asignacion voraz sobre la matriz puesto x jugador (se toma
 * siempre el mejor par disponible) y luego una pasada de intercambios que
 * mejora el total. Es barato y queda muy cerca del optimo.
 */
export function buildAutomaticLineup(
  team: Team,
  config: EngineConfig,
  context: PerformanceContext,
): Lineup {
  const formation = getFormation(team.tactics.formationId);
  const profile = buildTacticalProfile(team.tactics);
  const candidates = team.players.filter(isAvailable);

  if (candidates.length < formation.slots.length) {
    throw new InsufficientPlayersError(team.name, candidates.length, formation.slots.length);
  }

  const score = (player: Player, slot: FormationSlot): number =>
    evaluatePerformance(player, slot.position, slot, profile, context, config).expected;

  const scores: number[][] = formation.slots.map((slot) => candidates.map((p) => score(p, slot)));

  const assignedPlayer: (number | undefined)[] = formation.slots.map(() => undefined);
  const takenPlayers = new Set<number>();

  for (let step = 0; step < formation.slots.length; step += 1) {
    let bestSlot = -1;
    let bestPlayer = -1;
    let bestValue = -Infinity;
    for (let s = 0; s < formation.slots.length; s += 1) {
      if (assignedPlayer[s] !== undefined) continue;
      const row = scores[s] as number[];
      for (let p = 0; p < candidates.length; p += 1) {
        if (takenPlayers.has(p)) continue;
        const value = row[p] as number;
        if (value > bestValue) {
          bestValue = value;
          bestSlot = s;
          bestPlayer = p;
        }
      }
    }
    if (bestSlot < 0 || bestPlayer < 0) break;
    assignedPlayer[bestSlot] = bestPlayer;
    takenPlayers.add(bestPlayer);
  }

  improveAssignment(assignedPlayer, scores, formation.slots.length);

  const starters: LineupSlotAssignment[] = formation.slots.map((slot, index) => {
    const playerIndex = assignedPlayer[index];
    if (playerIndex === undefined) {
      throw new Error(`${team.name}: no se pudo cubrir el puesto ${slot.position}`);
    }
    return {
      player: candidates[playerIndex] as Player,
      position: slot.position,
      slot,
      slotIndex: index,
    };
  });

  const starterIds = new Set(starters.map((s) => s.player.id));
  const bench = selectBench(candidates.filter((p) => !starterIds.has(p.id)), config, profile, context);

  return { formation, starters, bench };
}

/** Intercambia pares de puestos mientras el total mejore. */
function improveAssignment(
  assigned: (number | undefined)[],
  scores: number[][],
  slotCount: number,
): void {
  let improved = true;
  let guard = 0;
  while (improved && guard < 20) {
    improved = false;
    guard += 1;
    for (let a = 0; a < slotCount; a += 1) {
      for (let b = a + 1; b < slotCount; b += 1) {
        const pa = assigned[a];
        const pb = assigned[b];
        if (pa === undefined || pb === undefined) continue;
        const current = (scores[a]?.[pa] ?? 0) + (scores[b]?.[pb] ?? 0);
        const swapped = (scores[a]?.[pb] ?? 0) + (scores[b]?.[pa] ?? 0);
        if (swapped > current + 1e-9) {
          assigned[a] = pb;
          assigned[b] = pa;
          improved = true;
        }
      }
    }
  }
}

/** Banco: los mejores por puesto natural, garantizando un arquero suplente. */
function selectBench(
  rest: readonly Player[],
  config: EngineConfig,
  profile: TacticalProfile,
  context: PerformanceContext,
): Player[] {
  const naturalSlot = (player: Player): FormationSlot => ({
    position: player.position,
    attackDuty: 0.5,
    defenseDuty: 0.5,
  });
  const ranked = rest
    .map((player) => ({
      player,
      value: evaluatePerformance(player, player.position, naturalSlot(player), profile, context, config)
        .expected,
    }))
    .sort((a, b) => b.value - a.value)
    .map((e) => e.player);

  const bench = ranked.slice(0, MAX_BENCH);
  const hasGk = bench.some((p) => p.position === 'POR');
  if (!hasGk) {
    const spareGk = ranked.find((p) => p.position === 'POR');
    if (spareGk) {
      bench.pop();
      bench.push(spareGk);
    }
  }
  return bench;
}

/**
 * Arma la alineacion respetando ids elegidos por el usuario.
 * Los puestos no cubiertos se completan automaticamente.
 */
export function buildLineup(
  team: Team,
  config: EngineConfig,
  context: PerformanceContext,
  override?: LineupOverride,
): Lineup {
  if (!override?.starterIds || override.starterIds.length === 0) {
    return buildAutomaticLineup(team, config, context);
  }

  const formation = getFormation(team.tactics.formationId);
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const starters: LineupSlotAssignment[] = [];
  const used = new Set<string>();

  formation.slots.forEach((slot, index) => {
    const id = override.starterIds?.[index];
    const player = id ? byId.get(id) : undefined;
    if (player && isAvailable(player) && !used.has(player.id)) {
      used.add(player.id);
      starters.push({ player, position: slot.position, slot, slotIndex: index });
    }
  });

  // Completa los puestos que quedaron sin jugador valido.
  if (starters.length < formation.slots.length) {
    const remaining = team.players.filter((p) => isAvailable(p) && !used.has(p.id));
    const profile = buildTacticalProfile(team.tactics);
    formation.slots.forEach((slot, index) => {
      if (starters.some((s) => s.slotIndex === index)) return;
      let best: Player | undefined;
      let bestValue = -Infinity;
      for (const player of remaining) {
        if (used.has(player.id)) continue;
        const value = evaluatePerformance(player, slot.position, slot, profile, context, config).expected;
        if (value > bestValue) {
          bestValue = value;
          best = player;
        }
      }
      if (!best) throw new Error(`${team.name}: no se pudo cubrir el puesto ${slot.position}`);
      used.add(best.id);
      starters.push({ player: best, position: slot.position, slot, slotIndex: index });
    });
  }

  starters.sort((a, b) => a.slotIndex - b.slotIndex);

  const benchIds = override.benchIds;
  const rest = team.players.filter((p) => isAvailable(p) && !used.has(p.id));
  const bench = benchIds
    ? benchIds.map((id) => byId.get(id)).filter((p): p is Player => !!p && isAvailable(p) && !used.has(p.id)).slice(0, MAX_BENCH)
    : selectBench(rest, config, buildTacticalProfile(team.tactics), context);

  return { formation, starters, bench };
}
