/**
 * LOS ENDPOINTS DE ENTRADA.
 *
 * `/api/login`, `/api/logout` y `/api/sesion`. La verificación de contraseñas
 * está en `users.ts` y las cookies en `auth.ts`; acá está sólo el HTTP.
 *
 * ============================================================
 * POR QUE HAY UN LIMITE DE INTENTOS
 * ============================================================
 *
 * No por la fuerza bruta: las contraseñas tienen 80 bits y adivinar una
 * probando llevaría más que la vida del sol. Es por el COSTO: scrypt está
 * calibrado para tardar, y eso es una defensa cuando alguien roba los hashes y
 * un problema cuando alguien manda mil logins por segundo. Sin límite, cuatro
 * peticiones por segundo consumen una función serverless entera.
 *
 * El límite vive EN MEMORIA, así que en serverless es por instancia y quien
 * quiera esquivarlo lo esquiva. Es un amortiguador, no una puerta, y está
 * dicho acá para que nadie lo confunda con una: la puerta es la entropía de
 * las contraseñas.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyPassword, findUser } from './users.ts';
import { sessionCookie, clearedCookie, usernameFromCookie, isSecureRequest } from './auth.ts';

/** Intentos fallidos permitidos antes de frenar, y por cuánto tiempo. */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

type Attempt = { failures: number; until: number };
const attempts = new Map<string, Attempt>();

/** Sólo para los tests: olvida los intentos registrados. */
export function resetThrottle(): void {
  attempts.clear();
}

function throttleKey(request: IncomingMessage): string {
  // Detrás de un proxy la IP real viene en `x-forwarded-for`. No se confía en
  // ella para nada de seguridad —se puede falsificar— pero para agrupar
  // intentos es mejor que nada, y el límite no es una puerta.
  const forwarded = request.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ?? request.socket.remoteAddress ?? 'desconocido').split(',')[0]?.trim() ?? 'x';
}

function isThrottled(key: string): boolean {
  const attempt = attempts.get(key);
  if (attempt === undefined) return false;
  if (attempt.until <= Date.now()) {
    attempts.delete(key);
    return false;
  }
  return attempt.failures >= MAX_FAILURES;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt === undefined || attempt.until <= now) {
    attempts.set(key, { failures: 1, until: now + WINDOW_MS });
    return;
  }
  attempt.failures += 1;
}

export type LoginResult = {
  readonly status: number;
  readonly payload: unknown;
  /** La cookie a poner, si la hay. */
  readonly cookie?: string;
  /** El usuario que entró, para que quien llama sepa de quién es la partida. */
  readonly username?: string;
};

/**
 * Procesa un intento de entrada.
 *
 * El mensaje de error es el MISMO para usuario inexistente y contraseña
 * incorrecta. Decir "ese usuario no existe" le regala a quien prueba la mitad
 * del trabajo: cuáles de los nombres son reales.
 */
export async function handleLogin(
  request: IncomingMessage,
  body: string,
): Promise<LoginResult> {
  const key = throttleKey(request);
  if (isThrottled(key)) {
    return {
      status: 429,
      payload: {
        error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
      },
    };
  }

  let call: { usuario?: unknown; contrasena?: unknown; contraseña?: unknown };
  try {
    call = JSON.parse(body) as typeof call;
  } catch {
    return { status: 400, payload: { error: 'El cuerpo de la petición no es JSON' } };
  }

  // Se acepta `contraseña` y `contrasena`: el nombre con eñe es el natural en
  // este proyecto y el sin eñe evita que un cliente que no sepa codificar
  // UTF-8 en una clave de JSON quede afuera.
  const usuario = typeof call.usuario === 'string' ? call.usuario : '';
  const password =
    typeof call.contraseña === 'string'
      ? call.contraseña
      : typeof call.contrasena === 'string'
        ? call.contrasena
        : '';

  if (usuario.length === 0 || password.length === 0) {
    return { status: 400, payload: { error: 'Faltan el usuario o la contraseña' } };
  }

  const user = await verifyPassword(usuario, password);
  if (user === null) {
    recordFailure(key);
    return { status: 401, payload: { error: 'Usuario o contraseña incorrectos' } };
  }

  return {
    status: 200,
    payload: { usuario: user.username, nombre: user.displayName },
    cookie: sessionCookie(user.username, isSecureRequest(request.headers)),
    username: user.username,
  };
}

/** La sesión que trae esta petición, si trae alguna válida. */
export function sessionOf(request: IncomingMessage): { username: string; displayName: string } | null {
  const username = usernameFromCookie(request.headers.cookie);
  if (username === null) return null;

  // Que la cookie esté bien firmada no alcanza: el usuario tiene que seguir
  // existiendo. Si se saca a alguien de `users.ts`, su cookie deja de valer.
  const user = findUser(username);
  return user === null ? null : { username: user.username, displayName: user.displayName };
}

/** La cookie que cierra la sesión. */
export function logoutCookie(request: IncomingMessage): string {
  return clearedCookie(isSecureRequest(request.headers));
}

export function respond(
  response: ServerResponse,
  result: LoginResult,
): void {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    // Una respuesta de login no se cachea nunca, en ningún lado.
    'cache-control': 'no-store',
  };
  if (result.cookie !== undefined) headers['set-cookie'] = result.cookie;
  response.writeHead(result.status, headers);
  response.end(JSON.stringify(result.payload));
}
