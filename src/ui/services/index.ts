/**
 * PUNTO UNICO DE ACCESO A SERVICIOS.
 *
 * El comentario de la fase 0 decia "cambiar el mock por un cliente HTTP es
 * cambiar esta linea". En la fase 8 se cambió, y era verdad: ningun componente
 * se toco.
 *
 * ============================================================
 * COMO SE ELIGE
 * ============================================================
 *
 * El servidor de partida (`npm run serve`) sirve la interfaz y la API en el
 * mismo origen, asi que la pregunta es: ¿hay API detrás de esta página?
 *
 * Se responde por el ORIGEN, no por una variable de entorno: la misma build
 * tiene que funcionar servida por el servidor de partida (con API) y abierta
 * como archivo o desde un hosting estático (sin API). Una variable de
 * compilación obligaría a construir dos veces la misma cosa.
 *
 * - Servida por HTTP con la API contestando → cliente HTTP, la partida vive en
 *   el servidor y sobrevive a cambiar de navegador o de máquina.
 * - Abierta como `file://`, o sin API → el servicio local, la partida vive en
 *   el navegador. Es el HTML autocontenido, y tiene que seguir funcionando.
 *
 * La comprobación es asíncrona (`/api/salud`), asi que `gameService` empieza
 * siendo el local y se cambia si la API contesta. Eso funciona porque la
 * interfaz pide el estado DESPUES de montar, no durante.
 */

import { createMockGameService } from './mockGameService.ts';
import { createHttpGameService } from './httpGameService.ts';
import type { GameService } from './types.ts';

const local = createMockGameService();

/**
 * El servicio en uso.
 *
 * Es mutable a proposito y es el unico `let` exportado del proyecto: cambiarlo
 * una vez al arrancar es mas simple que envolver la aplicacion en una promesa
 * o en otro contexto de React para algo que se decide una sola vez y nunca
 * mas.
 */
export let gameService: GameService = local;

/** De donde sale el estado, para poder mostrarlo. */
export type ServiceKind = 'local' | 'servidor';

let kind: ServiceKind = 'local';
let gameId: string | null = null;

export function serviceKind(): ServiceKind {
  return kind;
}

/**
 * El nombre de la partida en el servidor, si hay servidor.
 *
 * Se muestra en la barra superior, y eso no es un detalle: sin verlo, la
 * partida guardada en el servidor es inalcanzable desde otra maquina. El
 * servidor la identifica por cookie, y una cookie no se puede llevar a otro
 * navegador a mano.
 */
export function currentGameId(): string | null {
  return gameId;
}

/** El nombre de partida pedido por la URL: `?partida=ana`. */
function requestedGameId(): string | undefined {
  try {
    const value = new URLSearchParams(globalThis.location?.search ?? '').get('partida');
    return value !== null && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Busca la API y, si contesta, pasa a usarla.
 *
 * Devuelve cual quedó. Si algo falla —no hay red, no hay servidor, la
 * respuesta no es la esperada— se queda con el local: el juego tiene que
 * arrancar igual, y el HTML autocontenido no tiene ningun servidor detrás.
 */
export async function connectToServer(): Promise<ServiceKind> {
  if (typeof fetch !== 'function' || globalThis.location?.protocol === 'file:') {
    return kind;
  }
  try {
    const response = await fetch('/api/salud', { credentials: 'same-origin' });
    if (!response.ok) return kind;
    const payload = (await response.json()) as { ok?: boolean };
    if (payload.ok !== true) return kind;

    // `?partida=ana` abre esa partida; sin el parametro, el servidor la
    // resuelve por cookie y crea una nueva la primera vez. Es lo que hace que
    // una carrera se pueda retomar desde otra maquina.
    const requested = requestedGameId();
    gameService = createHttpGameService(requested ? { gameId: requested } : {});
    kind = 'servidor';
    gameId = requested ?? (await askGameId());
  } catch {
    // Sin servidor detras: el servicio local ya esta puesto.
  }
  return kind;
}

/**
 * El nombre que el servidor le puso a esta partida.
 *
 * Viene en la cabecera `x-partida` de cualquier respuesta de la API. Hace
 * falta preguntarlo porque la cookie es `HttpOnly` —no la puede leer ningun
 * script, que es como tiene que ser— asi que la unica forma de que la
 * interfaz sepa en que partida esta es que el servidor se lo diga.
 */
async function askGameId(): Promise<string | null> {
  try {
    const response = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ method: 'loadGame', args: [] }),
    });
    return response.headers.get('x-partida');
  } catch {
    return null;
  }
}

export { DEMO_DATA_NOTICE, DATA_SOURCE_NOTICE, DATA_SOURCE_LABEL } from './mockGameService.ts';
export type { GameService } from './types.ts';
