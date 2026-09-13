/**
 * TORNEO CLAUSURA 1998 — PLANTELES
 *
 * ============================================================
 * DOS CLASES DE DATO, SEPARADAS A PROPÓSITO
 * ============================================================
 *
 * DATO HISTÓRICO (`name`, `position`, `number`, `age`, `appearances`,
 * `goals`, `manager`): sale de una fuente. Si no lo pude verificar, no está.
 *
 * VALORACIÓN (`estimatedRating`, `estimatedTraits`): NO es un dato
 * histórico. El overall y los atributos de un futbolista en escala 1-100 no
 * existen como hecho: son criterio nuestro, hecho a partir de lo que el
 * jugador rindió en ese torneo, de su nivel y de su carrera. Se llaman
 * "estimated" justamente para que nadie los lea como si fueran datos.
 *
 * ============================================================
 * ESTADO DE LA CARGA
 * ============================================================
 *
 * Cada plantel declara su `confidence`. Hoy hay dos verificados de veinte
 * (Vélez y Lanús) y dieciocho pendientes: el resto de la información no está
 * disponible con el acceso a internet de esta sesión, que solo permite
 * búsquedas y no abrir las páginas de referencia.
 *
 * Los pendientes figuran igual, con el plantel vacío. Es a propósito: el
 * hueco tiene que verse en los datos, no quedar escondido.
 *
 * Para completarlos, ver `docs/clausura-1998.md`: explica el formato exacto
 * en que conviene pasar cada plantel.
 */

import type { PartialAttributes } from '../../domain/attributes.ts';
import type { Position } from '../../domain/positions.ts';

export type HistoricalPlayerEntry = {
  // --- Datos históricos ---
  readonly name: string;
  readonly position: Position;
  /** Dorsal, si se conoce. */
  readonly number?: number;
  /** Edad durante el torneo (feb-jun 1998), si se conoce. */
  readonly age?: number;
  readonly secondaryPositions?: readonly Position[];
  readonly appearances?: number;
  readonly goals?: number;

  // --- Valoración nuestra, NO dato histórico ---
  /** Overall estimado 1-100. Criterio nuestro. */
  readonly estimatedRating: number;
  /** Atributos distintivos estimados. Criterio nuestro. */
  readonly estimatedTraits?: PartialAttributes;

  /** Nota libre: para qué se lo recuerda, por qué esta valoración. */
  readonly note?: string;
};

export type SquadConfidence =
  /** El plantel salió de una fuente consultada. */
  | 'verificado'
  /** Parte del plantel verificada; el resto falta. */
  | 'parcial'
  /** Todavía sin datos. */
  | 'pendiente';

export type HistoricalSquad = {
  readonly clubId: string;
  /** Director técnico durante el Clausura 1998. */
  readonly manager: string | null;
  readonly confidence: SquadConfidence;
  /** De dónde salió la información. */
  readonly sources: readonly string[];
  readonly notes?: string;
  readonly players: readonly HistoricalPlayerEntry[];
};

/** Plantel todavía sin cargar. */
function pending(clubId: string, manager: string | null = null, notes?: string): HistoricalSquad {
  return {
    clubId,
    manager,
    confidence: 'pendiente',
    sources: [],
    players: [],
    ...(notes ? { notes } : {}),
  };
}

// ============================================================
// VÉLEZ SARSFIELD — campeón
// ============================================================

