/**
 * DATOS DE DEMOSTRACION — competicion (secciones 13, 19).
 *
 * Tabla y calendario inventados, con resultados coherentes: los puntos
 * cuadran con partidos jugados y la diferencia de gol cierra.
 */

import type { Fixture, LeagueRow } from '../models/index.ts';
import { CLUBS } from './clubs.ts';

const PRIMERA = CLUBS.filter((c) => c.division === 'Primera División');

type RowSeed = readonly [
  clubId: string,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  form: string,
];

/**
 * Semillas de la tabla: 20 equipos, 14 fechas jugadas.
 *
 * Los numeros cierran como un torneo de verdad: las victorias igualan a las
 * derrotas, los empates son un numero par y los goles a favor del torneo
 * igualan a los goles en contra. `ui-logic.test.ts` lo verifica, asi que si
 * alguien edita esta tabla a mano el test lo agarra.
 */
const SEEDS: readonly RowSeed[] = [
  ['velez', 9, 3, 2, 26, 13, 'VVEVD'],
  ['river', 8, 4, 2, 27, 14, 'VEVVD'],
  ['talleres', 8, 3, 3, 22, 15, 'VVDVE'],
  ['boca', 7, 5, 2, 21, 13, 'EVVEV'],
  ['racing', 7, 4, 3, 23, 17, 'VDVVE'],
  ['estudiantes', 6, 4, 4, 19, 16, 'DVVDV'],
  ['independiente', 6, 5, 3, 18, 15, 'EEVDV'],
  ['lanus', 6, 4, 4, 17, 16, 'VEDVE'],
  ['huracan', 5, 4, 5, 16, 17, 'DVVDD'],
  ['sanlorenzo', 5, 5, 4, 15, 15, 'EDEVV'],
  ['rosario', 5, 4, 5, 18, 18, 'VDDVE'],
  ['argentinos', 5, 4, 5, 14, 15, 'EVDDV'],
  ['belgrano', 4, 6, 4, 15, 17, 'EEDVE'],
  ['newells', 4, 5, 5, 14, 17, 'DEVED'],
  ['defensa', 3, 4, 7, 13, 18, 'DDVEV'],
  ['tigre', 2, 6, 6, 12, 17, 'EDEED'],
  ['gimnasia', 2, 5, 7, 13, 19, 'DEDVE'],
  ['banfield', 2, 4, 8, 11, 20, 'DDEDV'],
  ['platense', 1, 5, 8, 10, 21, 'EDDED'],
  ['godoycruz', 1, 4, 9, 9, 20, 'DDEDD'],
];

export const DEMO_TABLE: readonly LeagueRow[] = SEEDS.map(([clubId, won, drawn, lost, goalsFor, goalsAgainst, form]) => ({
  clubId,
  played: won + drawn + lost,
  won,
  drawn,
  lost,
  goalsFor,
  goalsAgainst,
  points: won * 3 + drawn,
  form: form.split('') as ('V' | 'E' | 'D')[],
}))
  .slice()
  .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));

export const CURRENT_ROUND = 15;
export const SEASON_LABEL = 'Temporada 2026 · Liga Profesional';
export const TODAY = '2026-05-09';

/** Fechas pasadas de River y las proximas del torneo. */
export const DEMO_FIXTURES: readonly Fixture[] = [
  { id: 'fx-11', round: 11, date: '2026-04-12', time: '16:00', homeClubId: 'river', awayClubId: 'banfield', competition: 'Liga Profesional', score: { home: 3, away: 0 } },
  { id: 'fx-12', round: 12, date: '2026-04-19', time: '21:30', homeClubId: 'talleres', awayClubId: 'river', competition: 'Liga Profesional', score: { home: 1, away: 1 } },
  { id: 'fx-13', round: 13, date: '2026-04-26', time: '18:15', homeClubId: 'river', awayClubId: 'sanlorenzo', competition: 'Liga Profesional', score: { home: 2, away: 0 } },
  { id: 'fx-14', round: 14, date: '2026-05-03', time: '20:00', homeClubId: 'velez', awayClubId: 'river', competition: 'Liga Profesional', score: { home: 2, away: 1 } },
  // Proximo partido
  { id: 'fx-15', round: 15, date: '2026-05-12', time: '21:30', homeClubId: 'river', awayClubId: 'racing', competition: 'Liga Profesional', score: null },
  { id: 'fx-16', round: 16, date: '2026-05-17', time: '16:00', homeClubId: 'independiente', awayClubId: 'river', competition: 'Liga Profesional', score: null },
  { id: 'fx-17', round: 17, date: '2026-05-24', time: '17:00', homeClubId: 'river', awayClubId: 'boca', competition: 'Liga Profesional', score: null },
];

/** Ultimos resultados de la fecha anterior, para el widget de competicion. */
export const DEMO_LAST_ROUND: readonly Fixture[] = [
  { id: 'lr-1', round: 14, date: '2026-05-03', time: '20:00', homeClubId: 'velez', awayClubId: 'river', competition: 'Liga Profesional', score: { home: 2, away: 1 } },
  { id: 'lr-2', round: 14, date: '2026-05-03', time: '20:00', homeClubId: 'boca', awayClubId: 'huracan', competition: 'Liga Profesional', score: { home: 1, away: 1 } },
  { id: 'lr-3', round: 14, date: '2026-05-02', time: '19:00', homeClubId: 'racing', awayClubId: 'lanus', competition: 'Liga Profesional', score: { home: 3, away: 1 } },
  { id: 'lr-4', round: 14, date: '2026-05-02', time: '19:00', homeClubId: 'talleres', awayClubId: 'gimnasia', competition: 'Liga Profesional', score: { home: 2, away: 0 } },
  { id: 'lr-5', round: 14, date: '2026-05-04', time: '19:15', homeClubId: 'estudiantes', awayClubId: 'platense', competition: 'Liga Profesional', score: { home: 1, away: 0 } },
];

export const PRIMERA_CLUB_IDS: readonly string[] = PRIMERA.map((c) => c.id);
