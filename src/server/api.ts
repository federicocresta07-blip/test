/**
 * LA API DE PARTIDA (fase 8).
 *
 * ============================================================
 * UN SOLO ENDPOINT, NO DIECISEIS
 * ============================================================
 *
 * `GameService` tiene dieciseis metodos. Darle una ruta REST a cada uno seria
 * dieciseis rutas que hay que mantener en sincronia con el contrato, y la
 * primera vez que alguien agregue un metodo al contrato y se olvide de la ruta
 * la interfaz va a fallar en produccion y no en el compilador.
 *
 * Asi que hay UNO: `POST /api/rpc` con `{ method, args }`. El contrato sigue
 * siendo la unica fuente de verdad y agregarle un metodo no pide tocar el
 * servidor. Es menos "RESTful" y mas honesto: esto no es una API de recursos,
 * es una llamada a un servicio.
 *
 * ============================================================
 * DE DONDE SALE LA PARTIDA
 * ============================================================
 *
 * DE LA SESION. Cada usuario tiene UNA carrera y se llama como el: la partida
 * de `Tomy` es `Tomy`. El nombre no viaja en la peticion, se deduce de una
 * cookie firmada, y por eso no se puede pedir la de otro.
 *
 * ASI NO ERA ANTES, y vale decir en que quedaba: la partida salia del header
 * `x-partida` o de una cookie SIN FIRMAR, las dos cosas que el cliente elige.
 * Quien supiera —o adivinara— el nombre de una carrera la abria y la jugaba.
 * Alcanzaba mientras el servidor fuera local; expuesto a internet no alcanza.
 *
 * `resolveGameId` sigue existiendo para el modo sin login (`requireLogin:
 * false`), que usan los tests que prueban el juego y no la entrada.
 *
 * LO QUE ESTO NO ES. No es multijugador simultaneo en la MISMA liga, y con
 * cuatro usuarios que eligen equipo conviene ser explicito: cada uno dirige su
 * PROPIO torneo, con sus diecinueve rivales generados. Si Lucas elige River y
 * Tomas elige Boca, no juegan uno contra el otro: juegan dos campeonatos
 * paralelos que nunca se cruzan.
 *
 * La razon es del motor, no del servidor: `playRound` resuelve los diez
 * partidos de la fecha de una vez, asi que no hay lugar donde esperar la
 * alineacion de otro humano. Una liga compartida pide que la fecha espere a
 * todos los clubes humanos, y eso es una fase, no un parametro. Esta
 * declarado como lo que falta en lugar de disfrazado.
 *
 * UNA PETICION A LA VEZ POR PROCESO. `setStorage` es global al proceso, asi
 * que el servicio lee el almacen de la peticion que este en curso. Entre el
 * `setStorage` y el final de `fn(...)` hay `await`s, y si dos peticiones de
 * DISTINTAS partidas se solapan en el mismo proceso, la segunda le cambia el
 * almacen a la primera y una carrera puede leer el estado de otra.
 *
 * No es nuevo —el servicio siempre leyo un global y `fn` siempre fue async—
 * pero en serverless es mas facil que pase: una instancia puede atender
 * varias peticiones a la vez. Arreglarlo de verdad es pasar el almacen por
 * parametro hasta el servicio, no un candado acá: un candado por proceso no
 * sirve cuando hay varias instancias. Queda declarado, sin disfraz.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMockGameService } from '../ui/services/mockGameService.ts';
import { memoryStore, setStorage, type KeyValueStore } from '../ui/services/storage.ts';
import { openGameStore as openFileStore, isValidGameId } from './file-store.ts';
import { handleLogin, sessionOf, logoutCookie, respond } from './login.ts';

/** Los metodos que la API expone. Salen del contrato, no de una lista aparte. */
const service = createMockGameService();
const METHODS = new Set(Object.keys(service));

const COOKIE = 'partida';
const MAX_BODY = 2_000_000;

/**
 * Un almacen de partida abierto, listo para usar y para volcar.
 *
 * Es la union de lo que devuelven las dos implementaciones: el de archivos
 * vuelca sincronicamente y el de Postgres devuelve una promesa. La API espera
 * el resultado en los dos casos —`await` sobre un `void` es un no-op— asi que
 * no le hace falta saber cual tiene.
 */
export type OpenStore = KeyValueStore & { readonly flush: () => void | Promise<void> };

/**
 * De donde sale el almacen de una partida.
 *
 * Es una FUNCION y no una carpeta ni una conexion: la API no tiene que saber
 * si detras hay archivos, Postgres o memoria. Fue lo unico que hubo que
 * cambiarle para agregar la base de datos.
 */
