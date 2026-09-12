/**
 * TORNEO CLAUSURA 1998 — TABLA FINAL
 *
 * Datos verificados por búsqueda. Lo que pude confirmar y lo que no:
 *
 *   VERIFICADO: los veinte participantes, el puntaje final de cada uno, el
 *   campeón, la cantidad de fechas y las fechas de inicio y cierre.
 *
 *   VERIFICADO SOLO PARA VÉLEZ: ganados, empatados, perdidos y goles
 *   (14-4-1, 39 a favor, 14 en contra). Cierra con sus 46 puntos.
 *
 *   NO VERIFICADO: ganados, empatados, perdidos y goles del resto. Con el
 *   puntaje solo no se puede deducir el reparto entre victorias y empates,
 *   así que esos campos quedan en `null` en lugar de inventarse.
 */

export type HistoricalStandingRow = {
  readonly position: number;
  readonly clubId: string;
  readonly points: number;
  readonly played: number;
  /** `null` cuando el dato no está verificado. */
  readonly won: number | null;
  readonly drawn: number | null;
  readonly lost: number | null;
  readonly goalsFor: number | null;
  readonly goalsAgainst: number | null;
};

export const CLAUSURA_1998_ROUNDS = 19;
export const CLAUSURA_1998_START = '1998-02-16';
export const CLAUSURA_1998_END = '1998-06-08';
export const CLAUSURA_1998_CHAMPION = 'velez';

/**
 * Tabla final. Vélez, Lanús y Gimnasia La Plata clasificaron a la Copa
 * Libertadores 1999 por este torneo; Vélez como campeón.
 */
export const CLAUSURA_1998_TABLE: readonly HistoricalStandingRow[] = [
  { position: 1, clubId: 'velez', points: 46, played: 19, won: 14, drawn: 4, lost: 1, goalsFor: 39, goalsAgainst: 14 },
  { position: 2, clubId: 'lanus', points: 40, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 3, clubId: 'gimnasia', points: 37, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 4, clubId: 'jujuy', points: 32, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 5, clubId: 'sanlorenzo', points: 30, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 6, clubId: 'boca', points: 29, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 7, clubId: 'river', points: 29, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 8, clubId: 'argentinos', points: 28, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 9, clubId: 'newells', points: 28, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 10, clubId: 'independiente', points: 26, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 11, clubId: 'ferro', points: 25, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 12, clubId: 'estudiantes', points: 23, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 13, clubId: 'central', points: 22, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 14, clubId: 'platense', points: 21, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 15, clubId: 'racing', points: 20, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 16, clubId: 'colon', points: 18, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 17, clubId: 'gimnasiatiro', points: 16, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 18, clubId: 'huracan', points: 15, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 19, clubId: 'union', points: 13, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
  { position: 20, clubId: 'espanol', points: 13, played: 19, won: null, drawn: null, lost: null, goalsFor: null, goalsAgainst: null },
];

/** Goleador del torneo: Gustavo Bartelt (Lanús), 13 goles. */
export const CLAUSURA_1998_TOP_SCORER = {
  playerName: 'Gustavo Bartelt',
  clubId: 'lanus',
  goals: 13,
} as const;
