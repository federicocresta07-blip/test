/**
 * Estado de un equipo durante el partido.
 *
 * El motor no mueve jugadores por la cancha (seccion 28), pero si mantiene
 * quien esta en cancha, cuanto corrio, como esta de fatiga y con que tactica
 * juega en cada momento. Cuando algo de eso cambia (un cambio, una expulsion,
 * una instruccion), las dimensiones del equipo se vuelven a calcular.
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { Lineup } from '../domain/lineup.ts';
import type { Player } from '../domain/player.ts';
import type { FormationSlot } from '../domain/formations.ts';
import type { Position } from '../domain/positions.ts';
import { buildTacticalProfile, type Tactics, type TacticalProfile } from '../domain/tactics.ts';
import type { Team } from '../domain/team.ts';
import { evaluatePerformance, type PerformanceContext, type RatedPlayer } from '../ratings/effective-rating.ts';
import {
  computeTeamStrength,
  resolveSetPieceTakers,
  type TeamStrength,
} from '../ratings/team-strength.ts';
import type { Side } from './chances.ts';
import type { SetPieceTakerSet } from './set-pieces.ts';

export type MutableTeamStats = {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  bigChances: number;
  bigChancesMissed: number;
  saves: number;
  penalties: number;
  setPieceShots: number;
  counterAttackShots: number;
};

export type MutablePlayerStats = {
  player: Player;
  position: Position;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  xg: number;
  chancesCreated: number;
  bigChancesMissed: number;
  saves: number;
  goalsConceded: number;
  yellowCards: number;
  redCard: boolean;
  injured: boolean;
  fouls: number;
  effectiveRating: number;
  wasStarter: boolean;
};

export type LiveTeam = {
  readonly side: Side;
  readonly team: Team;
  readonly lineup: Lineup;
  readonly context: PerformanceContext;
  /** Juega con ventaja de local (seccion 34). En cancha neutral es false. */
  readonly isHome: boolean;
  tactics: Tactics;
  profile: TacticalProfile;
  onField: RatedPlayer[];
  bench: Player[];
  strength: TeamStrength;
  takers: SetPieceTakerSet;
  subsUsed: number;
  menDown: number;
  readonly inMatchFatigue: Map<string, number>;
  /** Minuto en el que entro cada suplente. Los titulares no figuran. */
  readonly enteredAt: Map<string, number>;
  readonly yellowCards: Map<string, number>;
  readonly sentOff: Set<string>;
  readonly stats: MutableTeamStats;
  readonly playerStats: Map<string, MutablePlayerStats>;
  readonly instructionsApplied: Set<number>;
};

export function emptyTeamStats(): MutableTeamStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    bigChances: 0,
    bigChancesMissed: 0,
    saves: 0,
    penalties: 0,
    setPieceShots: 0,
    counterAttackShots: 0,
  };
}

function newPlayerStats(rated: RatedPlayer, wasStarter: boolean): MutablePlayerStats {
  return {
    player: rated.player,
    position: rated.position,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    chancesCreated: 0,
    bigChancesMissed: 0,
    saves: 0,
    goalsConceded: 0,
    yellowCards: 0,
    redCard: false,
    injured: false,
    fouls: 0,
    effectiveRating: rated.rating,
    wasStarter,
  };
}

export function createLiveTeam(
  side: Side,
  team: Team,
  lineup: Lineup,
  rated: RatedPlayer[],
  context: PerformanceContext,
  /** Juega con ventaja de local: false para el visitante y en cancha neutral. */
  isHome: boolean,
  config: EngineConfig,
): LiveTeam {
  const profile = buildTacticalProfile(team.tactics);
  const strength = computeTeamStrength(team, lineup, profile, rated, config);
  const live: LiveTeam = {
    side,
    team,
    lineup,
    context,
    isHome,
    tactics: team.tactics,
    profile,
    onField: rated,
    bench: [...lineup.bench],
    strength,
    takers: resolveSetPieceTakers(team, rated),
    subsUsed: 0,
    menDown: 0,
    inMatchFatigue: new Map(),
    enteredAt: new Map(),
    yellowCards: new Map(),
    sentOff: new Set(),
    stats: emptyTeamStats(),
    playerStats: new Map(),
    instructionsApplied: new Set(),
  };
  for (const r of rated) {
    live.playerStats.set(r.player.id, newPlayerStats(r, true));
    live.inMatchFatigue.set(r.player.id, 0);
  }
  return live;
}

/** Recalcula dimensiones, designados y castigo por jugar con uno menos. */
export function refreshStrength(live: LiveTeam, config: EngineConfig): void {
  const base = computeTeamStrength(live.team, live.lineup, live.profile, live.onField, config);
  live.strength = live.menDown > 0 ? applyNumericalDisadvantage(base, live.menDown, config) : base;
  live.takers = resolveSetPieceTakers(live.team, live.onField);
}

