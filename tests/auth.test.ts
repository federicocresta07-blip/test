/**
 * LA ENTRADA.
 *
 * Lo que estos tests cuidan es UNA cosa: que la partida de cada uno sea de
 * cada uno. Antes de esta fase el servidor identificaba la partida por un
 * nombre que el cliente mandaba, así que quien supiera el nombre de otra
 * carrera la abría. Ahora sale de una cookie firmada, y acá se comprueba que
 * no haya forma de pedir la de otro.
 *
 * LAS CONTRASEÑAS DE VERDAD NO ESTAN EN EL REPOSITORIO, que es el punto de
 * guardar hashes. Para probar el camino de "contraseña correcta entra" se
 * fabrica un usuario de prueba con `USUARIOS_EXTRA`, que es el mismo mecanismo
 * que serviría para sumar un quinto jugador.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';

const ROOT = resolve(import.meta.dirname, '..');

// ============================================================
// El usuario de prueba, con una contrasena que este archivo conoce
// ============================================================

const PASSWORD = 'contrasena-de-prueba-larga';
const SALT = randomBytes(16).toString('hex');
const HASH = scryptSync(PASSWORD, Buffer.from(SALT, 'hex'), 32, {
  N: 16384,
  r: 8,
  p: 1,
}).toString('hex');

process.env['USUARIOS_EXTRA'] = JSON.stringify([
  { username: 'probador', displayName: 'Probador', salt: SALT, hash: HASH },
  { username: 'otro', displayName: 'Otro', salt: SALT, hash: HASH },
]);
process.env['SESSION_SECRET'] = 'un-secreto-de-pruebas-suficientemente-largo';

const { createApi } = await import('../src/server/api.ts');
const { verifyPassword, fixedUsernames, findUser } = await import('../src/server/users.ts');
const { sessionCookie } = await import('../src/server/auth.ts');
const { resetThrottle } = await import('../src/server/login.ts');

let server: Server | null = null;
let base = '';
let dataDir = '';

before(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'auth-'));
  const api = createApi({ dataDir });
  server = createServer((request, response) => {
    void api(request, response).then((handled) => {
      if (handled) return;
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('no');
    });
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  const address = server?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('sin puerto');
  }
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((done) => server?.close(() => done()));
  rmSync(dataDir, { recursive: true, force: true });
});

type Reply = {
  readonly status: number;
  readonly cookie: string | null;
  readonly partida: string | null;
  readonly body: Record<string, unknown>;
};

async function call(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const response = await fetch(base + path, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.cookie !== undefined ? { cookie: options.cookie } : {}),
      ...(options.headers ?? {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie'),
    partida: response.headers.get('x-partida'),
    body,
  };
}

/** Entra y devuelve la cookie de sesión, lista para mandar. */
async function enter(usuario: string, contrasena = PASSWORD): Promise<string> {
  resetThrottle();
  const reply = await call('/api/login', {
    method: 'POST',
    body: { usuario, contrasena },
  });
  assert.equal(reply.status, 200, `no pudo entrar ${usuario}: ${JSON.stringify(reply.body)}`);
  const cookie = reply.cookie?.split(';')[0];
  assert.ok(cookie !== undefined, 'el login tiene que poner una cookie');
  return cookie;
}

// ============================================================
// Los cuatro usuarios
// ============================================================

test('LOS CUATRO USUARIOS EXISTEN, con su nombre de pila', () => {
  assert.deepEqual([...fixedUsernames()].sort(), ['Kezman', 'Tomy', 'fercha07', 'lhs237'].sort());
  assert.equal(findUser('lhs237')?.displayName, 'Lucas');
  assert.equal(findUser('Tomy')?.displayName, 'Tomás');
  assert.equal(findUser('Kezman')?.displayName, 'Agustín');
  assert.equal(findUser('fercha07')?.displayName, 'fede');
});

test('TODO NOMBRE DE USUARIO ES UN NOMBRE DE PARTIDA VALIDO', async () => {
  // El nombre de usuario ES el nombre de su partida, y con el almacén de
  // archivos eso es un NOMBRE DE ARCHIVO. Un usuario que se llamara `../etc`
  // escribiría fuera de la carpeta de partidas.
  //
  // `file-store.ts` lo rechaza igual —la validación está en los dos lados— así
  // que esto comprueba que no exista un usuario que el propio almacén no
  // pueda aceptar: sería alguien que puede entrar y no puede jugar.
  const { isValidGameId } = await import('../src/server/file-store.ts');
  for (const username of fixedUsernames()) {
    assert.ok(isValidGameId(username), `"${username}" no sirve como nombre de partida`);
  }
});

