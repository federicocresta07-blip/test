/**
 * LA INTERFAZ CONTRA EL SERVIDOR DE VERDAD (fase 8).
 *
 * Es la prueba de la promesa de la fase 0: "hoy detrás hay mocks, mañana una
 * API, y ningún componente cambia". `tests/server.test.ts` verifica que la API
 * responda bien; esto verifica que la INTERFAZ funcione con ella, que es otra
 * cosa: entre las dos hay un cliente HTTP, una detección de origen y la
 * serialización de todo el estado del juego.
 *
 * Y verifica lo que el servidor habilita y `localStorage` no podía: que la
 * partida sobreviva a cambiar de navegador.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  SKIP_MESSAGE,
  launchOptions,
  loadPlaywright,
  serveBuild,
  type Browser,
  type Page,
  type Served,
  passPicker,
} from './harness.ts';

const DIST = resolve(import.meta.dirname, '..', 'dist', 'index.html');

let browser: Browser | null = null;
let served: Served | null = null;
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
  // CON API: es la diferencia con `ui.test.ts`, que sirve solo los archivos.
  served = await serveBuild(true);
});

after(async () => {
  await browser?.close();
  await served?.stop();
});

/** Una pestaña nueva en su propio contexto: cookie propia, partida propia. */
async function freshTab(): Promise<{ readonly page: Page; readonly close: () => Promise<void> }> {
  const context = (await (
    browser as unknown as {
      newContext(options: unknown): Promise<{
        newPage(): Promise<Page>;
        close(): Promise<void>;
      }>;
    }
  ).newContext({ viewport: { width: 1440, height: 950 } }));
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

function serverTest(name: string, body: (served: Served) => Promise<void>): void {
  test(name, async (t) => {
    if (unavailable !== null) {
      t.skip(unavailable);
      return;
    }
    await body(served as Served);
  });
}

serverTest('la interfaz usa el servidor cuando hay uno detrás', async (s) => {
  const tab = await freshTab();
  try {
    const calls: string[] = [];
    tab.page.on('request', (request: never) => {
      const url = (request as unknown as { url(): string }).url();
      if (url.includes('/api/rpc')) calls.push(url);
    });

    await tab.page.goto(`${s.url}/#/club/estadio`, { waitUntil: 'networkidle' });
    await passPicker(tab.page);
    await tab.page.waitForTimeout(1200);

    assert.ok(calls.length > 0, 'el estado tendría que venir por la API');
    // Y la pantalla se dibujó con lo que vino por HTTP.
    const summary = await tab.page.locator('.clubsummary').innerText();
    assert.match(summary, /76\.687/, 'el estadio real tiene que llegar por la API');
  } finally {
    await tab.close();
  }
});

serverTest('LA PARTIDA SOBREVIVE A CAMBIAR DE NAVEGADOR', async (s) => {
  // Es lo que `localStorage` no podía. Se juega en una pestaña, se lee la
  // partida de la cookie, y se abre OTRO contexto —otro navegador, a efectos
  // de almacenamiento— pidiendo esa misma partida.
  const first = await freshTab();
  let partida = '';
  try {
    await first.page.goto(`${s.url}/#/club/estadio`, { waitUntil: 'networkidle' });
    await passPicker(first.page);
    await first.page.waitForTimeout(1200);

    await first.page.locator('.ticketpick__range').fill('1800');
    await first.page.waitForTimeout(250);
    await first.page.locator('button:has-text("Fijar este precio")').click();
    await first.page.waitForTimeout(1200);
    assert.match(
      await first.page.locator('.clubsummary').innerText(),
      /1\.800/,
      'el precio nuevo tendría que quedar fijado',
    );

    // El nombre de la partida, del archivo que el servidor escribió.
    const files = readdirSync(s.dataDir as string);
    const withPrice = files.find((file) => {
      const raw = JSON.parse(readFileSync(join(s.dataDir as string, file), 'utf8')) as Record<
        string,
        string
      >;
      const development = raw['manager:desarrollo:v1'];
      return development !== undefined && JSON.parse(development).ticketPrice === 1_800;
    });
    assert.ok(withPrice, 'el precio tendría que estar escrito en un archivo de partida');
    partida = withPrice.replace(/\.json$/, '');
  } finally {
    await first.close();
  }

  // Otro contexto: sin la cookie, no ve nada.
  const clean = await freshTab();
  try {
    await clean.page.goto(`${s.url}/#/club/estadio`, { waitUntil: 'networkidle' });
    await passPicker(clean.page);
    await clean.page.waitForTimeout(1200);
    const fresh = await clean.page.locator('.clubsummary').innerText();
    assert.ok(!/1\.800/.test(fresh), 'una partida nueva no puede ver la de otro');
  } finally {
    await clean.close();
  }

  // Y con el nombre de la partida en la URL, la carrera vuelve entera.
  //
  // `?partida=nombre` es el mecanismo real, y existe por esto: el servidor
  // identifica la partida con una cookie `HttpOnly`, que ningun script puede
  // leer ni escribir —asi tiene que ser— y que no se puede llevar a otra
  // maquina a mano. Sin el parametro, la partida del servidor seria
  // inalcanzable desde otro navegador, y el primer intento de este test lo
  // descubrio tratando de poner la cookie desde la pagina.
  const resumed = await freshTab();
  try {
    await resumed.page.goto(`${s.url}/?partida=${partida}#/club/estadio`, {
      waitUntil: 'networkidle',
    });
    await passPicker(resumed.page);
    await resumed.page.waitForTimeout(1500);

    assert.match(
      await resumed.page.locator('.clubsummary').innerText(),
      /1\.800/,
      'con el nombre de la partida, la carrera tiene que volver',
    );
    // Y la barra superior lo dice, para que se pueda anotar. Se compara sin
    // distinguir mayúsculas: el badge se muestra con `text-transform`, así
    // que `innerText` devuelve el nombre en mayúsculas.
    assert.match(
      await resumed.page.locator('.topbar__right').innerText(),
      new RegExp(partida, 'i'),
      'la interfaz tiene que mostrar en qué partida está',
    );
  } finally {
    await resumed.close();
  }
});

serverTest('jugar contra el servidor mueve la tabla y la caja', async (s) => {
  const tab = await freshTab();
  try {
    await tab.page.goto(`${s.url}/#/club/finanzas`, { waitUntil: 'networkidle' });
    await passPicker(tab.page);
    await tab.page.waitForTimeout(1200);
    const cashBefore = await tab.page.locator('.clubsummary__value').first().innerText();

    await tab.page.goto(`${s.url}/#/competicion/calendario`, { waitUntil: 'networkidle' });
    await tab.page.waitForTimeout(800);
    // Cuatro fechas: River arranca de visitante, así que hacen falta varias
    // para que entre plata por la puerta.
    for (let round = 0; round < 4; round += 1) {
      await tab.page.click('button:has-text("Jugar la fecha")');
      await tab.page.waitForTimeout(1800);
    }

    await tab.page.goto(`${s.url}/#/club/finanzas`, { waitUntil: 'networkidle' });
    await tab.page.waitForTimeout(1200);
    const cashAfter = await tab.page.locator('.clubsummary__value').first().innerText();
    assert.notEqual(cashAfter, cashBefore, 'la caja tendría que haberse movido');

    await tab.page.goto(`${s.url}/#/competicion/tabla`, { waitUntil: 'networkidle' });
    await tab.page.waitForTimeout(800);
    const played = (await tab.page.locator('tbody tr td:nth-child(3)').allTextContents())
      .map(Number)
      .filter((value) => Number.isFinite(value));
    assert.ok(played.length >= 20);
    assert.ok(
      played.every((value) => value === 4),
      `todos tendrían que tener cuatro fechas: ${played.join(',')}`,
    );
  } finally {
    await tab.close();
  }
});
