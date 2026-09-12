/**
 * NOTICIAS DEL TORNEO (secciones 5.4, 13).
 *
 * Igual que los mensajes del cuerpo tecnico, no son datos cargados: salen de
 * lo que paso en la fecha. Una goleada, un puntero nuevo, un goleador que se
 * escapa, una racha, un equipo que no gana mas.
 *
 * La regla es la misma de todo el proyecto: si la noticia no se puede derivar
 * de un hecho del torneo, no existe. Asi nunca dice "River viene golpeado"
 * cuando River gano los ultimos cuatro.
 */

import type { MatchRecord } from '../../competition/season.ts';
import { topScorers, type SeasonTotals } from '../../competition/stats.ts';
import type { TableRow } from '../../competition/table.ts';
import { clubById } from '../data/clubs.ts';

export type NewsItem = {
  readonly id: string;
  /** Fecha del torneo a la que corresponde. */
  readonly round: number;
  readonly kind: 'resultado' | 'tabla' | 'goleador' | 'racha';
  readonly headline: string;
  readonly body: string;
  /** A donde lleva, si hay algo que mirar. */
  readonly route: string | null;
};

/** Diferencia de gol de una goleada que vale como noticia. */
const THRASHING = 3;

function points(value: number): string {
  return `${value} ${value === 1 ? 'punto' : 'puntos'}`;
}

export function seasonNews(
  records: readonly MatchRecord[],
  table: readonly TableRow[],
  totals: SeasonTotals,
  userClubId: string,
): readonly NewsItem[] {
  if (records.length === 0) return [];

  const lastRound = records.reduce((highest, record) => Math.max(highest, record.round), 0);
  const news: NewsItem[] = [];

  // --- Goleadas de la ultima fecha -------------------------------------
  for (const record of records.filter((record) => record.round === lastRound)) {
    const margin = Math.abs(record.homeGoals - record.awayGoals);
    if (margin < THRASHING) continue;
    const winnerId = record.homeGoals > record.awayGoals ? record.homeClubId : record.awayClubId;
    const loserId = record.homeGoals > record.awayGoals ? record.awayClubId : record.homeClubId;
    const winner = clubById(winnerId);
    const loser = clubById(loserId);
    const scorers = record.lines
      .filter((line) => line.goals > 0 && line.clubId === winnerId)
      .map((line) => `${line.playerName}${line.goals > 1 ? ` (${line.goals})` : ''}`);

    news.push({
      id: `goleada-${record.fixtureId}`,
      round: record.round,
      kind: 'resultado',
      headline: `${winner.name} ${Math.max(record.homeGoals, record.awayGoals)} - ${Math.min(record.homeGoals, record.awayGoals)} ${loser.name}`,
      body:
        `${winner.name} pasó por encima a ${loser.name} en la fecha ${record.round}` +
        (winnerId === record.homeClubId ? ' en su cancha' : ' de visitante') +
        `. ${scorers.length > 0 ? `Convirtieron ${scorers.join(', ')}.` : ''}` +
        ` El motor le daba ${Math.round(
          ((winnerId === record.homeClubId
            ? record.projection.homeWin
            : record.projection.awayWin) /
            (record.projection.homeWin + record.projection.draw + record.projection.awayWin)) *
            100,
        )}% de chances antes de empezar.`,
      route: `/competicion/partido/${record.fixtureId}`,
    });
  }

  // --- El puntero -------------------------------------------------------
  const leader = table[0];
  const second = table[1];
  if (leader && leader.played > 0) {
    const club = clubById(leader.clubId);
    const gap = second ? leader.points - second.points : 0;
    news.push({
      id: `puntero-f${lastRound}`,
      round: lastRound,
      kind: 'tabla',
      headline:
        gap === 0 && second
          ? `${club.name} y ${clubById(second.clubId).name} comparten la punta`
          : `${club.name} es el puntero`,
      body:
        `Con ${points(leader.points)} en ${leader.played} ` +
        `${leader.played === 1 ? 'fecha' : 'fechas'} y una diferencia de gol de ` +
        `${leader.goalDifference > 0 ? '+' : ''}${leader.goalDifference}.` +
        (second && gap > 0
          ? ` Le saca ${points(gap)} a ${clubById(second.clubId).name}.`
          : '') +
        (leader.clubId === userClubId ? ' Es tu equipo: la punta se defiende.' : ''),
      route: '/competicion/tabla',
    });
  }

  // --- El goleador ------------------------------------------------------
  const scorers = topScorers(totals, 2);
  const top = scorers[0];
  if (top && top.goals >= 3) {
    const club = clubById(top.clubId);
    const chaser = scorers[1];
    news.push({
      id: `goleador-f${lastRound}`,
      round: lastRound,
      kind: 'goleador',
      headline: `${top.playerName} lleva ${top.goals} goles`,
      // No decimos "el delantero": los acumulados no guardan el puesto, y
      // afirmar uno que no sabemos es justo lo que este proyecto no hace.
      body:
        `Es el goleador del torneo con ${top.goals}, y juega en ${club.name}.` +
        (chaser
          ? ` Lo sigue ${chaser.playerName} (${clubById(chaser.clubId).shortName}) con ${chaser.goals}.`
          : '') +
        (top.clubId === userClubId ? ' Es tuyo: cuidalo.' : ''),
      route: '/competicion/estadisticas',
    });
  }

  // --- Rachas -----------------------------------------------------------
  for (const row of table) {
    if (row.form.length < 3) continue;
    const club = clubById(row.clubId);
    const lastThree = row.form.slice(0, 3);

    if (lastThree.every((result) => result === 'V')) {
      news.push({
        id: `racha-buena-${row.clubId}-f${lastRound}`,
        round: lastRound,
        kind: 'racha',
        headline: `${club.name} ganó los últimos tres`,
        body:
          `Está ${row.position}º con ${points(row.points)} y viene de tres victorias al hilo. ` +
          `${row.goalsFor} goles a favor y ${row.goalsAgainst} en contra en el torneo.` +
          (row.clubId === userClubId ? ' Es tu equipo.' : ''),
        route: `/informacion/rivales/${row.clubId}`,
      });
    } else if (lastThree.every((result) => result === 'D')) {
      news.push({
        id: `racha-mala-${row.clubId}-f${lastRound}`,
        round: lastRound,
        kind: 'racha',
        headline: `${club.name} perdió los últimos tres`,
        body:
          `Está ${row.position}º con ${points(row.points)} y no gana desde hace tres fechas.` +
          (row.clubId === userClubId
            ? ' Es tu equipo: conviene mirar la moral del plantel.'
            : ' Puede ser un buen momento para enfrentarlo.'),
        route: `/informacion/rivales/${row.clubId}`,
      });
    }
  }

  return news;
}
