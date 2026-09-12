/**
 * Demo del ciclo completo: varias fechas seguidas con evolución del plantel.
 *
 * Muestra lo que hace importante rotar: fatiga, forma, moral, cohesión,
 * lesiones y suspensiones (secciones 35 a 39, 47, 48).
 *
 * Uso: npm run season [fechas] [dias-de-descanso]
 */

import { simulateMatch } from '../src/engine/match-engine.ts';
import { availableCount, updateAfterMatch } from '../src/progression/after-match.ts';
import { formLabel } from '../src/domain/player.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';
import { riverPlate } from '../src/data/sample-teams.ts';

const matches = Number(process.argv[2] ?? 10);
const restDays = Number(process.argv[3] ?? 3);

let team: Team = riverPlate();
const rivals: Team[] = [68, 74, 79, 71, 83].map((target, i) =>
  createTeam({
    id: `rival-${i}`,
    name: `Rival ${i + 1} (${target})`,
    shortName: `R${i + 1}`,
    players: buildSquad({ target, prefix: `R${i + 1}`, seed: `rival-${i}` }),
    chemistry: 62,
    tactics: createTactics({ formationId: i % 2 === 0 ? '4-4-2' : '5-3-2', counterAttack: i % 2 === 1 }),
  }),
);

let points = 0;
let scored = 0;
let conceded = 0;

console.log(`\n${team.name} — ${matches} fechas con ${restDays} días de descanso\n`);
console.log('Fecha  Rival                  Resultado   Pts  Cohesión  Disponibles  Novedades');
console.log('-'.repeat(100));

for (let round = 0; round < matches; round += 1) {
  const rival = rivals[round % rivals.length] as Team;
  const atHome = round % 2 === 0;

  const result = atHome
    ? simulateMatch({ home: team, away: rival, seed: `fecha-${round}` })
    : simulateMatch({ home: rival, away: team, seed: `fecha-${round}` });

  const side = atHome ? 'local' : 'visitante';
  const own = atHome ? result.score.home : result.score.away;
  const rivalGoals = atHome ? result.score.away : result.score.home;

  points += own > rivalGoals ? 3 : own === rivalGoals ? 1 : 0;
  scored += own;
  conceded += rivalGoals;

  const progression = updateAfterMatch({ team, result, side, restDays });
  team = progression.team;

  const news = [...progression.injuries.map((i) => `${i.playerName} (${i.severity}, ${i.daysOut}d)`),
                ...progression.suspensions.map((s) => `${s.playerName} (${s.matches} fecha/s)`)];

  console.log(
    `${String(round + 1).padStart(4)}   ${(atHome ? 'vs ' : 'en ') + rival.name.padEnd(19)}  ${String(own)}-${rivalGoals} ${(atHome ? '(L)' : '(V)').padEnd(6)} ${String(points).padStart(3)}  ${String(progression.chemistryAfter).padStart(6)}    ${String(availableCount(team)).padStart(8)}     ${news.join('; ')}`,
  );
}

console.log('-'.repeat(100));
console.log(`\n${points} puntos en ${matches} fechas  |  goles ${scored}-${conceded}  |  cohesión ${team.chemistry}\n`);

console.log('Estado del plantel al cierre:');
console.log('  Jugador                  Forma         Moral  Fatiga  Estado');
for (const player of [...team.players].sort((a, b) => b.condition.form - a.condition.form)) {
  const status = player.injuryDaysRemaining > 0
    ? `lesionado (${player.injuryDaysRemaining}d)`
    : player.suspensionMatchesRemaining > 0
      ? `suspendido (${player.suspensionMatchesRemaining})`
      : '';
  console.log(
    `  ${player.name.padEnd(24)} ${formLabel(player.condition.form).padEnd(12)} ${String(player.condition.morale).padStart(5)}  ${String(player.condition.fatigue).padStart(6)}  ${status}`,
  );
}
