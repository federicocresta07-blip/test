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

    // LA PARTIDA ES LA DEL USUARIO, y el servidor la deduce de la sesion. Ya
    // no se pide por nombre: `?partida=ana` servia cuando cualquiera podia
    // abrir cualquier carrera sabiendo su nombre, y eso es justo lo que la
    // sesion vino a cerrar. Se sigue leyendo para el modo sin login.
    const requested = requestedGameId();
    gameService = createHttpGameService(requested ? { gameId: requested } : {});
    kind = 'servidor';

    const who = await session();
    gameId = who?.usuario ?? requested ?? null;
  } catch {
    // Sin servidor detras: el servicio local ya esta puesto.
  }
  return kind;
}

/**
 * ============================================================
 * LA SESION
 * ============================================================
 *
 * Con servidor detras hay que entrar con usuario y contrasena. Estas tres
 * funciones son todo lo que la interfaz necesita saber de eso.
 *
 * Sin servidor detras —el HTML autocontenido— NO HAY LOGIN ni puede haberlo:
 * no hay donde verificar una contrasena, y la partida es del navegador. Por
 * eso `session()` devuelve `null` y la interfaz no muestra ninguna entrada.
 */

export type Session = {
  readonly usuario: string;
  readonly nombre: string;
};

/**
 * La sesion ya resuelta, para poder leerla sin esperar.
 *
 * La barra superior necesita saber quien esta jugando en cada render, y
 * preguntarselo al servidor en cada uno seria una peticion por render. Se
 * guarda cuando `session()` o `login()` la resuelven.
 */
let current: Session | null = null;

export function currentSession(): Session | null {
  return current;
}

/**
 * Quien esta jugando, o `null`.
 *
 * `null` significa dos cosas distintas y a la interfaz le alcanza con una:
 * que no hay sesion (hay que entrar) o que no hay servidor (no hace falta).
 * Se distinguen por `serviceKind()`.
 */
export type SessionState = {
  /**
   * Si ESTE servidor pide entrar.
   *
   * Distinto de tener sesión: un servidor sin login (los tests que prueban el
   * juego) responde `false`, y ahí mostrar la pantalla de entrada sería
   * mandar al usuario a un `/api/login` que no existe.
   */
  readonly required: boolean;
  readonly session: Session | null;
};

export async function sessionState(): Promise<SessionState> {
  // Sin servidor no hay login posible ni hace falta.
  if (kind !== 'servidor') return { required: false, session: null };
  try {
    const response = await fetch('/api/sesion', { credentials: 'same-origin' });
    if (!response.ok) return { required: false, session: null };
    const payload = (await response.json()) as {
      login?: boolean;
      requerido?: boolean;
      usuario?: string;
      nombre?: string;
    };
    const required = payload.requerido !== false;
    if (payload.login !== true || !payload.usuario || !payload.nombre) {
      current = null;
      return { required, session: null };
    }
    current = { usuario: payload.usuario, nombre: payload.nombre };
    return { required, session: current };
  } catch {
    return { required: false, session: null };
  }
}

/** Quién está jugando, o `null`. Atajo sobre `sessionState`. */
export async function session(): Promise<Session | null> {
  return (await sessionState()).session;
}

/**
 * Entra. Devuelve la sesion, o el mensaje de error para mostrar.
 *
 * El mensaje viene del servidor tal cual: es el mismo para usuario inexistente
 * y contrasena incorrecta, a proposito.
 */
export async function login(
  usuario: string,
  contrasena: string,
): Promise<{ ok: true; session: Session } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ usuario, contrasena }),
    });
    const payload = (await response.json()) as {
      usuario?: string;
      nombre?: string;
      error?: string;
    };
    if (!response.ok || !payload.usuario || !payload.nombre) {
      return { ok: false, error: payload.error ?? 'No se pudo entrar' };
    }
    gameId = payload.usuario;
    current = { usuario: payload.usuario, nombre: payload.nombre };
    return { ok: true, session: current };
  } catch {
    return { ok: false, error: 'No se pudo hablar con el servidor' };
  }
}

/** Sale. Despues de esto hay que volver a entrar. */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Si la peticion no llega, la cookie sigue puesta y la sesion sigue
    // valiendo. Se recarga igual: es lo que el usuario pidio, y al recargar se
    // vuelve a preguntar al servidor quien es.
  }
  gameId = null;
  current = null;
}

export { DEMO_DATA_NOTICE, DATA_SOURCE_NOTICE, DATA_SOURCE_LABEL } from './mockGameService.ts';
export type { GameService } from './types.ts';
