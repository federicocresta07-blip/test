/**
 * EXPLICACION DEL RESULTADO (seccion 51).
 *
 * El relato se arma con lo que realmente paso en la simulacion: posesion,
 * remates, xG, ocasiones claras erradas, atajadas, expulsiones, cambios y el
 * mejor jugador. No hay frases sueltas ni texto decorativo: cada oracion se
 * dispara por una condicion numerica del partido.
 */

import type { ControlOutcome } from './control.ts';
import type { MatchEvent, MatchProjection, PlayerMatchStats, TeamMatchReport } from './match-types.ts';
import type { MatchupNote } from './tactical-matchups.ts';

export type NarrativeInput = {
  readonly home: TeamMatchReport;
  readonly away: TeamMatchReport;
  readonly score: { readonly home: number; readonly away: number };
  readonly events: readonly MatchEvent[];
  readonly projection: MatchProjection;
  readonly manOfTheMatch: PlayerMatchStats;
  readonly homeNotes: readonly MatchupNote[];
  readonly awayNotes: readonly MatchupNote[];
  readonly control: ControlOutcome;
};

export function buildNarrative(input: NarrativeInput): string {
  const sentences: string[] = [];

  sentences.push(describeControl(input));

  const tactical = describeTactics(input);
  if (tactical) sentences.push(tactical);

  const efficiency = describeEfficiency(input);
  if (efficiency) sentences.push(efficiency);

  const keeper = describeGoalkeeper(input);
  if (keeper) sentences.push(keeper);

  const incident = describeIncidents(input);
  if (incident) sentences.push(incident);

  const individual = describeIndividual(input);
  if (individual) sentences.push(individual);

  sentences.push(describeConclusion(input));
  return sentences.join(' ');
}

/** Quien manejo el partido: posesion contra peligro generado. */
function describeControl(input: NarrativeInput): string {
  const { home, away } = input;
  const possessionGap = home.stats.possession - away.stats.possession;
  const xgGap = home.stats.xg - away.stats.xg;
  const shotGap = home.stats.shots - away.stats.shots;

  const dominant = possessionGap > 0 ? home : away;
  const dominatedRival = dominant === home ? away : home;
  const dangerous = xgGap > 0 ? home : away;
  const dangerousRival = dangerous === home ? away : home;

  const clearPossession = Math.abs(possessionGap) >= 0.08;
  const clearDanger = Math.abs(xgGap) >= 0.5;

  if (clearPossession && clearDanger && dominant.teamId === dangerous.teamId) {
    return `${dominant.teamName} manejó el partido con ${Math.round(dominant.stats.possession * 100)}% de posesión y generó más peligro (${dominant.stats.xg} goles esperados contra ${dominatedRival.stats.xg}).`;
  }
  if (clearPossession && clearDanger) {
    return `${dominant.teamName} tuvo la pelota (${Math.round(dominant.stats.possession * 100)}%), pero el peligro real lo generó ${dangerous.teamName}, que llegó a ${dangerous.stats.xg} goles esperados contra ${dangerousRival.stats.xg}.`;
  }
  if (clearDanger) {
    return `Con la posesión repartida, ${dangerous.teamName} fue el que llegó con más claridad: ${dangerous.stats.shots} remates y ${dangerous.stats.xg} goles esperados contra ${dangerousRival.stats.xg}.`;
  }
  if (Math.abs(shotGap) >= 5) {
    const shooter = shotGap > 0 ? home : away;
    const rival = shooter === home ? away : home;
    return `Fue un partido parejo en el que ${shooter.teamName} remató mucho más (${shooter.stats.shots} contra ${rival.stats.shots}), pero sin generar ocasiones mejores.`;
  }
  return `Fue un partido equilibrado y de pocas diferencias: ${home.stats.xg} goles esperados para ${home.teamName} y ${away.stats.xg} para ${away.teamName}.`;
}

/** El cruce tactico que mas influyo (seccion 32). */
function describeTactics(input: NarrativeInput): string | undefined {
  const all = [...input.homeNotes, ...input.awayNotes].sort((a, b) => b.magnitude - a.magnitude);
  const best = all[0];
  if (!best || best.magnitude < 0.2) return undefined;
  return `${best.text}.`;
}