const VELEZ: HistoricalSquad = {
  clubId: 'velez',
  manager: 'Marcelo Bielsa',
  confidence: 'verificado',
  sources: [
    'https://velez.com.ar/junta-historica/notas/2023/05/31/104603_velez-campeon-clausura-1998',
  ],
  notes:
    'Campeón con 46 puntos: 14 ganados, 4 empatados, 1 perdido, 39 goles a favor y 14 en contra. ' +
    'Se consagró el 31 de mayo de 1998 ganándole 1-0 a Huracán en el Amalfitani. Quinta estrella del club. ' +
    'Los once que figuran son el equipo titular; el resto del plantel está pendiente. ' +
    'La fuente enumera a los cuatro defensores sin aclarar de qué lado jugaba cada uno, así que el ' +
    'reparto por banda es inferencia nuestra y no dato: figura en la nota de cada jugador.',
  players: [
    {
      name: 'José Luis Chilavert', position: 'POR', age: 32, estimatedRating: 89,
      estimatedTraits: { calidad: 88, tiro: 93, portero: 90 },
      note: 'Arquero goleador, referente del equipo. Pateaba los tiros libres y los penales.',
    },
    {
      name: 'Flavio Zandoná', position: 'DFC', secondaryPositions: ['LD'], estimatedRating: 78,
      estimatedTraits: { agresividad: 80, entradas: 81 },
      note: 'La fuente no aclara el lado. Se le asigna LD como secundaria por inferencia, para ' +
        'que la línea de cuatro se pueda armar sin que nadie juegue fuera de posición.',
    },
    {
      name: 'Sebastián Méndez', position: 'DFC', estimatedRating: 77,
      estimatedTraits: { entradas: 80 },
    },
    {
      name: 'Mauricio Pellegrino', position: 'DFC', age: 26, estimatedRating: 80,
      estimatedTraits: { agresividad: 81, calidad: 82, entradas: 82 },
      note: 'Después jugó en Valencia, Liverpool y Barcelona.',
    },
    {
      name: 'Raúl Cardozo', position: 'LI', estimatedRating: 75,
      estimatedTraits: { resistencia: 80, pase: 76 },
    },
    {
      name: 'Lucas Castromán', position: 'MC', age: 18, estimatedRating: 74,
      estimatedTraits: { calidad: 78, pase: 77 },
      note: 'Juvenil que se afirmó en este equipo. Después jugó en Italia.',
    },
    {
      name: 'Marcelo Gómez', position: 'MCD', estimatedRating: 79,
      estimatedTraits: { pase: 80, entradas: 82 },
    },
    {
      name: 'Fernando Pandolfi', position: 'MC', estimatedRating: 77,
      estimatedTraits: { resistencia: 82, calidad: 81 },
    },
    {
      name: 'Martín Posse', position: 'DC', estimatedRating: 80, goals: 10,
      estimatedTraits: { agresividad: 79, calidad: 82, remate: 83 },
      note: 'Máximo goleador del equipo en el torneo, junto con Camps.',
    },
    {
      name: 'Patricio Camps', position: 'SD', estimatedRating: 79, goals: 10,
      estimatedTraits: { calidad: 78, remate: 82 },
      note: 'Máximo goleador del equipo en el torneo, junto con Posse.',
    },
    {
      name: 'Carlos Cordone', position: 'EI', estimatedRating: 80,
      estimatedTraits: { velocidad: 84, regate: 84 },
    },
  ],
};

// ============================================================
// LANÚS — subcampeón
// ============================================================

const LANUS: HistoricalSquad = {
  clubId: 'lanus',
  manager: 'Roberto Mario Gómez',
  confidence: 'verificado',
  sources: ['https://pasiongranate.com.ar/torneo-clausura-1998/'],
  notes:
    'Subcampeón con 40 puntos, a seis de Vélez. Gustavo Bartelt fue el goleador del torneo con 13 goles. ' +
    'Rodrigo Burela y Lucas Alessandria jugaron los 19 partidos. Después del torneo el plantel se desarmó: ' +
    'Bartelt a la Roma, Kmet al Sporting de Lisboa, Siviero al Mallorca y Mallorca compró el 50% de Ibagaza. ' +
    'Los once titulares están verificados; el resto del plantel está pendiente. Ariel Ibagaza integraba ' +
    'el plantel (por la venta posterior), pero no figura entre los titulares y por eso todavía no está cargado. ' +
    'Como con Vélez, la fuente da una línea de cuatro y un mediocampo de cuatro sin aclarar lados. El reparto ' +
    'por banda que figura abajo es inferencia nuestra a partir del orden en que los enumera la fuente ' +
    '(de derecha a izquierda), y está anotado jugador por jugador.',
  players: [
    {
      name: 'Rodrigo Burela', position: 'POR', appearances: 19, estimatedRating: 76,
      estimatedTraits: { calidad: 78, portero: 78 },
      note: 'Jugó los 19 partidos del torneo.',
    },
    {
      name: 'Juan José Serrizuela', position: 'DFC', secondaryPositions: ['LD'], age: 34, estimatedRating: 76,
      estimatedTraits: { calidad: 81, entradas: 80 },
      note: 'Defensor experimentado, con paso previo por River y Boca. La fuente lo enumera primero entre ' +
        'los cuatro defensores; se le asigna LD como secundaria por inferencia.',
    },
    {
      name: 'Lucas Alessandria', position: 'DFC', appearances: 19, estimatedRating: 74,
      estimatedTraits: { agresividad: 77, entradas: 77 },
      note: 'Jugó los 19 partidos del torneo.',
    },
    {
      name: 'Gustavo Siviero', position: 'DFC', estimatedRating: 77,
      estimatedTraits: { entradas: 79 },
      note: 'Vendido al Mallorca después del torneo.',
    },
    {
      name: 'Gabriel Ramón', position: 'LI', estimatedRating: 73,
      estimatedTraits: { resistencia: 79, pase: 74 },
    },
    {
      name: 'Juan Fernández', position: 'ED', secondaryPositions: ['LD'], estimatedRating: 73,
      estimatedTraits: { velocidad: 76, resistencia: 78, pase: 75 },
      note: 'La fuente lo enumera entre los cuatro mediocampistas y en primer lugar, así que se lo ubica ' +
        'como volante por derecha. Es inferencia, no dato.',
    },
    {
      name: 'Daniel Cravero', position: 'MCD', estimatedRating: 75,
      estimatedTraits: { entradas: 78 },
    },
    {
      name: 'Julián Kmet', position: 'MC', estimatedRating: 78,
      estimatedTraits: { calidad: 79, pase: 81 },
      note: 'Vendido al Sporting de Lisboa después del torneo.',
    },
    {
      name: 'Leonardo Mas', position: 'EI', secondaryPositions: ['MC'], estimatedRating: 75,
      estimatedTraits: { calidad: 79, pase: 76 },
      note: 'Último de los cuatro mediocampistas en el orden de la fuente, por eso se lo ubica por la ' +
        'izquierda. Es inferencia, no dato.',
    },
    {
      name: 'Gustavo Bartelt', position: 'DC', age: 21, estimatedRating: 82, goals: 13,
      estimatedTraits: { velocidad: 81, calidad: 84, remate: 86, tiro: 82 },
      note: 'Goleador del torneo con 13 goles. Vendido a la Roma en 6,5 millones de dólares.',
    },
    {
      name: 'Gonzalo Belloso', position: 'SD', estimatedRating: 78,
      estimatedTraits: { calidad: 78, remate: 80 },
    },
  ],
};

