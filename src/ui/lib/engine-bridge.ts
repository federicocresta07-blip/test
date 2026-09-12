/**
 * PUENTE CON EL MOTOR DE SIMULACION.
 *
 * Todo numero futbolistico que muestra la interfaz sale de aca, y aca todo
 * sale del motor: overall por puesto, penalizacion por jugar fuera de
 * posicion (seccion 6.5), metricas del equipo (seccion 6.8) y
 * autoseleccion del once (seccion 6.12).
 *
 * Ningun componente visual calcula futbol por su cuenta.
 */

import { DEFAULT_CONFIG } from '../../config/engine-config.ts';
import { getFormation, type FormationSlot } from '../../domain/formations.ts';
import { buildAutomaticLineup, type Lineup } from '../../domain/lineup.ts';
import type { Player } from '../../domain/player.ts';
import type { Position } from '../../domain/positions.ts';
import { createTeam, type Team } from '../../domain/team.ts';
import { buildTacticalProfile } from '../../domain/tactics.ts';
import { overallForPosition } from '../../ratings/overall.ts';
import { positionalOverall, type PositionFit } from '../../ratings/position-fit.ts';
import type { PerformanceContext, RatedPlayer } from '../../ratings/effective-rating.ts';
import { evaluatePerformance } from '../../ratings/effective-rating.ts';
import { computeTeamStrength } from '../../ratings/team-strength.ts';
import type { DimensionRatings } from '../../domain/dimensions.ts';
import type { ClubPlayer, GameState, LineupSelection } from '../models/index.ts';
import { energyOf } from './ratings.ts';

/** Contexto con el que la interfaz evalua a los jugadores. */
function contextFor(state: GameState): PerformanceContext {
  return {
    isHome: true,
    importance: 0.4,
    chemistry: teamChemistry(state),
  };
}

/**
 * Cohesion del plantel.
 *
 * Sale de la temporada, que es donde la deja la progresion del motor despues
 * de cada partido (seccion 39). Antes se estimaba aca a partir de la moral:
 * eran dos numeros distintos para la misma cosa, y el de la interfaz no era
 * el que el motor usaba para simular.
 */
export function teamChemistry(state: GameState): number {
  return state.season.chemistry;
}

export function slotsOf(formationId: string): readonly FormationSlot[] {
  return getFormation(formationId).slots;
}

/** Overall del jugador en su posicion natural. */
export function naturalOverall(player: Player): number {
  return overallForPosition(player.attributes, player.position);
}

/**
 * Overall natural y overall efectivo en el puesto asignado (seccion 6.5).
 * La penalizacion la calcula el motor.
 */
export function overallInSlot(player: Player, assigned: Position): {
  readonly natural: number;
  readonly effective: number;
  readonly penalty: number;
  readonly label: PositionFit['label'];
  readonly isNatural: boolean;
} {
  const result = positionalOverall(player, assigned, DEFAULT_CONFIG);
  return {
    natural: Math.round(result.natural),
    effective: Math.round(result.effective),
    penalty: result.fit.penalty,
    label: result.fit.label,
    isNatural: result.fit.penalty === 0,
  };
}

/** Construye el equipo del motor a partir del estado de la interfaz. */
export function toEngineTeam(state: GameState, selection: LineupSelection): Team {
  return createTeam({
    id: state.club.id,
    name: state.club.name,
    shortName: state.club.shortName,
    players: state.squad.map((entry) => entry.player),
    chemistry: teamChemistry(state),
    tactics: selection.tactics,
    setPieceTakers: {
      ...(selection.roles.penaltiesId ? { penales: selection.roles.penaltiesId } : {}),
      ...(selection.roles.freeKicksId ? { tirosLibres: selection.roles.freeKicksId } : {}),
      ...(selection.roles.rightCornerId ? { corners: selection.roles.rightCornerId } : {}),
    },
  });
}

/** Metricas del equipo que se muestran junto a la cancha (seccion 6.8). */
export type TeamMetrics = {
  readonly ataque: number;
  readonly mediocampo: number;
  readonly defensa: number;
  readonly arquero: number;
  /** Media del once, solo informativa: no es la explicacion de la fuerza. */
  readonly mediaXI: number;
  readonly cohesion: number;
  /** Condicion fisica media del once, 0..1. */
  readonly condicion: number;
  /** Puestos sin cubrir: mientras haya, las metricas son parciales. */
  readonly missing: number;
};

/**
 * Calcula las metricas del once elegido.
 *
 * Usa `computeTeamStrength` del motor con los jugadores realmente puestos en
 * cada puesto, asi que refleja la penalizacion por fuera de posicion, la
 * forma, la moral y la fatiga. Si faltan puestos por cubrir, calcula con los
 * que hay y avisa cuantos faltan.
 */
