/**
 * CAMBIOS AUTOMATICOS (seccion 47).
 *
 * La IA decide los cambios mirando fatiga, rendimiento, lesiones y resultado.
 * Esto es lo que hace que los suplentes y la profundidad del plantel importen
 * (seccion 48): un equipo con once cracks y un banco flojo paga los ultimos
 * veinte minutos.
 *
 * Tambien aplica las instrucciones condicionales del usuario
 * ("si voy perdiendo al minuto 60, pasar a ofensiva").
 */

import type { EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import type { Rng } from '../core/rng.ts';
import type { Player } from '../domain/player.ts';
import { POSITION_META } from '../domain/positions.ts';
import type { RatedPlayer } from '../ratings/effective-rating.ts';
import { evaluatePerformance } from '../ratings/effective-rating.ts';
import {
  changeTactics,
  currentFatigue,
  currentRating,
  substitute,
  type LiveTeam,
} from './live-team.ts';

export type SubstitutionDecision = {
  readonly outgoing: RatedPlayer;
  readonly incoming: Player;
  readonly reason: 'fatiga' | 'rendimiento' | 'tactico' | 'lesion' | 'calidad';
};

/** Cuantos cambios puede hacer todavia. */
export function remainingSubs(live: LiveTeam, config: EngineConfig): number {
  return Math.max(0, config.substitutions.maxSubs - live.subsUsed);
}

/** Mejor suplente disponible para un puesto. */
export function bestReplacement(
  live: LiveTeam,
  outgoing: RatedPlayer,
  config: EngineConfig,
): { player: Player; expected: number } | undefined {
  let best: { player: Player; expected: number } | undefined;
  const needsGoalkeeper = outgoing.position === 'POR';
  for (const candidate of live.bench) {
    const isGoalkeeper = candidate.position === 'POR';
    // Un arquero solo entra por el arquero, y nunca al reves si hay alternativa.
    if (needsGoalkeeper !== isGoalkeeper) continue;
    const expected = evaluatePerformance(
      candidate,
      outgoing.position,
      outgoing.slot,
      live.profile,
      live.context,
      config,
    ).expected;
    if (!best || expected > best.expected) best = { player: candidate, expected };
  }
  if (!best && needsGoalkeeper) {
    // Sin arquero suplente entra un jugador de campo (con toda la penalizacion).
    for (const candidate of live.bench) {
      const expected = evaluatePerformance(
        candidate,
        outgoing.position,
        outgoing.slot,
        live.profile,
        live.context,
        config,
      ).expected;
      if (!best || expected > best.expected) best = { player: candidate, expected };
    }
  }
  return best;
}

/** Cambio forzado por lesion o expulsion del arquero. */
export function forcedSubstitution(
  live: LiveTeam,
  outgoing: RatedPlayer,
  minute: number,
  config: EngineConfig,
  rng: Rng,
): SubstitutionDecision | undefined {
  if (remainingSubs(live, config) <= 0) return undefined;
  const replacement = bestReplacement(live, outgoing, config);
  if (!replacement) return undefined;
  substitute(live, outgoing, replacement.player, minute, config, rng);
  return { outgoing, incoming: replacement.player, reason: 'lesion' };
}

/**
 * Ventana de cambios: evalua a los once y devuelve los cambios realizados.
 * `scoreDiff` es a favor del equipo evaluado.
 */
export function evaluateSubstitutionWindow(
  live: LiveTeam,
  minute: number,
  scoreDiff: number,
  config: EngineConfig,
  rng: Rng,
): SubstitutionDecision[] {
  const decisions: SubstitutionDecision[] = [];
  const cfg = config.substitutions;
  let allowedThisWindow = 2;
  // Un jugador que acaba de entrar no vuelve a salir: nada de cadenas de cambios.
  const alreadyTouched = new Set<string>();

  while (allowedThisWindow > 0 && remainingSubs(live, config) > 0 && live.bench.length > 0) {
    let bestCase:
      | { outgoing: RatedPlayer; incoming: Player; gain: number; reason: SubstitutionDecision['reason'] }
      | undefined;

    for (const rated of live.onField) {
      // Al arquero no se lo cambia por rendimiento.
      if (rated.position === 'POR') continue;
      if (alreadyTouched.has(rated.player.id)) continue;
      // Recien entro: hay que darle unos minutos antes de pensar en sacarlo.
      const enteredAt = live.enteredAt.get(rated.player.id);
      if (enteredAt !== undefined && minute - enteredAt < cfg.minMinutesBeforeReplacing) continue;

      const fatigue = currentFatigue(live, rated);
      const now = currentRating(live, rated, config);

      // Urgencia por fatiga: cuanto mas fundido, mas vale refrescar el puesto.
      const fatigueUrgency =
        fatigue > cfg.fatigueThreshold
          ? ((fatigue - cfg.fatigueThreshold) / (100 - cfg.fatigueThreshold)) * 9
          : 0;

      // Urgencia por rendimiento: el que esta jugando mal sale.
      const performanceUrgency = now < rated.performance.baseOverall - 6 ? 2.5 : 0;

      // Urgencia tactica segun el resultado.
      const meta = POSITION_META[rated.position];
      let tacticalUrgency = 0;
      if (scoreDiff < 0 && minute >= 65) {
        // Perdiendo: sale un defensivo para meter gente de ataque.
        tacticalUrgency = (1 - rated.slot.attackDuty) * 3.5;
      } else if (scoreDiff > 0 && minute >= 75) {
        // Ganando: salen los mas ofensivos y los mas cansados.
        tacticalUrgency = rated.slot.attackDuty * 2 + (meta.line === 'DEL' ? 1 : 0);
      }

      const urgency = fatigueUrgency + performanceUrgency + tacticalUrgency;
      const replacement = bestReplacement(live, rated, config);
      if (!replacement) continue;

      // No se cambia si el suplente es mucho peor, salvo urgencia real.
      const gain = replacement.expected + urgency - now - 1;
      if (replacement.expected < now - cfg.qualityDropTolerance && fatigue < 90) continue;
      if (gain <= 0) continue;

      // La razon es la que mas empujo el cambio; si ninguna empujo, el cambio
      // se hace simplemente porque el suplente es mejor para ese puesto.
      const maxUrgency = Math.max(fatigueUrgency, performanceUrgency, tacticalUrgency);
      const reason: SubstitutionDecision['reason'] =
        maxUrgency < 0.5
          ? 'calidad'
          : fatigueUrgency === maxUrgency
            ? 'fatiga'
            : tacticalUrgency === maxUrgency
              ? 'tactico'
              : 'rendimiento';

      if (!bestCase || gain > bestCase.gain) {
        bestCase = { outgoing: rated, incoming: replacement.player, gain, reason };
      }
    }

    if (!bestCase) break;
    substitute(live, bestCase.outgoing, bestCase.incoming, minute, config, rng);
    decisions.push({ outgoing: bestCase.outgoing, incoming: bestCase.incoming, reason: bestCase.reason });
    alreadyTouched.add(bestCase.outgoing.player.id);
    alreadyTouched.add(bestCase.incoming.id);
    allowedThisWindow -= 1;
  }

  return decisions;
}

/**
 * Aplica las instrucciones condicionales del usuario (seccion 47).
 * Devuelve las etiquetas de las que se activaron.
 */
export function applyConditionalInstructions(
  live: LiveTeam,
  minute: number,
  scoreDiff: number,
  config: EngineConfig,
): string[] {
  const applied: string[] = [];
  live.team.instructions.forEach((instruction, index) => {
    if (live.instructionsApplied.has(index)) return;
    if (minute < instruction.minute) return;

    const matches =
      instruction.when === 'siempre' ||
      (instruction.when === 'perdiendo' && scoreDiff < 0) ||
      (instruction.when === 'ganando' && scoreDiff > 0) ||
      (instruction.when === 'empatando' && scoreDiff === 0);
    if (!matches) return;

    live.instructionsApplied.add(index);
    changeTactics(live, { ...live.tactics, ...instruction.changes }, config);
    applied.push(instruction.label ?? describeChanges(instruction.changes));
  });
  return applied;
}

function describeChanges(changes: Record<string, unknown>): string {
  const parts = Object.entries(changes).map(([key, value]) => `${key}: ${String(value)}`);
  return `ajuste tactico (${parts.join(', ')})`;
}

/** Intensidad del partido, usada para el riesgo de lesion (seccion 38). */
export function matchIntensity(a: LiveTeam, b: LiveTeam): number {
  return clamp(
    (a.profile.pressing + b.profile.pressing) / 2 * 0.5 +
      (a.profile.tempo + b.profile.tempo) / 2 * 0.3 +
      (a.profile.aggression + b.profile.aggression) / 2 * 0.2,
    0,
    1,
  );
}
