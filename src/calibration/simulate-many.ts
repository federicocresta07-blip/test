/**
 * CALIBRACION DEL MOTOR (seccion 52).
 *
 * Corre miles de veces el mismo cruce y devuelve la distribucion de
 * resultados. Es la herramienta para ajustar el equilibrio:
 *
 *   River vs Racing, 10.000 simulaciones
 *   River gana:   48%
 *   Empate:       27%
 *   Racing gana:  25%
 *   Goles promedio River:  1.63
 *   Goles promedio Racing: 1.15
 *
 * Como todos los parametros estan centralizados en `engine-config.ts`, se
 * puede probar una variante pasando `config` y comparar los dos informes.
 */

import type { ConfigOverrides } from '../config/engine-config.ts';
import { round } from '../core/math.ts';
import type { Team } from '../domain/team.ts';
import { simulateMatch } from '../engine/match-engine.ts';
import type { TeamMatchStats } from '../engine/match-types.ts';

export type CalibrationOptions = {
  readonly home: Team;
  readonly away: Team;
  readonly matches?: number;
  readonly seed?: number;
  readonly importance?: number;
  readonly neutralVenue?: boolean;
  readonly config?: ConfigOverrides;
};

export type SideAverages = {
  readonly goals: number;
  readonly xg: number;
  readonly projectedGoals: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly possession: number;
  readonly corners: number;
  readonly fouls: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly bigChances: number;
  readonly saves: number;
  readonly penalties: number;
};

export type CalibrationReport = {
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly matches: number;
  readonly homeWins: number;
  readonly draws: number;
  readonly awayWins: number;
  readonly homeWinPct: number;
  readonly drawPct: number;
  readonly awayWinPct: number;
  readonly home: SideAverages;
  readonly away: SideAverages;
  readonly totalGoalsAverage: number;
  /** Marcadores mas frecuentes, de mayor a menor. */
  readonly topScorelines: readonly { readonly score: string; readonly count: number; readonly pct: number }[];
  /** Distribucion de goles totales del partido. */
  readonly totalGoalsDistribution: readonly { readonly goals: number; readonly pct: number }[];
  /** Porcentaje de partidos con 5 goles o mas (deberia ser bajo, seccion 42). */
  readonly highScoringPct: number;
  /** Porcentaje de 0-0. */
  readonly goallessPct: number;
  /** Probabilidades analiticas promedio que predijo el modelo (seccion 44). */
  readonly predicted: { readonly homeWin: number; readonly draw: number; readonly awayWin: number };
  /** Lesiones por partido (las dos escuadras juntas). */
  readonly injuriesPerMatch: number;
};

type Accumulator = { -readonly [K in keyof SideAverages]: number };

function newAccumulator(): Accumulator {
  return {
    goals: 0,
    xg: 0,
    projectedGoals: 0,
    shots: 0,
    shotsOnTarget: 0,
    possession: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    bigChances: 0,
    saves: 0,
    penalties: 0,
  };
}

function addStats(acc: Accumulator, stats: TeamMatchStats, projectedGoals: number): void {
  acc.goals += stats.goals;
  acc.xg += stats.xg;
  acc.projectedGoals += projectedGoals;
  acc.shots += stats.shots;
  acc.shotsOnTarget += stats.shotsOnTarget;
  acc.possession += stats.possession;
  acc.corners += stats.corners;
  acc.fouls += stats.fouls;
  acc.yellowCards += stats.yellowCards;
  acc.redCards += stats.redCards;
  acc.bigChances += stats.bigChances;
  acc.saves += stats.saves;
  acc.penalties += stats.penalties;
}

function averages(acc: Accumulator, matches: number): SideAverages {
  const d = (v: number, decimals = 2): number => round(v / matches, decimals);
  return {
    goals: d(acc.goals),
    xg: d(acc.xg),
    projectedGoals: d(acc.projectedGoals),
    shots: d(acc.shots, 1),
    shotsOnTarget: d(acc.shotsOnTarget, 1),
    possession: d(acc.possession, 3),
    corners: d(acc.corners, 1),
    fouls: d(acc.fouls, 1),
    yellowCards: d(acc.yellowCards),
    redCards: d(acc.redCards, 3),
    bigChances: d(acc.bigChances, 1),
    saves: d(acc.saves, 1),
    penalties: d(acc.penalties, 3),
  };
}