// ============================================================
// PENDIENTES
// ============================================================
//
// Lo que sí pude verificar de algunos, aunque falte el plantel:

const RIVER = pending(
  'river',
  'Ramón Díaz',
  'Séptimo con 29 puntos. Enzo Francescoli se había retirado al final de 1997, así que NO integró ' +
    'este plantel: es un error frecuente ubicarlo acá. Plantel pendiente.',
);

const BOCA = pending(
  'boca',
  'Héctor Veira',
  'Sexto con 29 puntos. Lo dirigió Héctor "Bambino" Veira, que se fue antes del final del torneo; ' +
    'las últimas seis fechas las dirigió Carlos García Cambón, técnico de la Reserva. ' +
    'ATENCIÓN: Carlos Bianchi firmó el 27 de mayo de 1998, DESPUÉS de este torneo. El equipo de ' +
    'Riquelme, Palermo y Barros Schelotto con los 20 goles de Palermo es el del Apertura 1998, ' +
    'no el de este Clausura. Plantel pendiente.',
);

const GIMNASIA = pending(
  'gimnasia',
  null,
  'Tercero con 37 puntos, el mejor puntaje de su historia sumado al Apertura 97 (69 puntos en la ' +
    'temporada). Plantel pendiente.',
);

/** Los veinte planteles, en el orden de la tabla final. */
export const CLAUSURA_1998_SQUADS: readonly HistoricalSquad[] = [
  VELEZ,
  LANUS,
  GIMNASIA,
  pending('jujuy'),
  pending('sanlorenzo'),
  BOCA,
  RIVER,
  pending('argentinos'),
  pending('newells'),
  pending('independiente'),
  pending('ferro'),
  pending('estudiantes'),
  pending('central'),
  pending('platense'),
  pending('racing'),
  pending('colon'),
  pending('gimnasiatiro'),
  pending('huracan'),
  pending('union'),
  pending('espanol'),
];

const BY_CLUB = new Map(CLAUSURA_1998_SQUADS.map((squad) => [squad.clubId, squad]));

export function clausura1998Squad(clubId: string): HistoricalSquad {
  const found = BY_CLUB.get(clubId);
  if (!found) throw new Error(`No hay plantel cargado para: ${clubId}`);
  return found;
}

/** Cuántos planteles están completos, a medias y sin cargar. */
export function squadProgress(): {
  readonly verificados: number;
  readonly parciales: number;
  readonly pendientes: number;
  readonly jugadores: number;
  readonly total: number;
} {
  return {
    verificados: CLAUSURA_1998_SQUADS.filter((s) => s.confidence === 'verificado').length,
    parciales: CLAUSURA_1998_SQUADS.filter((s) => s.confidence === 'parcial').length,
    pendientes: CLAUSURA_1998_SQUADS.filter((s) => s.confidence === 'pendiente').length,
    jugadores: CLAUSURA_1998_SQUADS.reduce((total, s) => total + s.players.length, 0),
    total: CLAUSURA_1998_SQUADS.length,
  };
}
