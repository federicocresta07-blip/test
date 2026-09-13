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
 * Del header `x-partida`, y si no viene, de una cookie que el servidor pone la
 * primera vez. Cada partida es un archivo y no se cruzan: eso es lo que hace
 * que varias personas puedan jugar su propia carrera en el mismo servidor.
 *
 * LO QUE ESTO NO ES. No es multijugador simultaneo en la MISMA liga: hoy
 * `playRound` resuelve los diez partidos de la fecha de una vez, asi que dos
 * managers no pueden dirigir dos clubes del mismo torneo. Eso pide que la
 * fecha espere a que todos los clubes humanos manden su alineacion, y esta
 * declarado como lo que falta en lugar de disfrazado.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMockGameService } from '../ui/services/mockGameService.ts';
import { memoryStore, setStorage } from '../ui/services/storage.ts';
import { openGameStore, isValidGameId } from './file-store.ts';

/** Los metodos que la API expone. Salen del contrato, no de una lista aparte. */
const service = createMockGameService();
const METHODS = new Set(Object.keys(service));

const COOKIE = 'partida';
const MAX_BODY = 2_000_000;

export type ApiOptions = {
  /** Carpeta donde viven los archivos de partida. */
  readonly dataDir: string;
};

export type ApiHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<boolean>;

export function createApi(options: ApiOptions): ApiHandler {
  return async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      await handleRpc(request, response, options);
      return true;
    }

    if (url.pathname === '/api/salud' && request.method === 'GET') {
      send(response, 200, { ok: true });
      return true;
    }

    send(response, 404, { error: 'Ruta de API desconocida' });
    return true;
  };
}

async function handleRpc(
  request: IncomingMessage,
  response: ServerResponse,
  options: ApiOptions,
): Promise<void> {
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

  const gameId = resolveGameId(request);
  const store = openGameStore(options.dataDir, gameId);
  const previous = setStorage(store);
  try {
    const fn = (service as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[
      method
    ] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn(...args);
    store.flush();
    send(response, 200, { result: result ?? null }, gameId);
  } catch (cause) {
    // El servicio lanza errores con mensajes pensados para el manager ("no hay
    // caja suficiente"), asi que el mensaje se pasa tal cual. El 409 es
    // deliberado: no es un error del servidor ni una peticion mal formada, es
    // una accion que el estado del juego no permite.
    store.flush();
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
