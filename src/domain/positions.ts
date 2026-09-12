/**
 * Posiciones y compatibilidad entre posiciones (seccion 26).
 *
 * La penalizacion por jugar fuera de posicion no es un unico valor: depende
 * de cuan distinta es la posicion asignada respecto de la natural. El modelo
 * usa "niveles de familiaridad" (0 = natural ... 5 = arquero contra jugador
 * de campo) y cada nivel tiene su penalizacion en `engine-config.ts`.
 */

export const POSITIONS = [
  'POR',
  'LD',
  'DFC',
  'LI',
  'MCD',
  'MC',
  'MCO',
  'ED',
  'EI',
  'SD',
  'DC',
] as const;

export type Position = (typeof POSITIONS)[number];

/** Linea del campo a la que pertenece la posicion. */
export type Line = 'POR' | 'DEF' | 'MED' | 'DEL';

/** Flanco natural de la posicion. */
export type Flank = 'izquierda' | 'centro' | 'derecha';

export type PositionMeta = {
  readonly code: Position;
  readonly name: string;
  readonly line: Line;
  /** Profundidad 0 (arco propio) .. 10 (arco rival). Usada por la fuerza por zonas. */
  readonly depth: number;
  /** Amplitud -1 (banda izquierda) .. +1 (banda derecha). */
  readonly width: number;
  readonly flank: Flank;
  readonly isWide: boolean;
};

export const POSITION_META: Readonly<Record<Position, PositionMeta>> = {
  POR: { code: 'POR', name: 'Arquero', line: 'POR', depth: 0, width: 0, flank: 'centro', isWide: false },
  LD: { code: 'LD', name: 'Lateral derecho', line: 'DEF', depth: 2.2, width: 0.9, flank: 'derecha', isWide: true },
  DFC: { code: 'DFC', name: 'Defensor central', line: 'DEF', depth: 2, width: 0, flank: 'centro', isWide: false },
  LI: { code: 'LI', name: 'Lateral izquierdo', line: 'DEF', depth: 2.2, width: -0.9, flank: 'izquierda', isWide: true },
  MCD: { code: 'MCD', name: 'Mediocampista defensivo', line: 'MED', depth: 4, width: 0, flank: 'centro', isWide: false },
  MC: { code: 'MC', name: 'Mediocampista central', line: 'MED', depth: 5, width: 0, flank: 'centro', isWide: false },
  MCO: { code: 'MCO', name: 'Mediocampista ofensivo', line: 'MED', depth: 6.5, width: 0, flank: 'centro', isWide: false },
  ED: { code: 'ED', name: 'Extremo derecho', line: 'DEL', depth: 7.5, width: 0.85, flank: 'derecha', isWide: true },
  EI: { code: 'EI', name: 'Extremo izquierdo', line: 'DEL', depth: 7.5, width: -0.85, flank: 'izquierda', isWide: true },
  SD: { code: 'SD', name: 'Segundo delantero', line: 'DEL', depth: 8.5, width: 0, flank: 'centro', isWide: false },
  DC: { code: 'DC', name: 'Delantero centro', line: 'DEL', depth: 9.5, width: 0, flank: 'centro', isWide: false },
};

/**
 * Nivel de familiaridad entre dos posiciones.
 * 0 natural | 1 muy similar | 2 similar | 3 distinta | 4 ajena | 5 arquero/campo.
 */
export type FamiliarityTier = 0 | 1 | 2 | 3 | 4 | 5;

/** Pares muy similares: cambiar entre ellas cuesta muy poco. */
const TIER_1_PAIRS: readonly (readonly [Position, Position])[] = [
  ['MC', 'MCD'],
  ['MC', 'MCO'],
  ['MCO', 'SD'],
  ['DC', 'SD'],
  ['ED', 'EI'],
  ['LD', 'ED'],
  ['LI', 'EI'],
  ['LD', 'LI'],
];

/** Pares similares: penalizacion moderada. */
const TIER_2_PAIRS: readonly (readonly [Position, Position])[] = [
  ['DFC', 'MCD'],
  ['MCD', 'MCO'],
  ['MC', 'SD'],
  ['MCO', 'ED'],
  ['MCO', 'EI'],
  ['ED', 'SD'],
  ['EI', 'SD'],
  ['ED', 'DC'],
  ['EI', 'DC'],
  ['LD', 'DFC'],
  ['LI', 'DFC'],
  ['LD', 'MCD'],
  ['LI', 'MCD'],
  ['LD', 'EI'],
  ['LI', 'ED'],
];

/** Pares distintos: penalizacion considerable (ej. MC jugando DFC). */
const TIER_3_PAIRS: readonly (readonly [Position, Position])[] = [
  ['MC', 'DFC'],
  ['MC', 'ED'],
  ['MC', 'EI'],
  ['MC', 'DC'],
  ['MCD', 'ED'],
  ['MCD', 'EI'],
  ['MCD', 'SD'],
  ['MCO', 'DC'],
  ['MCO', 'DFC'],
  ['LD', 'MC'],
  ['LI', 'MC'],
  ['LD', 'MCO'],
  ['LI', 'MCO'],
  ['LD', 'SD'],
  ['LI', 'SD'],
  ['DFC', 'SD'],
];

const FAMILIARITY: Record<string, FamiliarityTier> = buildFamiliarityTable();

function key(a: Position, b: Position): string {
  return `${a}>${b}`;
}

function buildFamiliarityTable(): Record<string, FamiliarityTier> {
  const table: Record<string, FamiliarityTier> = {};
  // Por defecto toda combinacion distinta es "ajena".
  for (const a of POSITIONS) {
    for (const b of POSITIONS) {
      table[key(a, b)] = a === b ? 0 : 4;
    }
  }
  // El arco es un mundo aparte en ambos sentidos.
  for (const p of POSITIONS) {
    if (p === 'POR') continue;
    table[key('POR', p)] = 5;
    table[key(p, 'POR')] = 5;
  }
  const apply = (
    pairs: readonly (readonly [Position, Position])[],
    tier: FamiliarityTier,
  ): void => {
    for (const [a, b] of pairs) {
      table[key(a, b)] = tier;
      table[key(b, a)] = tier;
    }
  };
  apply(TIER_3_PAIRS, 3);
  apply(TIER_2_PAIRS, 2);
  apply(TIER_1_PAIRS, 1);
  return table;
}

/** Nivel de familiaridad entre la posicion natural y la asignada. */
export function familiarityTier(natural: Position, assigned: Position): FamiliarityTier {
  return FAMILIARITY[key(natural, assigned)] ?? 4;
}

export function isGoalkeeperPosition(position: Position): boolean {
  return position === 'POR';
}

export function positionsInLine(line: Line): Position[] {
  return POSITIONS.filter((p) => POSITION_META[p].line === line);
}