test('el nombre de usuario no distingue mayúsculas, pero la partida es una sola', () => {
  // Nadie se acuerda de cómo escribió su propio nombre. Lo que NO puede pasar
  // es que `Tomy` y `tomy` sean dos carreras distintas.
  assert.equal(findUser('TOMY')?.username, 'Tomy');
  assert.equal(findUser('tomy')?.username, 'Tomy');
  assert.equal(findUser('  Tomy  ')?.username, 'Tomy');
});

test('NINGUNA CONTRASEÑA ESTA EN EL REPOSITORIO, solo hashes', () => {
  const source = readFileSync(join(ROOT, 'src', 'server', 'users.ts'), 'utf8');

  // Cada usuario tiene sal y hash con la forma que produce scrypt, y nada más
  // que se parezca a una contraseña.
  const salts = [...source.matchAll(/salt: '([0-9a-f]+)'/g)].map((m) => m[1] ?? '');
  const hashes = [...source.matchAll(/hash: '([0-9a-f]+)'/g)].map((m) => m[1] ?? '');
  assert.ok(salts.length >= 4, 'tienen que estar las cuatro sales');
  assert.ok(hashes.length >= 4, 'tienen que estar los cuatro hashes');
  for (const salt of salts) assert.equal(salt.length, 32, 'la sal son 16 bytes');
  for (const hash of hashes) assert.equal(hash.length, 64, 'el hash son 32 bytes');

  // Y no hay ningún campo que se llame como una contraseña.
  assert.ok(
    !/\b(password|contrase|clave)\s*[:=]\s*'/i.test(source),
    'no puede haber una contraseña escrita en el archivo',
  );
});

test('una contraseña incorrecta y un usuario inexistente dicen LO MISMO', async () => {
  resetThrottle();
  const mala = await call('/api/login', {
    method: 'POST',
    body: { usuario: 'probador', contrasena: 'no-es-esta' },
  });
  const inexistente = await call('/api/login', {
    method: 'POST',
    body: { usuario: 'nadie-de-aca', contrasena: 'cualquiera' },
  });

  assert.equal(mala.status, 401);
  assert.equal(inexistente.status, 401);
  // Si los mensajes fueran distintos, probando nombres se averigua quiénes
  // juegan, que es la mitad del trabajo de entrar.
  assert.equal(mala.body['error'], inexistente.body['error']);
  assert.equal(mala.cookie, null, 'un login fallido no pone cookie');
});

test('la contraseña correcta entra', async () => {
  const user = await verifyPassword('probador', PASSWORD);
  assert.equal(user?.username, 'probador');

  resetThrottle();
  const reply = await call('/api/login', {
    method: 'POST',
    body: { usuario: 'probador', contrasena: PASSWORD },
  });
  assert.equal(reply.status, 200);
  assert.equal(reply.body['nombre'], 'Probador');
  assert.match(reply.cookie ?? '', /HttpOnly/, 'ningún script puede leer la cookie');
  assert.match(reply.cookie ?? '', /SameSite=Lax/);
});

// ============================================================
// Lo que la sesion protege
// ============================================================

test('SIN SESION NO SE JUEGA', async () => {
  const reply = await call('/api/rpc', {
    method: 'POST',
    body: { method: 'loadGame', args: [] },
  });
  assert.equal(reply.status, 401, 'sin cookie, el juego no contesta');
});

test('LA PARTIDA ES LA DEL USUARIO, y no la que pida el cliente', async () => {
  const cookie = await enter('probador');

  // El mecanismo viejo: pedir una partida por header. Ya no manda.
  const reply = await call('/api/rpc', {
    method: 'POST',
    body: { method: 'loadGame', args: [] },
    cookie,
    headers: { 'x-partida': 'otro' },
  });

  assert.equal(reply.status, 200);
  assert.equal(
    reply.partida,
    'probador',
    'pidió la partida de "otro" con una sesión de "probador" y tiene que recibir la suya',
  );
});

