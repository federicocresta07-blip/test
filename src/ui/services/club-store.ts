/**
 * QUE CLUB DIRIGE ESTA PARTIDA.
 *
 * Una clave sola en el almacén, con el id del club. Es la cuarta clave de una
 * partida, después de la temporada, el desarrollo y la alineación.
 *
 * ============================================================
 * POR QUE UNA CLAVE APARTE Y NO UN CAMPO DE LA TEMPORADA
 * ============================================================
 *
 * Porque el club NO es parte de la temporada: la sobrevive. `resetSeason`
 * escribe una temporada vacía y `closeSeason` empieza otra, y en las dos el
 * club sigue siendo el mismo. Con el club adentro del guardado de la
 * temporada, reiniciar la temporada convertía a quien dirigía Boca en River
 * sin decir nada. Estaba escrito y probado así antes de encontrarlo.
 *
 * Es también la única fuente de verdad: el club no se guarda en ningún otro
 * lado, así que no hay dos copias que se puedan contradecir.
 *
 * ============================================================
 * COMPATIBILIDAD CON LAS PARTIDAS DE ANTES
 * ============================================================
 *
 * Antes de que se pudiera elegir, todas las partidas eran River. Una partida
 * con temporada guardada y SIN esta clave es una de esas, y `managedClub` la
 * resuelve como River en lugar de preguntar de nuevo: si no, alguien con una
 * carrera empezada se encontraría con el elector de equipo y su club anotado
 * como otro.
 */

import { storage } from './storage.ts';
import { USER_CLUB_ID } from '../data/league.ts';

const CLUB_STORAGE_KEY = 'manager:club:v1';

/** El club anotado en esta partida, o `null` si todavía no se eligió. */
export function readClub(): string | null {
  try {
    const raw = storage().getItem(CLUB_STORAGE_KEY);
    return raw !== null && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

/** Anota el club de esta partida. */
export function writeClub(clubId: string): void {
  storage().setItem(CLUB_STORAGE_KEY, clubId);
}

/**
 * El club dirigido, con el default de siempre.
 *
 * Esto es lo que usa el juego en cada cálculo. Nunca devuelve `null`: una
 * partida sin club es River, que es lo que eran todas. Para saber si HAY que
 * preguntar, `currentTeam` del servicio distingue los dos casos.
 */
export function managedClub(): string {
  return readClub() ?? USER_CLUB_ID;
}
