/**
 * DONDE SE GUARDA LA PARTIDA (fase 8).
 *
 * Hasta la fase 8 los tres almacenes —alineacion, desarrollo del club y
 * temporada— hablaban con `localStorage` directamente. Eso funcionaba, y tenia
 * un techo: `localStorage` SOLO EXISTE EN EL NAVEGADOR. La misma partida no
 * podia vivir en un servidor, y sin eso no hay multijugador ni hay partida que
 * sobreviva a cambiar de maquina.
 *
 * Esta es la pieza que faltaba, y es chica a proposito: una interfaz de tres
 * metodos y un lugar donde decir cual usar. El servidor le pasa una que
 * escribe archivos; el navegador usa la del navegador; los tests usan una en
 * memoria y no se pisan entre si.
 *
 * NO ES UNA ABSTRACCION DE MAS. El contrato `GameService` ya era el limite
 * entre la interfaz y el estado; lo que no estaba era el limite entre el
 * servicio y SU almacenamiento, y es el que hace falta para que el servicio
 * corra de los dos lados.
 */

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * Un almacen en memoria.
 *
 * Es el que se usa cuando no hay ninguno: en un test, en un script de consola,
 * o en el servidor antes de resolver de que partida se trata. Guardar en
 * memoria y perderlo es mejor que explotar, y mucho mejor que escribir en la
 * partida de otro.
 */
export function memoryStore(initial: Readonly<Record<string, string>> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/**
 * El almacen del navegador, si hay uno usable.
 *
 * Puede no haberlo: en modo privado, con las cookies bloqueadas o desde un
 * `file://` algunos navegadores tiran una excepcion al TOCAR `localStorage`,
 * no al usarlo. Por eso la prueba es escribir y borrar, no preguntar si
 * existe.
 */
function browserStore(): KeyValueStore | null {
  try {
    const probe = '__manager_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

let current: KeyValueStore | null = null;

/** El almacen en uso. La primera vez elige el del navegador si lo hay. */
export function storage(): KeyValueStore {
  if (current === null) current = browserStore() ?? memoryStore();
  return current;
}

/**
 * Cambia el almacen en uso.
 *
 * El servidor lo llama una vez por peticion, con el almacen de la partida que
 * corresponde. Los tests lo llaman para arrancar limpios.
 *
 * Devuelve el que estaba, para poder restaurarlo. Un test que cambia el
 * almacen y no lo devuelve le arruina la partida al test siguiente, y ese
 * error es de los que tardan una hora en encontrarse.
 */
export function setStorage(next: KeyValueStore): KeyValueStore | null {
  const previous = current;
  current = next;
  return previous;
}
