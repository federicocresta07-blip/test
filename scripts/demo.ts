/**
 * Demo: simula un partido y muestra todo lo que el motor puede contar.
 * Uso: npm run demo [semilla]
 */

import { simulateMatch } from '../src/engine/match-engine.ts';
import { formatMatchSummary } from '../src/presentation/format-match.ts';
import { racingClub, riverPlate } from '../src/data/sample-teams.ts';

const seed = process.argv[2] ?? 'demo-1';
const result = simulateMatch({ home: riverPlate(), away: racingClub(), seed, importance: 0.6 });
console.log(formatMatchSummary(result));
