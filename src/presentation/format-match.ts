/**
 * PRESENTACION DEL PARTIDO (secciones 28, 50, 51).
 *
 * En esta version no hay partido 2D ni 3D: el usuario ve el marcador y
 * despues consulta las estadisticas. Este modulo arma esas vistas de texto,
 * listas para consola o para adaptar a la interfaz.
 */

import type { MatchResult, PlayerMatchStats, TeamMatchReport } from '../engine/match-types.ts';
import { DIMENSIONS } from '../domain/dimensions.ts';

/** "RIVER PLATE 2 - 1 RACING CLUB" */
export function formatScoreboard(result: MatchResult): string {
  return result.scoreline;
}

const TABLE_WIDTH = 52;

/** Una fila: valor local | etiqueta centrada | valor visitante. */
function row(label: string, homeValue: string, awayValue: string): string {
  const centered = center(label, TABLE_WIDTH - 16);
  return `${homeValue.padStart(8)}${centered}${awayValue.padEnd(8)}`;
}

function center(text: string, width: number): string {
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return ' '.repeat(left) + text + ' '.repeat(width - text.length - left);
}

/** Tabla comparativa de estadisticas del partido (seccion 50). */
export function formatStatsTable(result: MatchResult): string {
  const h = result.home.stats;
  const a = result.away.stats;
  const lines: string[] = [];
  lines.push(`${result.home.teamName.padEnd(TABLE_WIDTH - result.away.teamName.length)}${result.away.teamName}`);
  lines.push('-'.repeat(TABLE_WIDTH));
  lines.push(row('GOLES', String(h.goals), String(a.goals)));
  lines.push(row('POSESIÓN', `${Math.round(h.possession * 100)}%`, `${Math.round(a.possession * 100)}%`));
  lines.push(row('REMATES', String(h.shots), String(a.shots)));
  lines.push(row('REMATES AL ARCO', String(h.shotsOnTarget), String(a.shotsOnTarget)));
  lines.push(row('xG', h.xg.toFixed(2), a.xg.toFixed(2)));
  lines.push(row('OCASIONES CLARAS', String(h.bigChances), String(a.bigChances)));
  lines.push(row('CORNERS', String(h.corners), String(a.corners)));
  lines.push(row('FALTAS', String(h.fouls), String(a.fouls)));
  lines.push(row('AMARILLAS', String(h.yellowCards), String(a.yellowCards)));
  lines.push(row('ROJAS', String(h.redCards), String(a.redCards)));
  lines.push(row('ATAJADAS', String(h.saves), String(a.saves)));
  return lines.join('\n');
}

/** Goles, asistencias, tarjetas y lesiones del partido (seccion 50). */
export function formatEvents(result: MatchResult): string {
  const relevant = result.events.filter((e) =>
    e.type === 'gol' || e.type === 'amarilla' || e.type === 'roja' || e.type === 'lesion' ||
    e.type === 'cambio' || e.type === 'penal errado' || e.type === 'instruccion',
  );
  if (relevant.length === 0) return '  (sin incidencias)';
  return relevant
    .map((e) => {
      const side = e.side === 'local' ? result.home.shortName : result.away.shortName;
      return `  ${String(e.minute).padStart(3)}'  ${side.padEnd(4)} ${e.detail}`;
    })
    .join('\n');
}

/** Notas individuales ordenadas de mejor a peor (seccion 50). */
export function formatPlayerRatings(report: TeamMatchReport): string {
  const lines: string[] = [`${report.teamName} (${report.initialTactics.formationId})`];
  const sorted = [...report.players].sort((a, b) => b.rating - a.rating);
  for (const p of sorted) {
    lines.push(`  ${formatPlayerLine(p)}`);
  }
  return lines.join('\n');
}

function formatPlayerLine(p: PlayerMatchStats): string {
  const badges: string[] = [];
  if (p.goals > 0) badges.push(`${p.goals} gol${p.goals > 1 ? 'es' : ''}`);
  if (p.assists > 0) badges.push(`${p.assists} asist.`);
  if (p.saves > 0) badges.push(`${p.saves} atajadas`);
  if (p.yellowCards > 0) badges.push('amarilla');
  if (p.redCard) badges.push('ROJA');
  if (p.injured) badges.push('lesionado');
  const extra = badges.length > 0 ? `  — ${badges.join(', ')}` : '';
  return `${p.rating.toFixed(1)}  ${p.position.padEnd(4)} ${p.player.name.padEnd(22)} ${String(p.minutesPlayed).padStart(3)}'${extra}`;
}

/** Fuerza por dimensiones del equipo en el partido (seccion 30). */
export function formatDimensions(report: TeamMatchReport): string {
  const lines: string[] = [`${report.teamName}`];
  for (const dimension of DIMENSIONS) {
    const value = Math.round(report.dimensions[dimension]);
    const bar = '#'.repeat(Math.round(value / 4));
    lines.push(`  ${dimension.toUpperCase().padEnd(13)} ${String(value).padStart(3)}  ${bar}`);
  }
  return lines.join('\n');
}

/** Vista completa del partido. */
export function formatMatchSummary(result: MatchResult): string {
  const sections: string[] = [];
  sections.push(`\n${'='.repeat(64)}`);
  sections.push(formatScoreboard(result));
  sections.push('='.repeat(64));
  sections.push('');
  sections.push(formatStatsTable(result));
  sections.push('');
  sections.push('INCIDENCIAS');
  sections.push(formatEvents(result));
  sections.push('');
  sections.push('MEJOR JUGADOR');
  sections.push(
    `  ${result.manOfTheMatch.player.name} (${result.manOfTheMatch.position}) — nota ${result.manOfTheMatch.rating.toFixed(1)}`,
  );
  sections.push('');
  sections.push('NOTAS INDIVIDUALES');
  sections.push(formatPlayerRatings(result.home));
  sections.push('');
  sections.push(formatPlayerRatings(result.away));
  sections.push('');
  sections.push('FUERZA POR DIMENSIONES');
  sections.push(formatDimensions(result.home));
  sections.push('');
  sections.push(formatDimensions(result.away));
  sections.push('');
  sections.push('PROYECCIÓN PREVIA DEL MOTOR');
  sections.push(
    `  Goles esperados: ${result.projection.expectedGoalsHome.toFixed(2)} - ${result.projection.expectedGoalsAway.toFixed(2)}`,
  );
  sections.push(
    `  Probabilidades: ${result.home.shortName} ${(result.projection.probabilities.homeWin * 100).toFixed(1)}% | ` +
      `empate ${(result.projection.probabilities.draw * 100).toFixed(1)}% | ` +
      `${result.away.shortName} ${(result.projection.probabilities.awayWin * 100).toFixed(1)}%`,
  );
  sections.push('');
  sections.push('QUÉ PASÓ EN EL PARTIDO');
  sections.push(wrap(result.narrative, 64, '  '));
  return sections.join('\n');
}

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    if (current.length + word.length + 1 > width && current.trim().length > 0) {
      lines.push(current);
      current = indent;
    }
    current += (current === indent ? '' : ' ') + word;
  }
  if (current.trim().length > 0) lines.push(current);
  return lines.join('\n');
}