export type StoreFactory = (gameId: string) => OpenStore | Promise<OpenStore>;

export type ApiOptions = (
  | {
      /** Carpeta donde viven los archivos de partida. */
      readonly dataDir: string;
    }
  | {
      /** Almacen propio: Postgres, memoria, lo que sea. */
      readonly openStore: StoreFactory;
    }
) & {
  /**
   * Si hace falta entrar con usuario y contraseña. POR DEFECTO SI.
   *
   * El valor por defecto es el seguro a proposito: un servidor expuesto a
   * internet sin login deja que cualquiera abra la carrera de cualquiera, y
   * eso tiene que costar una linea de codigo EXPLICITA, no un olvido.
   *
   * Se apaga solo en los tests que prueban el juego y no la entrada.
   */
  readonly requireLogin?: boolean;
};

/** El almacen que corresponde a estas opciones. */
function storeFactoryOf(options: ApiOptions): StoreFactory {
  if ('openStore' in options) return options.openStore;
  const dataDir = options.dataDir;
  return (gameId) => openFileStore(dataDir, gameId);
}

export type ApiHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<boolean>;

export function createApi(options: ApiOptions): ApiHandler {
  const openStore = storeFactoryOf(options);
  const requireLogin = options.requireLogin ?? true;

  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    // `/api/salud` es PUBLICO, y tiene que serlo: la interfaz lo usa para
    // saber si hay servidor detras antes de que nadie haya entrado. No dice
    // nada mas que "si".
    if (url.pathname === '/api/salud' && request.method === 'GET') {
      send(response, 200, { ok: true });
      return true;
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      if (!requireLogin) {
        send(response, 404, { error: 'Este servidor no pide login' });
        return true;
      }
      let body: string;
      try {
        body = await readBody(request);
      } catch (cause) {
        send(response, 413, { error: (cause as Error).message });
        return true;
      }
      respond(response, await handleLogin(request, body));
      return true;
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      respond(response, {
        status: 200,
        payload: { ok: true },
        cookie: logoutCookie(request),
      });
      return true;
    }

    if (url.pathname === '/api/sesion' && request.method === 'GET') {
      // `requerido` DICE SI ESTE SERVIDOR PIDE LOGIN, y es distinto de
      // `login`, que dice si esta petición trae sesión. Sin esa diferencia la
      // interfaz no puede distinguir "no entraste" de "acá no se entra", y
      // mostraba la pantalla de entrada contra un servidor sin login, donde
      // `/api/login` responde 404. Lo encontraron los tests de navegador.
      if (!requireLogin) {
        send(response, 200, { login: false, requerido: false });
        return true;
      }
      // 200 CON `login: false`, NO 401.
      //
      // `/api/sesion` es la pregunta "¿quién soy?", y "nadie" es una respuesta
      // correcta a esa pregunta, no un acceso denegado. Con 401 el navegador
      // anotaba un error de consola en cada carga de la página de entrada:
      // ruido en la consola de todos, y un test de navegador que trata los
      // errores de consola como fallos —el de este proyecto— se caía.
      //
      // El 401 sigue donde corresponde: en `/api/rpc`, donde sí se está
      // pidiendo algo que hace falta permiso para obtener.
      const session = sessionOf(request);
      if (session === null) {
        send(response, 200, { login: false, requerido: true });
        return true;
      }
      send(response, 200, {
        login: true,
        requerido: true,
        usuario: session.username,
        nombre: session.displayName,
      });
      return true;
    }

    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      await handleRpc(request, response, openStore, requireLogin);
      return true;
    }

    send(response, 404, { error: 'Ruta de API desconocida' });
    return true;
  };
}

