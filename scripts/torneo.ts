/**
 * Demo del torneo completo: 20 clubes, 19 fechas, todo por el mismo motor.
 *
 * Es la verificacion de la fase 7 del plan de interfaz: antes de construir
 * las pantallas de competicion hay que saber que el torneo da resultados
 * creibles. Imprime la tabla final, los goleadores y un par de controles de
 * coherencia (los puntos cierran, los goles cierran).
 *
 * Uso: npm run torneo [semilla]
 */

import { buildRoundRobin, totalRounds } from '../src/competition/fixtures.ts';
import { playRound, toPlayedMatches, type MatchRecord } from '../src/competition/season.ts';
import { buildTable } from '../src/competition/table.ts';
import { accumulateRound, averageRating, topScorers, EMPTY_TOTALS } from '../src/competition/stats.ts';
import { clubById } from '../src/ui/data/clubs.ts';
import { LEAGUE_CLUB_IDS, leagueTeams, USER_CLUB_ID } from '../src/ui/data/league.ts';

const seed = process.argv[2] ?? 'temporada-2026';

const fixtures = buildRoundRobin(LEAGUE_CLUB_IDS, seed);
const rounds = totalRounds(fixtures);

let teams = leagueTeams();
let records: MatchRecord[] = [];
let totals = EMPTY_TOTALS;
const skipped: string[] = [];

console.log(`\nTorneo de ${LEAGUE_CLUB_IDS.length} clubes — ${rounds} fechas — semilla "${seed}"\n`);

for (let round = 1; round <= rounds; round += 1) {
  const outcome = playRound({
    fixtures,
    round,
    teams,
    userClubId: USER_CLUB_ID,
    seed,
    restDays: 5,
  });
  teams = outcome.teams;
  records = [...records, ...outcome.records];
  totals = accumulateRound(totals, outcome.records);
  for (const entry of outcome.skipped) skipped.push(`fecha ${round}: ${entry.reason}`);

  const own = outcome.records.find((record) => record.userMatch);
  if (own) {
    const home = own.homeClubId === USER_CLUB_ID;
    console.log(
      `  fecha ${String(round).padStart(2)}  ${home ? 'vs' : 'en'} ${clubById(home ? own.awayClubId : own.homeClubId).name.padEnd(22)} ` +
        `${own.homeGoals}-${own.awayGoals} ${home ? '(L)' : '(V)'}`,
    );
  }
}

const table = buildTable(LEAGUE_CLUB_IDS, toPlayedMatches(records), (id) => clubById(id).name);

console.log('\n  #  Club                     PJ   G   E   P    GF   GC   DIF  PTS  Forma');
console.log('  ' + '-'.repeat(78));
for (const row of table) {
  console.log(
    `  ${String(row.position).padStart(2)} ${clubById(row.clubId).name.padEnd(24)} ` +
      `${String(row.played).padStart(2)}  ${String(row.won).padStart(2)}  ${String(row.drawn).padStart(2)}  ${String(row.lost).padStart(2)}   ` +
      `${String(row.goalsFor).padStart(3)}  ${String(row.goalsAgainst).padStart(3)}  ${String(row.goalDifference).padStart(4)}  ${String(row.points).padStart(3)}  ${row.form.join('')}`,
  );
}

console.log('\n  Goleadores');
for (const entry of topScorers(totals, 10)) {
  const average = averageRating(entry);
  console.log(
    `  ${String(entry.goals).padStart(2)}  ${entry.playerName.padEnd(22)} ${clubById(entry.clubId).shortName}` +
      `${average !== null ? `   nota ${average.toFixed(2)}` : ''}`,
  );
}

// --- Controles de coherencia -------------------------------------------
const played = toPlayedMatches(records);
const goalsFor = table.reduce((total, row) => total + row.goalsFor, 0);
const goalsAgainst = table.reduce((total, row) => total + row.goalsAgainst, 0);
const points = table.reduce((total, row) => total + row.points, 0);
const won = table.reduce((total, row) => total + row.won, 0);
const lost = table.reduce((total, row) => total + row.lost, 0);
const drawn = table.reduce((total, row) => total + row.drawn, 0);

console.log('\n  Coherencia');
console.log(`  partidos jugados         ${played.length} de ${fixtures.length}`);
console.log(`  goles a favor = contra   ${goalsFor} = ${goalsAgainst}  ${goalsFor === goalsAgainst ? 'ok' : 'MAL'}`);
console.log(`  victorias = derrotas     ${won} = ${lost}  ${won === lost ? 'ok' : 'MAL'}`);
console.log(`  empates pares            ${drawn}  ${drawn % 2 === 0 ? 'ok' : 'MAL'}`);
console.log(`  puntos = 3V + E          ${points} = ${won * 3 + drawn}  ${points === won * 3 + drawn ? 'ok' : 'MAL'}`);
console.log(`  goles por partido        ${(goalsFor / Math.max(1, played.length)).toFixed(2)}`);
console.log(
  `  reparto L-E-V            ${((played.filter((m) => m.homeGoals > m.awayGoals).length / played.length) * 100).toFixed(1)}% - ` +
    `${((played.filter((m) => m.homeGoals === m.awayGoals).length / played.length) * 100).toFixed(1)}% - ` +
    `${((played.filter((m) => m.homeGoals < m.awayGoals).length / played.length) * 100).toFixed(1)}%`,
);
if (skipped.length > 0) {
  console.log(`\n  Partidos no jugados (${skipped.length}):`);
  for (const entry of skipped.slice(0, 10)) console.log(`    ${entry}`);
}
console.log('');
