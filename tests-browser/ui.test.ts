/**
 * LOS FLUJOS DE LA INTERFAZ, EN UN NAVEGADOR DE VERDAD (fase 8).
 *
 * Cubren lo que `tests/ui-logic.test.ts` no puede: navegacion, drag & drop,
 * cambio de formacion en pantalla, paneles, guardado y las pantallas de la
 * fase 6. Eso antes era `scripts/ui-smoke.mjs`, que imprimia "OK" y "FALLA" y
 * devolvia cero siempre: habia que correrlo y leer la salida con cuidado.
 *
 *     npm run build
 *     npm i --no-save playwright && npm run test:ui
 *
 * Sin Playwright se saltean con un mensaje que dice como instalarlo, en lugar
 * de fallar. Ver `harness.ts` para el porque.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SKIP_MESSAGE,
  benchRow,
  launchOptions,
  loadPlaywright,
  openPage,
  serveBuild,
  type Browser,
  type Page,
} from './harness.ts';

const DIST = resolve(import.meta.dirname, '..', 'dist', 'index.html');

let browser: Browser | null = null;
let base = '';
let stopServer: (() => Promise<void>) | null = null;
let unavailable: string | null = null;

before(async () => {
  if (!existsSync(DIST)) {
    unavailable = 'Falta la interfaz construida. Corré `npm run build` antes de `npm run test:ui`.';
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
    // El navegador puede faltar aunque la libreria este: pasa cuando el
    // Chromium instalado no es el que espera esta version de Playwright.
    unavailable = `No se pudo abrir Chromium: ${(cause as Error).message.split('\n')[0]}. ` +
      'Probá con CHROMIUM_PATH=/ruta/al/chromium.';
    return;
  }
  const server = await serveBuild();
  base = server.url;
  stopServer = server.stop;
});

after(async () => {
  await browser?.close();
  await stopServer?.();
});

/**
 * Un test de navegador.
 *
 * Se saltea cuando falta la herramienta, y falla cuando falla lo que mide. Que
 * las dos cosas se distingan es el punto de esta funcion.
 */
function browserTest(name: string, body: (page: Page, errors: string[]) => Promise<void>): void {
  test(name, async (t) => {
    if (unavailable !== null) {
      t.skip(unavailable);
      return;
    }
    const { page, errors } = await openPage(browser as Browser);
    await body(page, errors);
    assert.deepEqual(errors, [], `la pantalla tiró errores de consola: ${errors.join(' | ')}`);
  });
}

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${base}/#${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
}

// ============================================================
// Navegación y alineación (fase 2)
// ============================================================

browserTest('la navegación lleva a cada pantalla y el título la nombra', async (page) => {
  await open(page, '/equipo/alineacion');
  await page.click('.sidebar__item:has-text("Plantel")');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.clubheader__title').textContent(), 'Plantel');

  await page.click('.sidebar__item:has-text("Alineación")');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.clubheader__title').textContent(), 'Alineación');
});

browserTest('la cancha arranca con los once puestos ocupados', async (page) => {
  await open(page, '/equipo/alineacion');
  assert.equal(await page.locator('.pitch__chipbtn').count(), 11);
});

browserTest('cambiar de formación llena los once y conserva a los jugadores', async (page) => {
  await open(page, '/equipo/alineacion');
  const before = await page.locator('.pitch__chipbtn .chip__name').allTextContents();

  await page.selectOption('.formationpick select', '3-5-2');
  await page.waitForTimeout(300);
  const after = await page.locator('.pitch__chipbtn .chip__name').allTextContents();

  assert.equal(after.length, 11, 'la formación nueva tiene que quedar completa');
  const kept = after.filter((name) => before.includes(name)).length;
  assert.ok(kept >= 9, `se perdieron demasiados jugadores al cambiar: ${kept}/11`);
});

browserTest('arrastrar un suplente a la cancha lo pone y mueve las métricas', async (page) => {
  await open(page, '/equipo/alineacion');
  const metricBefore = await page
    .locator('.metricrow:has-text("Ataque") .metricrow__value')
    .textContent();

  const source = await benchRow(page, 'DC');
  const target = page
    .locator('.pitch__slot')
    .filter({ has: page.locator('.chip') })
    .nth(1);
  const nameBefore = await target.locator('.chip__name').textContent();
  await source.dragTo(target);
  await page.waitForTimeout(400);

  assert.notEqual(await target.locator('.chip__name').textContent(), nameBefore);
  assert.equal(await page.locator('.pitch__chipbtn').count(), 11, 'la cancha sigue completa');
  assert.notEqual(
    await page.locator('.metricrow:has-text("Ataque") .metricrow__value').textContent(),
    metricBefore,
    'cambiar el once tiene que mover las métricas',
  );
});