async function handleRpc(
  request: IncomingMessage,
  response: ServerResponse,
  openStore: StoreFactory,
  requireLogin: boolean,
): Promise<void> {
  // LA SESION SE MIRA PRIMERO, antes de leer el cuerpo: no hay razon para
  // gastar memoria en el cuerpo de una peticion que no va a correr.
  const session = requireLogin ? sessionOf(request) : null;
  if (requireLogin && session === null) {
    // 401 y no 403: la interfaz lo distingue para mostrar la pantalla de
    // entrada en lugar de un error.
    send(response, 401, { error: 'Tenés que entrar con tu usuario' });
    return;
  }

  let body: string;
  try {
    body = await readBody(request);
  } catch (cause) {
    send(response, 413, { error: (cause as Error).message });
    return;
  }

  let call: { method?: unknown; args?: unknown };
  try {
    call = JSON.parse(body) as typeof call;
  } catch {
    send(response, 400, { error: 'El cuerpo no es JSON' });
    return;
  }

  const method = call.method;
  if (typeof method !== 'string' || !METHODS.has(method)) {
    // Se responde con el nombre pedido y nada mas: enumerar los metodos
    // disponibles en un error no ayuda a nadie que no tenga el contrato.
    send(response, 400, { error: `El servicio no tiene un metodo "${String(method)}"` });
    return;
  }
  const args = Array.isArray(call.args) ? call.args : [];

  // LA PARTIDA ES LA DEL USUARIO DE LA SESION, y no algo que el cliente pida.
  // Ese es el cambio de seguridad de esta fase: antes el nombre de la partida
  // venia en un header (`x-partida`) o en una cookie sin firmar, asi que
  // cualquiera que supiera —o adivinara— el nombre de otra carrera la abria.
  // Ahora sale de una cookie FIRMADA que el cliente no puede fabricar.
  const gameId = session !== null ? session.username : resolveGameId(request);

  // ABRIR EL ALMACEN PUEDE FALLAR, y con Postgres detras falla distinto: la
  // base puede estar caida o la conexion agotada. Eso es un 503 —el servidor
  // anda, el almacenamiento no— y no un 409, que significa "la accion no se
  // puede hacer con este estado del juego".
  let store: OpenStore;
  try {
    store = await openStore(gameId);
  } catch (cause) {
    send(response, 503, {
      error: `No se pudo abrir la partida: ${cause instanceof Error ? cause.message : 'error de almacenamiento'}`,
    });
    return;
  }

  const previous = setStorage(store);
  try {
    const fn = (service as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[
      method
    ] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn(...args);
    await store.flush();
    send(response, 200, { result: result ?? null }, gameId);
  } catch (cause) {
    // El servicio lanza errores con mensajes pensados para el manager ("no hay
    // caja suficiente"), asi que el mensaje se pasa tal cual. El 409 es
    // deliberado: no es un error del servidor ni una peticion mal formada, es
    // una accion que el estado del juego no permite.
    //
    // Se vuelca IGUAL: una accion puede haber escrito algo antes de fallar
    // —jugar la fecha guarda el desarrollo del club y despues la temporada— y
    // perder esa mitad seria peor que guardarla. Si el volcado tambien falla,
    // gana ese error: no se puede decir "no alcanza la caja" cuando ademas no
    // se guardo nada.
    try {
      await store.flush();
    } catch (flushError) {
      send(response, 503, {
        error: `La partida no se pudo guardar: ${flushError instanceof Error ? flushError.message : 'error de almacenamiento'}`,
      });
      return;
    }
    send(
      response,
      409,
      { error: cause instanceof Error ? cause.message : 'La acción no se pudo completar' },
      gameId,
    );
  } finally {
    setStorage(previous ?? memoryStore());
  }
}

/**
 * La partida de esta peticion.
 *
 * Header primero porque es explicito; la cookie despues, para que abrir el
 * juego en el navegador y recargar siga en la misma partida sin que la
 * interfaz tenga que acordarse de nada.
 */
function resolveGameId(request: IncomingMessage): string {
  const header = request.headers['x-partida'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (typeof fromHeader === 'string' && isValidGameId(fromHeader)) return fromHeader;

  const cookies = request.headers.cookie ?? '';
  for (const part of cookies.split(';')) {
    const [name, value] = part.split('=').map((piece) => piece.trim());
    if (name === COOKIE && value !== undefined && isValidGameId(value)) return value;
  }

  // Partida nueva. El nombre no tiene que ser secreto —quien tenga el nombre
  // tiene la partida, y eso alcanza para un prototipo— pero si tiene que ser
  // dificil de adivinar, porque adivinarlo es entrar a la carrera de otro.
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    // Un cuerpo sin limite es una forma de tirar el servidor con una sola
    // peticion. El limite es generoso: la alineacion completa con la tactica
    // no llega a diez kilobytes.
    if (size > MAX_BODY) throw new Error('El cuerpo de la petición es demasiado grande');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(
  response: ServerResponse,
  status: number,
  payload: unknown,
  gameId?: string,
): void {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  if (gameId !== undefined) {
    // `SameSite=Strict` y `HttpOnly`: la cookie solo identifica la partida y no
    // la necesita ningun script de la pagina.
    headers['set-cookie'] = `${COOKIE}=${gameId}; Path=/; HttpOnly; SameSite=Strict`;
    headers['x-partida'] = gameId;
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}