/** Jugar con uno (o dos) menos golpea sobre todo el ataque y el mediocampo. */
export function applyNumericalDisadvantage(
  strength: TeamStrength,
  menDown: number,
  config: EngineConfig,
): TeamStrength {
  const penalty = config.discipline.playerDownPenalty;
  const dimensions = { ...strength.dimensions };
  dimensions.ataque = clamp(dimensions.ataque - penalty.ataque * menDown, 1, 100);
  dimensions.mediocampo = clamp(dimensions.mediocampo - penalty.mediocampo * menDown, 1, 100);
  dimensions.creacion = clamp(dimensions.creacion - penalty.creacion * menDown, 1, 100);
  dimensions.presion = clamp(dimensions.presion - penalty.presion * menDown, 1, 100);
  dimensions.defensa = clamp(dimensions.defensa - penalty.defensa * menDown, 1, 100);
  dimensions.contraataque = clamp(dimensions.contraataque - penalty.contraataque * menDown, 1, 100);
  return { ...strength, dimensions };
}

/** Cambia la tactica en pleno partido (instrucciones condicionales, seccion 47). */
export function changeTactics(live: LiveTeam, tactics: Tactics, config: EngineConfig): void {
  live.tactics = tactics;
  live.profile = buildTacticalProfile(tactics);
  refreshStrength(live, config);
}

/** Califica a un suplente para un puesto concreto. */
export function rateIncomingPlayer(
  live: LiveTeam,
  player: Player,
  position: Position,
  slot: FormationSlot,
  config: EngineConfig,
  rng: Rng,
): RatedPlayer {
  const performance = evaluatePerformance(
    player,
    position,
    slot,
    live.profile,
    live.context,
    config,
    rng,
  );
  return { player, position, slot, performance, rating: performance.effective };
}

/** Mete un suplente por un titular. */
export function substitute(
  live: LiveTeam,
  outgoing: RatedPlayer,
  incoming: Player,
  minute: number,
  config: EngineConfig,
  rng: Rng,
): RatedPlayer {
  const index = live.onField.findIndex((r) => r.player.id === outgoing.player.id);
  const rated = rateIncomingPlayer(live, incoming, outgoing.position, outgoing.slot, config, rng);
  if (index >= 0) live.onField[index] = rated;
  live.bench = live.bench.filter((p) => p.id !== incoming.id);
  live.subsUsed += 1;
  live.inMatchFatigue.set(incoming.id, 0);
  live.enteredAt.set(incoming.id, minute);
  if (!live.playerStats.has(incoming.id)) {
    live.playerStats.set(incoming.id, newPlayerStats(rated, false));
  }
  refreshStrength(live, config);
  return rated;
}

/** Saca a un jugador expulsado. */
export function sendOff(live: LiveTeam, player: RatedPlayer, config: EngineConfig): void {
  live.onField = live.onField.filter((r) => r.player.id !== player.player.id);
  live.sentOff.add(player.player.id);
  live.menDown += 1;
  const stats = live.playerStats.get(player.player.id);
  if (stats) stats.redCard = true;
  refreshStrength(live, config);
}

/** Fatiga que acumula un jugador por minuto en cancha (seccion 37). */
export function fatigueRatePerMinute(
  stamina: number,
  position: Position,
  config: EngineConfig,
): number {
  const base =
    (config.timeline.fatiguePer90 / config.timeline.regularMinutes) *
    (1 - ((stamina - config.performance.leagueAverageRating) / 100) * config.timeline.staminaEffect);
  return base * (position === 'POR' ? config.timeline.goalkeeperFatigueFactor : 1);
}

/** Suma fatiga de partido a los que estan en cancha. */
export function accumulateFatigue(live: LiveTeam, minutes: number, config: EngineConfig): void {
  for (const rated of live.onField) {
    const rate = fatigueRatePerMinute(rated.player.attributes.resistencia, rated.position, config);
    const current = live.inMatchFatigue.get(rated.player.id) ?? 0;
    live.inMatchFatigue.set(rated.player.id, clamp(current + rate * minutes, 0, 100));
  }
}

/** Fatiga total del jugador ahora mismo (la que traia + la del partido). */
export function currentFatigue(live: LiveTeam, rated: RatedPlayer): number {
  return clamp(rated.player.condition.fatigue + (live.inMatchFatigue.get(rated.player.id) ?? 0), 0, 100);
}

/** Rendimiento del jugador ahora, ya descontada la fatiga del partido. */
export function currentRating(live: LiveTeam, rated: RatedPlayer, config: EngineConfig): number {
  const inMatch = live.inMatchFatigue.get(rated.player.id) ?? 0;
  const drop = (inMatch / 100) * config.performance.fatiguePenalty * config.timeline.inMatchFatigueEffect;
  return clamp(rated.rating - drop, 1, 100);
}

/**
 * Fatiga colectiva del equipo en este momento, ponderada por la tarea del
 * puesto: para atacar pesan los que atacan y para defender los que defienden.
 */
export function collectiveFatigue(live: LiveTeam, duty: 'ataque' | 'defensa'): number {
  let num = 0;
  let den = 0;
  for (const rated of live.onField) {
    if (rated.position === 'POR') continue;
    const weight = 0.25 + (duty === 'ataque' ? rated.slot.attackDuty : rated.slot.defenseDuty);
    num += weight * (live.inMatchFatigue.get(rated.player.id) ?? 0);
    den += weight;
  }
  return den > 0 ? num / den : 0;
}