browserTest('avisa los cambios sin guardar y confirma el guardado', async (page) => {
  await open(page, '/equipo/alineacion');
  const source = await benchRow(page, 'DC');
  await source.dragTo(page.locator('.pitch__slot').filter({ has: page.locator('.chip') }).nth(1));
  await page.waitForTimeout(350);

  assert.equal(await page.locator('.saveind.is-pending').count(), 1, 'tiene que avisar');
  await page.click('button:has-text("Guardar equipo")');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.saveind.is-ok').count(), 1, 'tiene que confirmar');
});

browserTest('la ficha rápida se abre sin salir de la pantalla', async (page) => {
  await open(page, '/equipo/alineacion');
  await page.locator('.pitch__chipbtn').first().click();
  await page.waitForTimeout(300);

  assert.equal(await page.locator('.drawer').count(), 1);
  assert.equal(
    await page.locator('.clubheader__title').textContent(),
    'Alineación',
    'la ficha no puede navegar a otra pantalla',
  );
  await page.keyboard.press('Escape');
});

browserTest('un jugador fuera de puesto se marca y muestra lo que pierde', async (page) => {
  await open(page, '/equipo/alineacion');
  const defender = await benchRow(page, 'DFC');
  const wing = page
    .locator('.pitch__slot')
    .filter({ has: page.locator('.pitch__slotlabel:text-is("ED")') })
    .first();
  await defender.dragTo(wing);
  await page.waitForTimeout(400);

  assert.ok((await page.locator('.chip--outofposition').count()) >= 1, 'tiene que marcarse');
  await page.locator('.chip--outofposition').first().click();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator('.outofpos').count(),
    1,
    'la ficha tiene que mostrar overall natural contra efectivo',
  );
  await page.keyboard.press('Escape');
});

browserTest('el panel de táctica cambia el estilo del equipo', async (page) => {
  await open(page, '/equipo/alineacion');
  await page.click('button:has-text("Configurar táctica")');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.tacticsform').count(), 1);

  await page.click('.choice__option:has-text("Directo")');
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator('.tacticsummary__row:has-text("Estilo") .tacticsummary__value').textContent(),
    'Directo',
  );
  await page.keyboard.press('Escape');
});

browserTest('autoseleccionar arma los once sin poner a nadie muy fuera de puesto', async (page) => {
  await open(page, '/equipo/alineacion');
  await page.click('button:has-text("Autoseleccionar XI")');
  await page.waitForTimeout(400);

  assert.equal(await page.locator('.pitch__chipbtn').count(), 11);

  // NO se exige cero fichas corridas: River 98 no tiene ningún extremo
  // izquierdo natural, así que alguien tiene que jugar ahí fuera de puesto.
  // Lo que sí se exige es que nadie quede MUY corrido.
  const deltas = (await page.locator('.chip--outofposition .chip__delta').allTextContents()).map(
    Number,
  );
  const worst = deltas.length > 0 ? Math.min(...deltas) : 0;
  assert.ok(worst >= -6, `alguien quedó muy fuera de puesto: ${worst}`);
});

browserTest('el banco tiene suplentes y el plantel se filtra y se ordena', async (page) => {
  await open(page, '/equipo/alineacion');
  assert.ok((await page.locator('.bench__chip').count()) >= 5, 'tiene que haber banco');

  await open(page, '/equipo/plantel');
  const all = await page.locator('.squadtable__table tbody tr').count();
  await page.click('.tabs__tab:has-text("POR")');
  await page.waitForTimeout(250);
  const keepers = await page.locator('.squadtable__table tbody tr').count();
  assert.ok(keepers > 0, 'el filtro de arqueros no puede dejar la tabla vacía');
  assert.ok(keepers < all, `el filtro no filtró nada: ${keepers} de ${all}`);

  await page.click('.tabs__tab:has-text("Todos")');
  await page.waitForTimeout(200);
  await page.click('.th-sort:has-text("OVR")');
  await page.waitForTimeout(250);
  const ratings = (
    await page.locator('.squadtable__table tbody .rating').allTextContents()
  ).map(Number);
  assert.ok(ratings.length > 5, 'tiene que haber overalls para ordenar');
  const sorted = [...ratings].sort((a, b) => b - a);
  assert.deepEqual(ratings, sorted, 'ordenar por overall tiene que ordenar de verdad');
});

// ============================================================
// Estadio y finanzas (fase 6)
// ============================================================

browserTest('el balance no muestra ninguna línea sin explicación', async (page) => {
  await open(page, '/club/finanzas');
  assert.equal(await page.locator('.placeholder').count(), 0, 'la pantalla tiene que existir');

  const rows = await page.locator('.ledger__row').count();
  const sources = await page.locator('.ledger__source').count();
  assert.ok(rows >= 8, `el balance tiene que estar desglosado: ${rows} líneas`);
  assert.equal(sources, rows, 'cada línea tiene que decir de dónde sale su número');

  for (const text of await page.locator('.ledger__source').allTextContents()) {
    assert.ok(text.trim().length > 0, 'una línea tiene el origen vacío');
  }
});