export function teamMetrics(state: GameState, selection: LineupSelection): TeamMetrics {
  const slots = slotsOf(selection.formationId);
  const byId = new Map(state.squad.map((entry) => [entry.player.id, entry.player]));
  const context = contextFor(state);
  const profile = buildTacticalProfile(selection.tactics);

  const rated: RatedPlayer[] = [];
  selection.starters.forEach((playerId, index) => {
    const slot = slots[index];
    const player = playerId ? byId.get(playerId) : undefined;
    if (!slot || !player) return;
    const performance = evaluatePerformance(
      player,
      slot.position,
      slot,
      profile,
      context,
      DEFAULT_CONFIG,
    );
    rated.push({ player, position: slot.position, slot, performance, rating: performance.expected });
  });

  const missing = slots.length - rated.length;
  if (rated.length === 0) {
    return {
      ataque: 0, mediocampo: 0, defensa: 0, arquero: 0,
      mediaXI: 0, cohesion: teamChemistry(state), condicion: 0, missing,
    };
  }

  const team = toEngineTeam(state, selection);
  // `computeTeamStrength` solo usa la alineacion para informarla de vuelta,
  // asi que se le pasa una equivalente con los titulares elegidos.
  const lineup: Lineup = {
    formation: getFormation(selection.formationId),
    starters: rated.map((r, index) => ({
      player: r.player,
      position: r.position,
      slot: r.slot,
      slotIndex: index,
    })),
    bench: selection.bench.map((id) => byId.get(id)).filter((p): p is Player => !!p),
  };
  const strength = computeTeamStrength(team, lineup, profile, rated, DEFAULT_CONFIG);

  const mediaXI =
    rated.reduce((total, r) => total + naturalOverall(r.player), 0) / rated.length;
  const condicion =
    rated.reduce((total, r) => total + energyOf(r.player), 0) / (rated.length * 100);

  return {
    ataque: Math.round(strength.dimensions.ataque),
    mediocampo: Math.round(strength.dimensions.mediocampo),
    defensa: Math.round(strength.dimensions.defensa),
    arquero: Math.round(strength.dimensions.arquero),
    mediaXI: Math.round(mediaXI * 10) / 10,
    cohesion: teamChemistry(state),
    condicion,
    missing,
  };
}

/**
 * Fuerza por dimensiones de cualquier equipo del torneo (seccion 30).
 *
 * Arma el once que el motor pondria hoy y lo evalua con el mismo
 * `computeTeamStrength` que decide los partidos. Lo usa la pantalla de
 * rivales: sus fortalezas no son etiquetas escritas a mano, son el calculo
 * que se aplica cuando juegan.
 */
export function teamStrengthOf(
  team: Team,
  importance = 0.5,
): { readonly dimensions: DimensionRatings; readonly formationId: string } {
  const context: PerformanceContext = {
    isHome: true,
    importance,
    chemistry: team.chemistry,
  };
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, context);
  const profile = buildTacticalProfile(team.tactics);
  const rated: RatedPlayer[] = lineup.starters.map((entry) => {
    const performance = evaluatePerformance(
      entry.player,
      entry.position,
      entry.slot,
      profile,
      context,
      DEFAULT_CONFIG,
    );
    return {
      player: entry.player,
      position: entry.position,
      slot: entry.slot,
      performance,
      rating: performance.expected,
    };
  });

  const strength = computeTeamStrength(team, lineup, profile, rated, DEFAULT_CONFIG);
  return { dimensions: strength.dimensions, formationId: team.tactics.formationId };
}

/**
 * AUTOSELECCIONAR XI (seccion 6.12): propone un once y un banco.
 *
 * Usa `buildAutomaticLineup` del motor, que evalua posicion, overall, forma,
 * energia, lesiones y sanciones sin usar azar. Solo PROPONE: quien confirma
 * es el usuario.
 */
export function proposeLineup(
  state: GameState,
  selection: LineupSelection,
): { readonly starters: readonly (string | null)[]; readonly bench: readonly string[] } {
  const team = toEngineTeam(state, selection);
  const lineup = buildAutomaticLineup(team, DEFAULT_CONFIG, contextFor(state));
  return {
    starters: lineup.starters.map((entry) => entry.player.id),
    bench: lineup.bench.map((player) => player.id),
  };
}

/**
 * Al cambiar de formacion hay que redistribuir los slots sin perder la
 * seleccion del usuario (seccion 6.6).
 *
 * Cada titular se reubica en el puesto libre donde menos penalizacion sufra,
 * medido con el motor. Si ya no entra en ninguno, va al banco: nunca se
 * descarta en silencio.
 */
export function remapFormation(
  state: GameState,
  selection: LineupSelection,
  nextFormationId: string,
): { readonly starters: readonly (string | null)[]; readonly bench: readonly string[] } {
  const byId = new Map(state.squad.map((entry) => [entry.player.id, entry.player]));
  const nextSlots = slotsOf(nextFormationId);
  const starters: (string | null)[] = nextSlots.map(() => null);

  const current = selection.starters
    .map((id, index) => ({ id, index }))
    .filter((entry): entry is { id: string; index: number } => entry.id !== null);

  // Se ubica primero a los que tienen menos alternativas buenas: el arquero y
  // los puestos muy especificos.
  const candidates = current
    .map(({ id }) => {
      const player = byId.get(id);
      const options = player
        ? nextSlots.map((slot) => overallInSlot(player, slot.position).effective)
        : [];
      const best = Math.max(0, ...options);
      return { id, player, best, spread: best - Math.min(...(options.length ? options : [0])) };
    })
    .sort((a, b) => b.spread - a.spread);

  const leftOver: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.player) continue;
    let bestIndex = -1;
    let bestValue = -Infinity;
    nextSlots.forEach((slot, index) => {
      if (starters[index] !== null) return;
      const value = overallInSlot(candidate.player as Player, slot.position).effective;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) starters[bestIndex] = candidate.id;
    else leftOver.push(candidate.id);
  }

  return {
    starters,
    bench: [...selection.bench, ...leftOver].slice(0, 9),
  };
}

/** Riesgo de suspension por acumulacion de amarillas. */
export function suspensionRisk(entry: ClubPlayer): boolean {
  return entry.yellowCards >= 4;
}