test('DOS USUARIOS NO SE VEN: cada uno su club y su carrera', async () => {
  const uno = await enter('probador');
  const dos = await enter('otro');

  await call('/api/rpc', { method: 'POST', body: { method: 'chooseTeam', args: ['boca'] }, cookie: uno });
  await call('/api/rpc', { method: 'POST', body: { method: 'chooseTeam', args: ['velez'] }, cookie: dos });

  const deUno = await call('/api/rpc', { method: 'POST', body: { method: 'currentTeam', args: [] }, cookie: uno });
  const deDos = await call('/api/rpc', { method: 'POST', body: { method: 'currentTeam', args: [] }, cookie: dos });

  assert.equal(deUno.body['result'], 'boca');
  assert.equal(deDos.body['result'], 'velez');

  // Y en el disco son dos partidas separadas, una por usuario.
  const files = readdirSync(dataDir).sort();
  assert.ok(files.includes('probador.json'));
  assert.ok(files.includes('otro.json'));
});

test('UNA COOKIE RETOCADA NO SIRVE: ni el usuario, ni el vencimiento', async () => {
  const cookie = await enter('probador');
  const value = decodeURIComponent(cookie.slice('sesion='.length));
  const [usuario, vence, firma] = value.split('.') as [string, string, string];

  const forge = async (raw: string): Promise<number> => {
    const reply = await call('/api/rpc', {
      method: 'POST',
      body: { method: 'loadGame', args: [] },
      cookie: `sesion=${encodeURIComponent(raw)}`,
    });
    return reply.status;
  };

  assert.equal(await forge(`otro.${vence}.${firma}`), 401, 'cambiar el usuario no puede servir');
  assert.equal(
    await forge(`${usuario}.${Number(vence) + 9_999_999}.${firma}`),
    401,
    'estirar el vencimiento no puede servir',
  );
  assert.equal(await forge(`${usuario}.1000.${firma}`), 401, 'una sesión vencida no vale');
  assert.equal(await forge(`${usuario}.${vence}.firmainventada`), 401, 'la firma tiene que cerrar');
  // Y la de verdad sí.
  assert.equal(await forge(value), 200, 'la cookie real tiene que seguir andando');
});

test('una cookie firmada de alguien que ya no existe no vale', async () => {
  // Se firma con el secreto real, así que la firma cierra. Lo que no cierra es
  // que el usuario esté: sacar a alguien de `users.ts` le corta la sesión.
  const raw = sessionCookie('fantasma', false).split(';')[0] ?? '';
  const reply = await call('/api/rpc', {
    method: 'POST',
    body: { method: 'loadGame', args: [] },
    cookie: raw,
  });
  assert.equal(reply.status, 401);
});

test('salir corta la sesión', async () => {
  const cookie = await enter('probador');
  const out = await call('/api/logout', { method: 'POST', cookie });
  assert.equal(out.status, 200);
  assert.match(out.cookie ?? '', /Max-Age=0/, 'la respuesta tiene que borrar la cookie');
});

test('/api/sesion dice si HACE FALTA entrar, no solo si entraste', async () => {
  // La diferencia importa: un servidor sin login y un usuario sin sesión
  // responderían lo mismo, y la interfaz mostraría la pantalla de entrada
  // contra un servidor donde `/api/login` no existe.
  const sinEntrar = await call('/api/sesion');
  assert.equal(sinEntrar.status, 200, 'preguntar quién soy no es un acceso denegado');
  assert.equal(sinEntrar.body['login'], false);
  assert.equal(sinEntrar.body['requerido'], true);

  const cookie = await enter('probador');
  const entrando = await call('/api/sesion', { cookie });
  assert.equal(entrando.body['login'], true);
  assert.equal(entrando.body['usuario'], 'probador');
});

test('demasiados intentos fallidos frenan', async () => {
  resetThrottle();
  let last = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const reply = await call('/api/login', {
      method: 'POST',
      body: { usuario: 'probador', contrasena: 'mal' },
    });
    last = reply.status;
  }
  assert.equal(last, 429, 'después de varios fallos tiene que frenar');

  // Y el freno no es la defensa principal: existe porque scrypt cuesta, y sin
  // límite mil logins por segundo consumen la función entera.
  resetThrottle();
  const reply = await call('/api/login', {
    method: 'POST',
    body: { usuario: 'probador', contrasena: PASSWORD },
  });
  assert.equal(reply.status, 200, 'reiniciado el contador, la contraseña correcta entra');
});

test('la salud sigue siendo pública: la interfaz la necesita antes de entrar', async () => {
  const reply = await call('/api/salud');
  assert.equal(reply.status, 200);
  assert.deepEqual(reply.body, { ok: true });
});
