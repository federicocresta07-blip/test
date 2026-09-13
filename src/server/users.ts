/**
 * QUIEN PUEDE ENTRAR.
 *
 * Cuatro usuarios, fijos, con la contraseña guardada como hash de scrypt.
 *
 * ============================================================
 * POR QUE ACA Y NO EN LA BASE DE DATOS
 * ============================================================
 *
 * Porque el login tiene que funcionar SIN base de datos. Todo el proyecto
 * mantiene esa propiedad —el HTML autocontenido no tiene servidor, y
 * `npm run serve` sin `DATABASE_URL` guarda en archivos— y poner los usuarios
 * en Postgres la rompería: no se podría entrar a un servidor de archivos.
 *
 * Y no hace falta. Son cuatro personas conocidas, no un registro abierto: no
 * hay alta, ni baja, ni "olvidé mi contraseña". El día que haya registro, esto
 * pasa a una tabla y este archivo se borra.
 *
 * La ELECCION DE EQUIPO de cada uno no vive acá: vive en el guardado de su
 * partida, que ya sabe persistirse en las tres formas. Ver `auth.ts`.
 *
 * ============================================================
 * POR QUE SE PUEDEN COMMITEAR ESTOS HASHES
 * ============================================================
 *
 * Lo que está acá es hash + sal, nunca la contraseña. Y las contraseñas se
 * generaron al azar con 80 bits de entropía (cuatro grupos de cuatro
 * caracteres de un alfabeto de 32), así que no hay diccionario ni fuerza bruta
 * que las saque de un hash de scrypt: no son palabras, no son fechas, no son
 * nombres. Un hash de una contraseña ELEGIDA POR UNA PERSONA no se podría
 * commitear con el mismo argumento.
 *
 * scrypt con N=16384, r=8, p=1 es el costo por defecto de Node y está bien
 * para esto. Está en `node:crypto`: no agrega una dependencia, que en este
 * proyecto es una decisión que se justifica cada vez.
 *
 * PARA CAMBIAR UNA CONTRASEÑA: `npm run password -- usuario`. Imprime el
 * bloque nuevo para pegar acá y la contraseña una sola vez. No hay forma de
 * recuperar una contraseña desde este archivo, que es el punto.
 */

import { scrypt, timingSafeEqual, randomInt } from 'node:crypto';

/** Los parámetros de scrypt. Cambiarlos invalida todos los hashes de abajo. */
export const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 } as const;

export type User = {
  /** El nombre con el que entra. Es también el nombre de su partida. */
  readonly username: string;
  /** Como lo saluda el juego. */
  readonly displayName: string;
  readonly salt: string;
  readonly hash: string;
};

const USERS: readonly User[] = [
  {
    username: 'lhs237',
    displayName: 'Lucas',
    salt: '7ba7a9dd30e8d92b7a020d3936915837',
    hash: 'fbb63a04ffce568bc90cb2751456c023795ed8d13cf23c9349494ab75988434d',
  },
  {
    username: 'Tomy',
    displayName: 'Tomás',
    salt: '2398cd9d2fdf0e69c954d6e95ca0f83b',
    hash: '040dfcdd1b238fdad54f6aea5f9663dc54f1d59454dc055186a25f4641a261f1',
  },
  {
    username: 'Kezman',
    displayName: 'Agustín',
    salt: '9e519a2adf71b777983d59b05e3c42cf',
    hash: 'a38ac1f64c46c638ede17fb493b4c0f060bf9edb3d3085a3bcaca8e609db3c8f',
  },
  {
    username: 'fercha07',
    displayName: 'fede',
    salt: 'eaccf59baa8850c6f5ae40537ce2fec6',
    hash: 'd17b95cfe52524b5375ad06a086610797cbebcd7759ebfcdd2bbd024ab88e478',
  },
];

/**
 * USUARIOS EXTRA, de una variable de entorno.
 *
 * `USUARIOS_EXTRA` con un JSON así:
 *
 *     [{"username":"pepe","displayName":"Pepe","salt":"…","hash":"…"}]
 *
 * Lleva HASHES, nunca contraseñas: la variable se puede leer desde el panel de
 * Vercel y desde cualquier log que la imprima por error, así que una
 * contraseña en claro ahí sería peor que en el código.
 *
 * PARA QUE EXISTE. Para dos cosas concretas:
 *
 *   1. Sumar un quinto jugador sin tocar el código ni desplegar. Se genera con
 *      `npm run password -- nombre`, se pega en la variable y listo.
 *   2. Que los tests puedan probar la entrada CON UNA CONTRASEÑA QUE CONOCEN.
 *      Las cuatro de este archivo no están en el repositorio —es el punto— así
 *      que sin esto el camino más importante, "contraseña correcta entra",
 *      quedaría sin test.
 *
 * Se valida con cuidado y se descarta entera si no cumple: una variable mal
 * escrita no puede dejar a nadie afuera ni meter a nadie de más. Un nombre que
 * ya existe en la lista de arriba NO se reemplaza, para que la variable no
 * pueda apropiarse de la cuenta de otro.
 */
