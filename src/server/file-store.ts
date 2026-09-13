/**
 * LA PARTIDA GUARDADA EN DISCO (fase 8).
 *
 * Un `KeyValueStore` respaldado por un archivo JSON por partida. Es la pieza
 * que hace que una partida sobreviva al navegador: hasta la fase 8 todo vivia
 * en `localStorage`, asi que borrar los datos del sitio o cambiar de maquina
 * era perder la carrera.
 *
 * POR QUE ARCHIVOS Y NO UNA BASE DE DATOS. Porque la forma del dato no la pide:
 * una partida es un puñado de claves y su valor es un JSON que ya sabemos
 * serializar. Una base agregaria una dependencia, un proceso que levantar y un
 * esquema que migrar para guardar exactamente lo mismo. Cuando haga falta
 * consultar A TRAVES de las partidas —una tabla de posiciones entre managers,
 * por ejemplo— ahi si hara falta, y el limite para cambiarlo es esta interfaz.
 *
 * ESCRITURA ATOMICA. Se escribe a un archivo temporal y se renombra. Un
 * `writeFile` directo que se corta a la mitad deja el JSON partido y la
 * partida ilegible; el renombrado es atomico en el sistema de archivos, asi
 * que o esta la version vieja o esta la nueva, nunca media.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { KeyValueStore } from '../ui/services/storage.ts';

/** Nombre de partida valido: sin barras ni puntos, para no salir de la carpeta. */
const VALID_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidGameId(id: string): boolean {
  return VALID_ID.test(id);
}

export type FileStore = KeyValueStore & {
  /** Vuelca a disco lo que se escribio. */
  readonly flush: () => void;
};

/**
 * El almacen de una partida.
 *
 * Lee el archivo una vez al abrirse y escribe cuando se le pide. El servidor
 * abre uno por peticion, hace su trabajo y vuelca: asi dos peticiones de la
 * misma partida no se pisan a medio camino, porque cada una vuelca entera.
 */
export function openGameStore(root: string, gameId: string): FileStore {
  if (!isValidGameId(gameId)) throw new Error(`Nombre de partida invalido: ${gameId}`);

  const dir = resolve(root);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${gameId}.json`);

  let data: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    // Se valida la FORMA, no el contenido: si el archivo quedo raro, la
    // partida arranca de cero en lugar de reventar en el primer acceso.
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') data[key] = value;
      }
    }
  } catch {
    data = {};
  }

  let dirty = false;

  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
      dirty = true;
    },
    removeItem: (key) => {
      delete data[key];
      dirty = true;
    },
    flush: () => {
      if (!dirty) return;
      const temporary = `${file}.${process.pid}.tmp`;
      writeFileSync(temporary, JSON.stringify(data), 'utf8');
      renameSync(temporary, file);
      dirty = false;
    },
  };
}