/** Quien desaprovecho y quien fue eficaz, comparando goles con xG. */
function describeEfficiency(input: NarrativeInput): string | undefined {
  const lines: string[] = [];
  for (const team of [input.home, input.away]) {
    const diff = team.stats.goals - team.stats.xg;
    if (diff <= -0.9 && team.stats.bigChancesMissed >= 1) {
      lines.push(
        `${team.teamName} tuvo dificultades para convertir: desperdició ${team.stats.bigChancesMissed} ${team.stats.bigChancesMissed === 1 ? 'ocasión clara' : 'ocasiones claras'} y terminó con ${team.stats.goals} ${team.stats.goals === 1 ? 'gol' : 'goles'} para ${team.stats.xg} esperados`,
      );
    } else if (diff >= 0.9) {
      lines.push(
        `${team.teamName} fue muy eficaz y sacó ${team.stats.goals} ${team.stats.goals === 1 ? 'gol' : 'goles'} de ${team.stats.xg} goles esperados`,
      );
    }
  }
  if (lines.length === 0) return undefined;
  return `${lines.join('; ')}.`;
}

/** El arquero, cuando el partido paso por el (seccion 45). */
function describeGoalkeeper(input: NarrativeInput): string | undefined {
  let best: { name: string; saves: number; team: TeamMatchReport } | undefined;
  for (const team of [input.home, input.away]) {
    const keeper = team.players.find((p) => p.position === 'POR' && p.wasStarter);
    if (!keeper) continue;
    if (keeper.saves >= 4 && (!best || keeper.saves > best.saves)) {
      best = { name: keeper.player.name, saves: keeper.saves, team };
    }
  }
  if (!best) return undefined;
  const rival = best.team.teamId === input.home.teamId ? input.away : input.home;
  if (rival.stats.xg < 1.2) return undefined;
  return `${best.name} sostuvo a ${best.team.teamName} con ${best.saves} atajadas.`;
}

/** Expulsiones y lesiones que cambiaron el partido. */
function describeIncidents(input: NarrativeInput): string | undefined {
  const red = input.events.find((e) => e.type === 'roja');
  if (red) {
    const team = red.side === 'local' ? input.home : input.away;
    return `La expulsión de ${red.playerName} al minuto ${red.minute} dejó a ${team.teamName} con uno menos y condicionó el resto del partido.`;
  }
  const injury = input.events.find((e) => e.type === 'lesion' && e.minute <= 60);
  if (injury) {
    const team = injury.side === 'local' ? input.home : input.away;
    return `${team.teamName} perdió a ${injury.playerName} por lesión al minuto ${injury.minute}.`;
  }
  return undefined;
}

/** El que marco la diferencia (seccion 33). */
function describeIndividual(input: NarrativeInput): string | undefined {
  const motm = input.manOfTheMatch;
  if (motm.goals >= 2) {
    return `${motm.player.name} definió el partido con ${motm.goals} goles.`;
  }
  if (motm.goals === 1 && motm.assists >= 1) {
    return `${motm.player.name} fue el más influyente: un gol y ${motm.assists === 1 ? 'una asistencia' : `${motm.assists} asistencias`}.`;
  }
  if (motm.rating >= 7.8) {
    return `El mejor del partido fue ${motm.player.name} (${motm.rating.toFixed(1)}).`;
  }
  return undefined;
}

/** Cierre atado al marcador y a lo que mostro el partido. */
function describeConclusion(input: NarrativeInput): string {
  const { home, away, score } = input;
  const xgGap = home.stats.xg - away.stats.xg;
  const goalGap = score.home - score.away;

  if (goalGap === 0) {
    if (Math.abs(xgGap) >= 1) {
      const better = xgGap > 0 ? home : away;
      return `El empate ${score.home}-${score.away} dejó a ${better.teamName} con la sensación de haber merecido más.`;
    }
    return `El ${score.home}-${score.away} refleja bien lo que fue el partido.`;
  }

  const winner = goalGap > 0 ? home : away;
  const loser = goalGap > 0 ? away : home;
  const winnerHadMoreXg = (goalGap > 0 && xgGap > 0) || (goalGap < 0 && xgGap < 0);
  const margin = Math.abs(goalGap);

  if (!winnerHadMoreXg) {
    return `${winner.teamName} se llevó el partido sin haber sido el que más generó, y ${loser.teamName} se queda con la bronca de haber jugado mejor.`;
  }
  if (margin >= 3) {
    return `La diferencia fue clara y ${winner.teamName} terminó goleando a ${loser.teamName}.`;
  }
  if (Math.abs(xgGap) < 0.6) {
    return `La mayor eficacia de ${winner.teamName} terminó definiendo un partido equilibrado.`;
  }
  return `${winner.teamName} fue superior y el ${score.home}-${score.away} quedó acorde a lo que generó cada uno.`;
}
