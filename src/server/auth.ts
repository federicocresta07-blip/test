/**
 * LA SESION.
 *
 * Una cookie firmada que dice quién es el que está jugando. Nada más: no hay
 * tabla de sesiones, no hay estado en el servidor.
 *
 * ============================================================
 * POR QUE UNA COOKIE FIRMADA Y NO UNA TABLA
 * ============================================================
 *
 * Porque el servidor es serverless. Una tabla de sesiones obligaría a una
 * consulta a la base en CADA petición, incluida la de un servidor que no tiene
 * base (el de archivos), y a limpiar sesiones vencidas. Una cookie firmada se
 * verifica con un HMAC y nada más.
 *
 * Lo que se pierde es poder revocar una sesión desde el servidor. Con cuatro
 * personas conocidas y una validez de 30 días, cambiar `SESSION_SECRET`
 * —que invalida todas— alcanza como botón de pánico.
 *
 * ============================================================
 * QUE LLEVA LA COOKIE, Y QUE NO
 * ============================================================
 *
 *     usuario.vencimiento.firma
 *
 * El nombre de usuario y hasta cuándo vale, en claro, y un HMAC-SHA256 de las
 * dos cosas con el secreto del servidor. NO lleva la contraseña ni su hash: si
 * la cookie se filtra, se filtró una sesión con fecha de vencimiento, no una
 * credencial permanente.
 *
 * La firma cubre el vencimiento, así que estirarlo a mano invalida la cookie.
 * Es lo único que hace falta para que el cliente no pueda mentir: todo lo
 * demás que el servidor necesita —de quién es la partida— sale de acá y no de
 * nada que el cliente mande aparte.
 *
 * ============================================================
 * EL SECRETO
 * ============================================================
 *
 * `SESSION_SECRET`, de las variables de entorno. Si falta, se genera uno al
 * azar por proceso y se avisa: sirve para desarrollo, pero en serverless cada
 * arranque en frío inventaría otro y habría que entrar de nuevo todo el
 * tiempo. En producción es obligatorio, y el gate del despliegue lo exige
 * (`scripts/migrate-deploy.ts`).
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cuánto vale una sesión. 30 días: es un juego, no un banco. */
export const SESSION_DAYS = 30;

const COOKIE = 'sesion';

/**
 * El secreto, resuelto una vez por proceso.
 *
 * `null` en `fallback` significa que vino de la variable de entorno, que es lo
 * correcto. Cuando se generó al azar se recuerda, para poder avisar una sola
 * vez en el arranque en lugar de en cada petición.
 */
let secret: Buffer | null = null;
let generated = false;

export function sessionSecret(): Buffer {
  if (secret !== null) return secret;

  const fromEnv = process.env['SESSION_SECRET'] ?? '';
  if (fromEnv.length >= 16) {
    secret = Buffer.from(fromEnv, 'utf8');
    return secret;
  }

  // Sin secreto configurado: uno al azar, que sirve mientras el proceso viva.
  generated = true;
  secret = randomBytes(32);
  return secret;
}

/** `true` si el secreto es inventado, para que el arranque lo pueda decir. */
export function secretIsEphemeral(): boolean {
  sessionSecret();
  return generated;
}

/** Sólo para los tests: olvida el secreto resuelto. */
export function resetSessionSecret(): void {
  secret = null;
  generated = false;
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

/**
 * La cookie de sesión de este usuario, lista para `set-cookie`.
 *
 * `HttpOnly` para que ningún script la lea, `SameSite=Lax` para que no viaje
 * en peticiones de otros sitios, y `Secure` salvo en local: en `http://` un
 * navegador descarta una cookie `Secure` y no se podría entrar desarrollando.
 */
export function sessionCookie(username: string, secure: boolean): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${username}.${expires}`;
  const value = `${payload}.${sign(payload)}`;
  const attributes = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

/** La cookie que borra la sesión. */
export function clearedCookie(secure: boolean): string {
  const attributes = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

/**
 * El usuario de esta cookie, o `null`.
 *
 * Devuelve el nombre tal como lo firmó el servidor, que es el canónico de
 * `users.ts`. Rechaza una firma inválida, una cookie vencida y cualquier cosa
 * con forma rara, sin decir cuál de las tres: un mensaje distinto por caso le
 * diría a quien prueba qué le falta.
 */
export function usernameFromCookie(header: string | undefined): string | null {
  const raw = readCookie(header, COOKIE);
  if (raw === null) return null;

  // El nombre no puede tener puntos (`users.ts` los descarta), así que partir
  // en tres por el separador es seguro.
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [username, expiresText, signature] = parts as [string, string, string];

  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;

  const expected = sign(`${username}.${expiresText}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return username.length > 0 ? username : null;
}

/** Una cookie por nombre, del header `cookie`. */
function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Si esta petición llegó por HTTPS.
 *
 * Detrás del proxy de Vercel la conexión al proceso es HTTP, así que la
 * pregunta se le hace a `x-forwarded-proto`. Sin el header se asume que no,
 * que es lo que pasa en local.
 */
export function isSecureRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const forwarded = headers['x-forwarded-proto'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return typeof value === 'string' && value.split(',')[0]?.trim() === 'https';
}
