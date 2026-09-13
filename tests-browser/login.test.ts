/**
 * LA ENTRADA Y LA ELECCION DE EQUIPO, EN UN NAVEGADOR DE VERDAD.
 *
 * `tests/auth.test.ts` prueba la API de la entrada. Esto prueba las DOS
 * PANTALLAS: que se vean, que rechacen, que dejen entrar, y que la elección de
 * club llegue hasta el plantel que se muestra en la tabla.
 *
 * Es donde aparecieron los dos bugs que el compilador no podía ver: un `null`
 * que viajaba como `undefined` y mandaba al usuario a dirigir River sin
 * preguntarle, y una pantalla de entrada mostrada contra un servidor sin login.
 *
 * EL USUARIO DE PRUEBA se fabrica con `USUARIOS_EXTRA`, porque las cuatro
 * contraseñas reales no están en el repositorio. Es el mismo mecanismo con el
 * que se sumaría un quinto jugador.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import { randomBytes, scryptSync } from 'node:crypto';
import {
  SKIP_MESSAGE,
  launchOptions,
  loadPlaywright,
  openPage,
  type Browser,
  type Page,
} from './harness.ts';

const DIST_DIR = resolve(import.meta.dirname, '..', 'dist');
const DIST = join(DIST_DIR, 'index.html');

const PASSWORD = 'contrasena-de-prueba-del-navegador';
const SALT = randomBytes(16).toString('hex');
const HASH = scryptSync(PASSWORD, Buffer.from(SALT, 'hex'), 32, {
  N: 16384,
  r: 8,
  p: 1,
}).toString('hex');

process.env['USUARIOS_EXTRA'] = JSON.stringify([
  { username: 'navegante', displayName: 'Navegante', salt: SALT, hash: HASH },
]);
process.env['SESSION_SECRET'] = 'secreto-de-pruebas-del-navegador-largo';

let browser: Browser | null = null;
let server: Server | null = null;
let url = '';
let dataDir = '';
let unavailable: string | null = null;

before(async () => {
  if (!existsSync(DIST)) {
    unavailable = 'Falta la interfaz construida. Corré `npm run build`.';
    return;
  }
  const playwright = await loadPlaywright();
  if (!playwright) {
    unavailable = SKIP_MESSAGE;
    return;
  }
  try {
    browser = await playwright.chromium.launch(launchOptions());
  } catch (cause) {
    unavailable = `No se pudo abrir Chromium: ${(cause as Error).message.split('\n')[0]}`;
    return;
  }

  const { createApi } = await import('../src/server/api.ts');
  const { serveStatic } = await import('../src/server/static-files.ts');
  dataDir = mkdtempSync(join(tmpdir(), 'login-browser-'));
  // CON LOGIN: es lo que este archivo prueba, así que acá no se apaga.
  const api = createApi({ dataDir });
  const files = serveStatic(DIST_DIR);
  server = createServer((request, response) => {
    void api(request, response).then((handled) => {
      if (handled) return true;
      return files(request, response).then((served) => {
        if (served) return true;
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end('no');
        return true;
      });
    });
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  const address = server?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('sin puerto');
  }
  url = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await browser?.close();
  if (server !== null) await new Promise<void>((done) => server?.close(() => done()));
  if (dataDir !== '') rmSync(dataDir, { recursive: true, force: true });
});

function uiTest(name: string, body: (page: Page, errors: string[]) => Promise<void>): void {
  test(name, async (t) => {
    if (unavailable !== null) {
      t.skip(unavailable);
      return;
    }
    // `null`: no se siembra club, porque acá se quiere llegar al elector.
    const { page, errors } = await openPage(browser as Browser, null);
    await body(page, errors);
  });
}

uiTest('SIN ENTRAR NO SE VE EL JUEGO: se ve la entrada', async (page) => {
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.login__box');

  assert.equal(await page.locator('.login__input').count(), 2, 'usuario y contraseña');
  assert.equal(await page.locator('.topbar').count(), 0, 'el juego no puede estar detrás');
  // Y no filtra quiénes juegan.
  const texto = await page.locator('.login').innerText();
  assert.ok(!/lhs237|Tomy|Kezman|fercha07/i.test(texto), 'la entrada no lista usuarios');
});

uiTest('una contraseña incorrecta no entra y lo dice', async (page) => {
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.login__box');

  await page.locator('#login-usuario').fill('navegante');
  await page.locator('#login-contrasena').fill('no-es-esta');
  await page.locator('.login__box button[type=submit]').click();

  await page.waitForSelector('.login__error');
  assert.match(await page.locator('.login__error').innerText(), /incorrect/i);
  assert.equal(await page.locator('.topbar').count(), 0, 'no puede haber entrado');
  // La contraseña se limpia, el usuario queda: lo más probable es un dedazo.
  assert.equal(await page.locator('#login-contrasena').inputValue(), '');
  assert.equal(await page.locator('#login-usuario').inputValue(), 'navegante');
});

uiTest('ENTRAR LLEVA AL ELECTOR, ELEGIR LLEVA AL JUEGO', async (page, errors) => {
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.login__box');

  await page.locator('#login-usuario').fill('navegante');
  await page.locator('#login-contrasena').fill(PASSWORD);
  await page.locator('.login__box button[type=submit]').click();

  // 1. El elector, con los veinte clubes y saludando por el nombre.
  await page.waitForSelector('.picker__grid');
  // Sin distinguir mayúsculas: el saludo se muestra con `text-transform`, así
  // que `innerText` devuelve "HOLA, NAVEGANTE".
  assert.match(await page.locator('.picker__kicker').innerText(), /navegante/i);
  assert.equal(await page.locator('.picker__club').count(), 20, 'los veinte clubes');

  // 2. No se puede empezar sin elegir.
  const confirmar = page.locator('.picker__foot button');
  assert.equal(await confirmar.isEnabled(), false, 'sin club elegido no se puede seguir');

  // 3. Se elige Vélez y lo confirma antes de empezar.
  await page.locator('.picker__club[data-club="velez"]').click();
  assert.match(await page.locator('.picker__chosenName').innerText(), /V[eé]lez/);
  await confirmar.click();

  // 4. El juego, con el club elegido.
  await page.waitForSelector('.topbar');
  assert.match(await page.locator('.topbar__right').innerText(), /Navegante/i);

  // 5. Y el plantel que se ve es el de Vélez, no el de River.
  await page.goto(`${url}/#/equipo/plantel`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr');
  const filas = await page.locator('table tbody tr').count();
  assert.equal(filas, 20, 'Vélez tiene veinte jugadores en el archivo');

  assert.deepEqual(
    errors.filter((message) => !/api\/salud/.test(message) && !/404/.test(message)),
    [],
    'la consola tiene que quedar limpia',
  );
});

uiTest('RECARGAR NO VUELVE A PREGUNTAR, y salir sí', async (page) => {
  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.login__box');
  await page.locator('#login-usuario').fill('navegante');
  await page.locator('#login-contrasena').fill(PASSWORD);
  await page.locator('.login__box button[type=submit]').click();

  // Ya eligió club en el test anterior: la partida es del usuario y vive en el
  // servidor, así que este login cae directo en el juego.
  await page.waitForSelector('.topbar');

  await page.goto(`${url}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar');
  assert.equal(await page.locator('.login__box').count(), 0, 'no tiene que pedir entrar de nuevo');
  assert.equal(await page.locator('.picker__grid').count(), 0, 'ni elegir club de nuevo');

  await page.locator('.topbar__logout').click();
  await page.waitForSelector('.login__box');
  assert.equal(await page.locator('.topbar').count(), 0, 'salir tiene que cerrar el juego');
});
