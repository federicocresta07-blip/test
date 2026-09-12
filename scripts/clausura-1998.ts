/**
 * Estado del dataset del Torneo Clausura 1998 y simulación del cruce
 * disponible.
 *
 * Uso: node scripts/clausura-1998.ts
 */

import {
  CLAUSURA_1998_TABLE,
  clausura1998Club,
  clausura1998Squad,
  missingSquads,
  playableTeams,
  squadProgress,
  velezVsLanus,
} from '../src/data/clausura-1998/index.ts';
import { simulateMatch } from '../src/engine/match-engine.ts';
import { formatMatchSummary } from '../src/presentation/format-match.ts';

const progress = squadProgress();

console.log('\nTORNEO CLAUSURA 1998 — PRIMERA DIVISIÓN ARGENTINA');
console.log('16 de febrero al 8 de junio de 1998 · 19 fechas · 20 equipos\n');

console.log('TABLA FINAL');
console.log('  #   Club                              Pts');
for (const row of CLAUSURA_1998_TABLE) {
  const club = clausura1998Club(row.clubId);
  const squad = clausura1998Squad(row.clubId);
  const mark =
    squad.confidence === 'verificado' ? '✓' : squad.confidence === 'parcial' ? '~' : ' ';
  console.log(
    `  ${String(row.position).padStart(2)}  ${club.name.padEnd(32)} ${String(row.points).padStart(3)}  ${mark} ${
      squad.players.length > 0 ? `${squad.players.length} jugadores` : ''
    }`,
  );
}

console.log(`\n  ✓ plantel verificado   ~ parcial   (sin marca) pendiente`);

console.log(
  `\nESTADO DE LA CARGA: ${progress.verificados} verificados, ${progress.parciales} parciales, ` +
    `${progress.pendientes} pendientes · ${progress.jugadores} jugadores cargados`,
);

const missing = missingSquads();
if (missing.length > 0) {
  console.log(`\nFALTAN ${missing.length} PLANTELES (ver docs/clausura-1998.md para el formato):`);
  for (const entry of missing) {
    console.log(`  ${entry.clubName.padEnd(32)} ${entry.loaded} cargados, faltan ${entry.missing} para poder jugar`);
  }
}

const playable = playableTeams();
console.log(`\nEQUIPOS JUGABLES: ${playable.map((entry) => entry.club.name).join(', ')}`);

for (const entry of playable) {
  console.log(`\n${entry.club.name.toUpperCase()} — DT ${entry.squad.manager ?? 'sin dato'}`);
  for (const player of entry.squad.players) {
    const stats = [
      player.appearances !== undefined ? `${player.appearances} PJ` : '',
      player.goals !== undefined ? `${player.goals} goles` : '',
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `  ${player.position.padEnd(4)} ${player.name.padEnd(24)} ${String(player.estimatedRating).padStart(3)}` +
        (stats ? `   ${stats}` : ''),
    );
  }
}

if (playable.length >= 2) {
  console.log('\n' + '='.repeat(64));
  console.log('SIMULACIÓN: el campeón contra el subcampeón');
  console.log('='.repeat(64));
  const { home, away } = velezVsLanus();
  console.log(formatMatchSummary(simulateMatch({ home, away, seed: 'clausura-1998', importance: 0.9 })));
}