browserTest('el estadio muestra el dato real del archivo', async (page) => {
  await open(page, '/club/estadio');
  const summary = await page.locator('.clubsummary').innerText();
  // River en 1998: 76.687 de aforo y 63.000 socios, los dos del PKF.
  assert.match(summary, /76\.687/, 'la capacidad real tiene que estar');
  assert.match(summary, /63\.000/, 'los socios reales tienen que estar');
});

browserTest('la curva de precios tiene un máximo y no está en el borde', async (page) => {
  await open(page, '/club/estadio');
  const bars = await page.locator('.pricecurve__col').count();
  assert.ok(bars >= 8, `la curva necesita barras para comparar: ${bars}`);
  assert.equal(
    await page.locator('.pricecurve__bar.is-best').count(),
    1,
    'tiene que haber exactamente un precio que recaude más',
  );

  // Y el mejor precio NO puede ser el primero ni el último: si lo fuera, la
  // decisión del manager sería "poné el mínimo" o "poné el máximo".
  const bestIndex = await page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.pricecurve__col'));
    return cols.findIndex((col) => col.querySelector('.pricecurve__bar.is-best') !== null);
  });
  assert.ok(bestIndex > 0, 'el mejor precio no puede ser el mínimo');
  assert.ok(bestIndex < bars - 1, 'el mejor precio no puede ser el máximo');
});

browserTest('mover el precio cambia la previsión del próximo partido', async (page) => {
  await open(page, '/club/estadio');
  const before = await page.locator('.ticketpick__stats').innerText();
  await page.locator('.ticketpick__range').fill('1500');
  await page.waitForTimeout(300);
  const after = await page.locator('.ticketpick__stats').innerText();
  assert.notEqual(after, before, 'el deslizador tiene que mover la previsión');
});

browserTest('se puede encarar una ampliación y queda en curso', async (page) => {
  await open(page, '/club/estadio');
  assert.equal(await page.locator('.expandcard').count(), 3, 'tres opciones de ampliación');

  const affordable = page.locator('.expandcard button:not([disabled])');
  assert.ok(
    (await affordable.count()) >= 1,
    'con la caja inicial tiene que poder encararse al menos una: si no, la pantalla es decorado',
  );
  await affordable.first().click();
  await page.waitForTimeout(700);

  assert.equal(await page.locator('.stadiumwork').count(), 1, 'la obra tiene que quedar en curso');
  const head = await page.locator('.stadiumwork__head').innerText();
  assert.match(head, /semanas? restantes?/i, 'la obra tiene que declarar cuánto falta');
});

// ============================================================
// Jugar (fase 7) y cerrar la temporada (fase 6)
// ============================================================

browserTest('jugar una fecha deja informe, recaudación y mueve la tabla', async (page) => {
  await open(page, '/competicion/calendario');
  await page.click('button:has-text("Jugar la fecha")');
  await page.waitForTimeout(1500);

  const report = await page.locator('.roundreport').innerText();
  assert.ok(report.length > 0, 'jugar tiene que dejar un informe');

  await open(page, '/competicion/tabla');
  const played = (await page.locator('tbody tr td:nth-child(3)').allTextContents())
    .map(Number)
    .filter((value) => Number.isFinite(value));
  assert.ok(played.length >= 20, 'la tabla tiene que tener los veinte clubes');
  assert.ok(
    played.every((value) => value === played[0]),
    'todos tienen que haber jugado la misma cantidad de fechas',
  );
});

browserTest('cerrar la temporada a medio jugar no se permite', async (page) => {
  await open(page, '/competicion/calendario');
  // Con el torneo en curso el botón de cerrar NO existe: la única forma de
  // cerrar es terminar las 19 fechas.
  assert.equal(
    await page.locator('button:has-text("Cerrar la temporada")').count(),
    0,
    'no puede ofrecerse cerrar con fechas por jugar',
  );
});

browserTest('una ruta de sección lleva a su primera pantalla', async (page) => {
  // `/club` no es una pantalla, es una cabecera. Antes daba "Ruta
  // desconocida", que es cierto y es inútil.
  await open(page, '/club');
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator('.clubheader__title').textContent(),
    'Staff',
    'tendría que haber ido a la primera pantalla de la sección',
  );
});

browserTest('ya no hay ninguna pantalla sin construir', async (page) => {
  // Con las nueve fases entregadas, NINGUNA ruta de la navegación puede
  // mostrar la página de "módulo pendiente". Ese archivo se borró; este test
  // verifica que ninguna pantalla haya quedado sin su página de verdad.
  await open(page, '/');
  const routes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.sidebar__item')).map((item) =>
      (item as HTMLAnchorElement).getAttribute('href') ?? '',
    ),
  );
  assert.ok(routes.length >= 15, `la navegación tiene ${routes.length} pantallas`);

  for (const route of routes) {
    const path = route.replace(/^#/, '');
    if (path === '') continue;
    await open(page, path);
    assert.equal(
      await page.locator('.placeholder__phase').count(),
      0,
      `${path} sigue mostrando la página de módulo pendiente`,
    );
    assert.equal(
      await page.locator('.placeholder__title').count(),
      0,
      `${path} no tiene pantalla propia`,
    );
  }
});
