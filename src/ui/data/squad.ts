/**
 * EL PLANTEL DEL CLUB QUE DIRIGE EL MANAGER — River Plate, Apertura 1998.
 *
 * Ya no son jugadores inventados. Los veintisiete salen de `EQ003003.PKF`, el
 * archivo de equipos de PC Apertura 6.0, con sus nombres, dorsales, fechas de
 * nacimiento, nacionalidades y los diez atributos que guarda el juego.
 *
 * Los veinte atributos que el motor tiene y PC Futbol no se derivan en
 * `pcf-bridge.ts`, que declara atributo por atributo cual es original y cual
 * derivado.
 *
 * LO QUE NO SALE DEL ARCHIVO, porque el formato no lo guarda:
 * - El CONTRATO. PC Futbol no guarda contratos. Se le pone a todos la misma
 *   fecha, que es la unica opcion honesta: inventar una duracion por jugador
 *   seria fabricar un dato que nadie puede verificar.
 * - El VALOR y el SALARIO, que los calcula `domain/market.ts` desde el nivel,
 *   la edad y el contrato, igual que antes.
 * - La FORMA, la MORAL y la FATIGA, que son estado de partida y no historia.
 */

import type { ClubPlayer } from '../models/index.ts';
import { valuePlayer } from '../../domain/market.ts';
import { apertura98Squad } from '../../data/apertura98.ts';
import { playerFromApertura98 } from '../../data/pcf-bridge.ts';

/** El club del manager. */
export const USER_CLUB = 'river';

/**
 * Contrato uniforme para todos los jugadores del archivo.
 *
 * El Apertura 1998 arranco en agosto del 98, asi que el cierre de la
 * temporada siguiente es una fecha razonable. Es nuestra, no del archivo, y
 * esta puesta en un solo lugar para que se vea que es una sola decision.
 */
export const PCF_CONTRACT_UNTIL = '2000-06-30';

/** Nacionalidad en tres letras, para la ficha. */
const NAT_CODE: Readonly<Record<string, string>> = {
  Argentina: 'ARG', Uruguay: 'URU', Paraguay: 'PAR', Chile: 'CHI',
  Colombia: 'COL', Brasil: 'BRA', Bolivia: 'BOL', Perú: 'PER',
  Venezuela: 'VEN', Ecuador: 'ECU', España: 'ESP', Italia: 'ITA',
  México: 'MEX', Croacia: 'CRO', Yugoslavia: 'YUG', Rumania: 'ROU',
  Armenia: 'ARM', Israel: 'ISR',
};

function natCode(nationality: string | null): string {
  if (!nationality) return 'ARG';
  return NAT_CODE[nationality] ?? nationality.slice(0, 3).toUpperCase();
}

/**
 * El plantel de River del Apertura 98, tal como esta en el archivo.
 *
 * Los dorsales son los del archivo. Cuando el juego no lo poblo, se usa el
 * orden del plantel como numero de ficha y el jugador queda igual: el dorsal
 * no cambia como juega.
 */
export const DEMO_SQUAD: readonly ClubPlayer[] = apertura98Squad(USER_CLUB).map(
  (raw, index) => ({
    player: playerFromApertura98(raw, USER_CLUB),
    shirtNumber: raw.d ?? 40 + index,
    nationality: natCode(raw.nat),
    // El valor y el salario los pone el mercado, no este archivo. Se completan
    // en `withMarketValues`, que es lo que consume la interfaz.
    value: 0,
    salary: 0,
    contractUntil: PCF_CONTRACT_UNTIL,
    yellowCards: 0,
    unhappy: false,
  }),
);

/** Meses de contrato que quedan, para la valuacion de mercado. */
export function contractMonths(contractUntil: string, today: string): number {
  const end = new Date(`${contractUntil}T12:00:00`).getTime();
  const now = new Date(`${today}T12:00:00`).getTime();
  return Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24 * 30.4)));
}

/**
 * El plantel con su valor y su salario de mercado.
 *
 * Los dos salen de `valuePlayer`, asi que la ficha del jugador, el buscador
 * del mercado y la masa salarial de las finanzas dicen el mismo numero. PC
 * Futbol no guarda ni valor ni salario, asi que aca no hay nada que respetar
 * del archivo: los calcula el mercado del juego.
 */
export function withMarketValues(
  squad: readonly ClubPlayer[],
  today: string,
): readonly ClubPlayer[] {
  return squad.map((entry) => {
    const valuation = valuePlayer({
      player: entry.player,
      contractMonths: contractMonths(entry.contractUntil, today),
    });
    return { ...entry, value: valuation.value, salary: valuation.wage };
  });
}