function extraUsers(): readonly User[] {
  const raw = process.env['USUARIOS_EXTRA'];
  if (raw === undefined || raw.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const fixed = new Set(USERS.map((user) => user.username.toLowerCase()));
    const out: User[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue;
      const candidate = entry as Record<string, unknown>;
      const username = candidate['username'];
      const displayName = candidate['displayName'];
      const salt = candidate['salt'];
      const hash = candidate['hash'];
      if (
        typeof username !== 'string' ||
        typeof displayName !== 'string' ||
        typeof salt !== 'string' ||
        typeof hash !== 'string'
      ) {
        continue;
      }
      // El nombre tiene que servir de nombre de partida, y no puede tener
      // puntos: la cookie de sesión los usa de separador.
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(username)) continue;
      if (!/^[0-9a-f]{32,}$/.test(salt) || !/^[0-9a-f]{64}$/.test(hash)) continue;
      if (fixed.has(username.toLowerCase())) continue;
      out.push({ username, displayName, salt, hash });
    }
    return out;
  } catch {
    // JSON roto: se ignora entera. Mejor los cuatro de siempre que un error
    // al arrancar que deja a todos afuera.
    return [];
  }
}

/** Todos los que pueden entrar: los fijos más los de la variable. */
function allUsers(): readonly User[] {
  return [...USERS, ...extraUsers()];
}

/**
 * El usuario con ese nombre, sin distinguir mayúsculas.
 *
 * Sin distinguir porque `Tomy` y `tomy` son la misma persona y nadie se acuerda
 * de cómo se escribió su propio nombre. El nombre CANONICO es el de este
 * archivo, y es el que se usa para el nombre de la partida: si no, `Tomy` y
 * `tomy` serían dos carreras distintas.
 */
export function findUser(username: string): User | null {
  const wanted = username.trim().toLowerCase();
  return allUsers().find((user) => user.username.toLowerCase() === wanted) ?? null;
}

/** Los nombres de usuario, para los tests y para el script de contraseñas. */
export function usernames(): readonly string[] {
  return allUsers().map((user) => user.username);
}

/** Solo los cuatro del archivo, sin los de la variable de entorno. */
export function fixedUsernames(): readonly string[] {
  return USERS.map((user) => user.username);
}

/**
 * Verifica una contraseña contra un usuario.
 *
 * Devuelve el usuario o `null`. Dos cosas que parecen detalles y no lo son:
 *
 * 1. LA COMPARACION ES DE TIEMPO CONSTANTE (`timingSafeEqual`). Comparar
 *    hashes con `===` filtra, por cuánto tarda, cuántos bytes coincidieron.
 * 2. UN USUARIO QUE NO EXISTE TARDA LO MISMO que uno que existe: se hashea
 *    igual contra una sal descartable. Si no, el tiempo de respuesta diría
 *    cuáles de los cuatro nombres son reales, y eso es la mitad del trabajo de
 *    quien quiera entrar.
 */
export async function verifyPassword(
  username: string,
  password: string,
): Promise<User | null> {
  const user = findUser(username);
  const target = user ?? DUMMY;

  const derived = await derive(password, target.salt);
  const expected = Buffer.from(target.hash, 'hex');
  const ok = derived.length === expected.length && timingSafeEqual(derived, expected);

  return ok && user !== null ? user : null;
}

/**
 * Un usuario que no existe, para gastar el mismo tiempo que uno que sí.
 *
 * La sal es fija y el hash es de una contraseña que nadie conoce: nunca puede
 * dar positivo, y de todas formas `verifyPassword` exige que el usuario sea
 * real antes de devolverlo.
 */
const DUMMY: User = {
  username: '',
  displayName: '',
  salt: '00000000000000000000000000000000',
  hash: '0000000000000000000000000000000000000000000000000000000000000000',
};

/** scrypt como promesa, con los parámetros de este archivo. */
export function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, 'hex'), SCRYPT.keylen, SCRYPT, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * Una contraseña nueva al azar, con el mismo formato que las de este archivo.
 *
 * El alfabeto no tiene `0/O` ni `1/l/I`: estas contraseñas se dictan y se
 * tipean a mano. Cuatro grupos de cuatro sobre 32 caracteres son 80 bits.
 */
export function randomPassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    let chunk = '';
    for (let index = 0; index < 4; index += 1) chunk += alphabet[randomInt(alphabet.length)];
    groups.push(chunk);
  }
  return groups.join('-');
}