export function simulateMany(options: CalibrationOptions): CalibrationReport {
  const matches = options.matches ?? 10_000;
  const baseSeed = options.seed ?? 20260101;

  const homeAcc = newAccumulator();
  const awayAcc = newAccumulator();
  const scorelines = new Map<string, number>();
  const totalGoals = new Map<number, number>();
  const predicted = { homeWin: 0, draw: 0, awayWin: 0 };

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let highScoring = 0;
  let goalless = 0;
  let injuries = 0;

  for (let i = 0; i < matches; i += 1) {
    const result = simulateMatch({
      home: options.home,
      away: options.away,
      seed: baseSeed + i,
      importance: options.importance ?? 0.4,
      neutralVenue: options.neutralVenue ?? false,
      config: options.config,
    });

    const { home: hg, away: ag } = result.score;
    if (hg > ag) homeWins += 1;
    else if (hg === ag) draws += 1;
    else awayWins += 1;

    addStats(homeAcc, result.home.stats, result.projection.expectedGoalsHome);
    addStats(awayAcc, result.away.stats, result.projection.expectedGoalsAway);

    predicted.homeWin += result.projection.probabilities.homeWin;
    predicted.draw += result.projection.probabilities.draw;
    predicted.awayWin += result.projection.probabilities.awayWin;

    const key = `${hg}-${ag}`;
    scorelines.set(key, (scorelines.get(key) ?? 0) + 1);
    const total = hg + ag;
    totalGoals.set(total, (totalGoals.get(total) ?? 0) + 1);
    if (total >= 5) highScoring += 1;
    if (total === 0) goalless += 1;
    injuries += result.events.filter((e) => e.type === 'lesion').length;
  }

  const topScorelines = [...scorelines.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([score, count]) => ({ score, count, pct: round((count / matches) * 100, 2) }));

  const totalGoalsDistribution = [...totalGoals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([goals, count]) => ({ goals, pct: round((count / matches) * 100, 2) }));

  return {
    homeTeam: options.home.name,
    awayTeam: options.away.name,
    matches,
    homeWins,
    draws,
    awayWins,
    homeWinPct: round((homeWins / matches) * 100, 2),
    drawPct: round((draws / matches) * 100, 2),
    awayWinPct: round((awayWins / matches) * 100, 2),
    home: averages(homeAcc, matches),
    away: averages(awayAcc, matches),
    totalGoalsAverage: round((homeAcc.goals + awayAcc.goals) / matches, 2),
    topScorelines,
    totalGoalsDistribution,
    highScoringPct: round((highScoring / matches) * 100, 2),
    goallessPct: round((goalless / matches) * 100, 2),
    predicted: {
      homeWin: round((predicted.homeWin / matches) * 100, 2),
      draw: round((predicted.draw / matches) * 100, 2),
      awayWin: round((predicted.awayWin / matches) * 100, 2),
    },
    injuriesPerMatch: round(injuries / matches, 3),
  };
}

/** Informe legible en consola. */
export function formatCalibrationReport(report: CalibrationReport): string {
  const pct = (v: number): string => `${v.toFixed(1).padStart(5)}%`;
  const lines: string[] = [];
  lines.push(`${report.homeTeam} vs ${report.awayTeam} — ${report.matches.toLocaleString('es-AR')} simulaciones`);
  lines.push('');
  lines.push(`  Gana ${report.homeTeam.padEnd(16)} ${pct(report.homeWinPct)}   (modelo: ${report.predicted.homeWin.toFixed(1)}%)`);
  lines.push(`  Empate${''.padEnd(16)} ${pct(report.drawPct)}   (modelo: ${report.predicted.draw.toFixed(1)}%)`);
  lines.push(`  Gana ${report.awayTeam.padEnd(16)} ${pct(report.awayWinPct)}   (modelo: ${report.predicted.awayWin.toFixed(1)}%)`);
  lines.push('');
  lines.push(`  Goles promedio     ${report.home.goals.toFixed(2)} - ${report.away.goals.toFixed(2)}   (total ${report.totalGoalsAverage.toFixed(2)})`);
  lines.push(`  xG promedio        ${report.home.xg.toFixed(2)} - ${report.away.xg.toFixed(2)}`);
  lines.push(`  xG proyectado      ${report.home.projectedGoals.toFixed(2)} - ${report.away.projectedGoals.toFixed(2)}`);
  lines.push(`  Remates            ${report.home.shots.toFixed(1)} - ${report.away.shots.toFixed(1)}`);
  lines.push(`  Al arco            ${report.home.shotsOnTarget.toFixed(1)} - ${report.away.shotsOnTarget.toFixed(1)}`);
  lines.push(`  Posesion           ${(report.home.possession * 100).toFixed(1)}% - ${(report.away.possession * 100).toFixed(1)}%`);
  lines.push(`  Corners            ${report.home.corners.toFixed(1)} - ${report.away.corners.toFixed(1)}`);
  lines.push(`  Faltas             ${report.home.fouls.toFixed(1)} - ${report.away.fouls.toFixed(1)}`);
  lines.push(`  Amarillas          ${report.home.yellowCards.toFixed(2)} - ${report.away.yellowCards.toFixed(2)}`);
  lines.push(`  Rojas              ${report.home.redCards.toFixed(3)} - ${report.away.redCards.toFixed(3)}`);
  lines.push(`  Penales            ${report.home.penalties.toFixed(3)} - ${report.away.penalties.toFixed(3)}`);
  lines.push(`  Atajadas           ${report.home.saves.toFixed(1)} - ${report.away.saves.toFixed(1)}`);
  lines.push(`  Lesiones/partido   ${report.injuriesPerMatch.toFixed(3)}`);
  lines.push('');
  lines.push('  Marcadores mas frecuentes:');
  for (const entry of report.topScorelines) {
    lines.push(`    ${entry.score.padEnd(6)} ${entry.pct.toFixed(2).padStart(6)}%`);
  }
  lines.push('');
  lines.push(`  Partidos 0-0: ${report.goallessPct.toFixed(2)}%    con 5 goles o mas: ${report.highScoringPct.toFixed(2)}%`);
  lines.push('  Goles totales por partido:');
  for (const entry of report.totalGoalsDistribution) {
    if (entry.pct < 0.05) continue;
    const bar = '#'.repeat(Math.round(entry.pct / 2));
    lines.push(`    ${String(entry.goals).padStart(2)} ${entry.pct.toFixed(2).padStart(6)}% ${bar}`);
  }
  return lines.join('\n');
}
