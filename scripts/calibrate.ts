/**
 * CALIBRACION (seccion 52).
 *
 * Corre miles de partidos y muestra la distribucion de resultados.
 *
 *   npm run calibrate                 -> bateria completa de escenarios
 *   npm run calibrate -- 82 78 20000  -> un cruce puntual de overall contra overall
 *   npm run calibrate -- muestra      -> River Plate vs Racing Club
 */

import { formatCalibrationReport, simulateMany } from '../src/calibration/simulate-many.ts';
import { buildSquad } from '../src/data/squad-builder.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';
import { createTactics } from '../src/domain/tactics.ts';
import { createTeam, type Team } from '../src/domain/team.ts';

function teamOf(target: number, label: string, formationId = '4-3-3'): Team {
  return createTeam({
    id: label,
    name: `${label} (${target})`,
    shortName: label.slice(0, 3).toUpperCase(),
    players: buildSquad({ target, prefix: label, seed: `${label}-${target}` }),
    chemistry: 65,
    tactics: createTactics({ formationId }),
  });
}

const args = process.argv.slice(2);

if (args[0] === 'muestra') {
  const matches = Number(args[1] ?? 10_000);
  console.log(formatCalibrationReport(simulateMany({ home: riverPlate(), away: racingClub(), matches })));
} else if (args.length >= 2) {
  const homeRating = Number(args[0]);
  const awayRating = Number(args[1]);
  const matches = Number(args[2] ?? 10_000);
  console.log(
    formatCalibrationReport(
      simulateMany({
        home: teamOf(homeRating, 'Local'),
        away: teamOf(awayRating, 'Visitante'),
        matches,
      }),
    ),
  );
} else {
  // Bateria de referencia: los escenarios de la seccion 41.
  const scenarios: readonly (readonly [number, number])[] = [
    [82, 82],
    [82, 78],
    [82, 70],
    [82, 60],
    [70, 70],
  ];
  const matches = Number(args[0] ?? 10_000);
  for (const [h, a] of scenarios) {
    const report = simulateMany({
      home: teamOf(h, 'Local'),
      away: teamOf(a, 'Visitante'),
      matches,
    });
    console.log(formatCalibrationReport(report));
    console.log(`\n${'='.repeat(70)}\n`);
  }
}
