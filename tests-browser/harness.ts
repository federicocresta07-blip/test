/**
 * ANDAMIO DE LOS TESTS DE NAVEGADOR (fase 8).
 *
 * ============================================================
 * POR QUE ESTAN EN SU PROPIA CARPETA
 * ============================================================
 *
 * `npm test` no los corre, y es a proposito. Necesitan Playwright, que NO es
 * dependencia del proyecto: la regla de la seccion 21 es no agregar librerias
 * sin razon concreta, y una que descarga un navegador de 150 MB para que
 * `npm install` funcione es una razon que hay que poder elegir.
 *
 *     npm i --no-save playwright && npm run test:ui
 *
 * Sin Playwright instalado, los tests NO FALLAN: se marcan como salteados y
 * dicen como instalarlo. Un test que falla porque falta una herramienta
 * opcional entrena a leer los rojos como ruido, y despues el rojo que importa
 * pasa desapercibido.
 *
 * ============================================================
 * QUE REEMPLAZAN
 * ============================================================
 *
 * `scripts/ui-smoke.mjs` imprimia "OK" y "FALLA" y devolvia cero siempre, asi
 * que no se podia poner en una verificacion automatica: habia que correrlo y
 * LEER la salida. Estos son tests de verdad, con `assert`, que fallan solos.
 */

import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApi, type ApiHandler } from '../src/server/api.ts';
import { serveStatic } from '../src/server/static-files.ts';

export type Browser = {
  readonly newPage: (options?: unknown) => Promise<Page>;
  readonly close: () => Promise<void>;
};

/** Lo que usamos de una pagina de Playwright, sin depender de sus tipos. */
export type Page = {
  goto(url: string, options?: unknown): Promise<unknown>;
  title(): Promise<string>;
  locator(selector: string): Locator;
  click(selector: string): Promise<void>;
  selectOption(selector: string, value: string): Promise<unknown>;
  keyboard: { press(key: string): Promise<void> };
  screenshot(options: { path: string }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: (arg: never) => T, arg?: unknown): Promise<T>;
  on(event: string, handler: (payload: never) => void): void;
};

export type Locator = {
  count(): Promise<number>;
  first(): Locator;
  nth(index: number): Locator;
  innerText(): Promise<string>;
  textContent(): Promise<string | null>;
  allTextContents(): Promise<string[]>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  dragTo(target: Locator): Promise<void>;
  filter(options: unknown): Locator;
  locator(selector: string): Locator;
};

/**
 * Playwright, si esta instalado.
 *
 * Se importa de forma dinamica a proposito: un `import` estatico de una
 * libreria que puede no estar rompe el archivo entero antes de que el test
 * pueda saltearse con un mensaje util.
 */
export async function loadPlaywright(): Promise<{
  readonly chromium: { launch(options?: unknown): Promise<Browser> };
} | null> {
  try {
    return (await import('playwright')) as never;
  } catch {
    return null;
  }
}

export const SKIP_MESSAGE =
  'Playwright no esta instalado. Se instala aparte porque no es dependencia del ' +
  'proyecto: npm i --no-save playwright && npm run test:ui';

/**
 * El Chromium a usar.
 *
 * `CHROMIUM_PATH` existe porque hay entornos donde el navegador instalado no
 * es exactamente el que espera esta version de Playwright, y bajarse otro no
 * siempre es posible.
 */
export function launchOptions(): Record<string, unknown> {
  const executablePath = process.env['CHROMIUM_PATH'];
  return executablePath ? { executablePath } : {};
}

export type Served = {
  readonly url: string;
  /** Carpeta de partidas, cuando el servidor levanto con API. */
  readonly dataDir: string | null;
  readonly stop: () => Promise<void>;
};

/**
 * Levanta la interfaz construida en un puerto libre.
 *
 * `withApi` decide QUE se esta probando, y las dos cosas importan:
 *
 * - sin API: la interfaz sola, como el HTML autocontenido o un hosting
 *   estatico. La partida vive en el navegador.
 * - con API: como `npm run serve`. La partida vive en el servidor, y la
 *   interfaz tiene que funcionar igual sin que ningun componente lo sepa.
 */
export async function serveBuild(withApi = false): Promise<Served> {
  const dist = resolve(import.meta.dirname, '..', 'dist');
  const handler = serveStatic(dist);

  let dataDir: string | null = null;
  let api: ApiHandler | null = null;
  if (withApi) {
    dataDir = mkdtempSync(join(tmpdir(), 'manager-browser-'));
    api = createApi({ dataDir });
  }

  const server: Server = createServer((request, response) => {
    const chain = api
      ? api(request, response).then((handled) => (handled ? true : handler(request, response)))
      : handler(request, response);
    void chain.then((handled) => {
      if (handled) return;
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('No encontrado');
    });
  });

  // Puerto 0: el sistema elige uno libre. Fijar un puerto hace que dos
  // corridas en paralelo se peleen, y eso es un test que falla por el motivo
  // equivocado.
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('El servidor no devolvio un puerto');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    dataDir,
    stop: async () => {
      await new Promise<void>((done) => server.close(() => done()));
      if (dataDir !== null) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/**
 * Una pagina limpia, con los errores de consola recolectados.
 *
 * Los errores se juntan en un arreglo que el test puede afirmar vacio al
 * final. Es la comprobacion que mas veces encontro algo: una pantalla puede
 * verse bien y estar tirando excepciones en cada render.
 */
export async function openPage(
  browser: Browser,
): Promise<{ readonly page: Page; readonly errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors: string[] = [];
  page.on('console', (message: never) => {
    const m = message as unknown as { type(): string; text(): string };
    if (m.type() !== 'error') return;
    // EL SONDEO DE LA API NO ES UN ERROR.
    //
    // Al arrancar, la interfaz pregunta si hay un servidor detras
    // (`/api/salud`, fase 8). Servida solo como archivos —que es este caso, y
    // es el del HTML autocontenido— la respuesta es 404 y el navegador lo
    // anota como error de red. Es exactamente el comportamiento correcto: sin
    // servidor, la partida vive en el navegador.
    //
    // Se filtra por eso y NO se amplia el filtro: cualquier otro error de
    // consola tiene que hacer fallar el test, que es para lo que esta.
    if (/api\/salud/.test(m.text()) || /404 \(Not Found\)/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (error: never) => {
    errors.push(`pageerror: ${(error as unknown as Error).message}`);
  });
  return { page, errors };
}

/**
 * El plantel visible en la pantalla de alineacion, sin los que estan en cancha.
 *
 * Antes esto eran dos nombres de jugador escritos a mano en el script. Cuando
 * el juego paso a los planteles reales del Apertura 98 esos nombres dejaron de
 * existir y el script se colgaba esperando una fila que no estaba.
 */
export async function benchRow(page: Page, position: string): Promise<Locator> {
  const onPitch = await page.locator('.pitch__chipbtn .chip__name').allTextContents();
  const index = await page.evaluate(
    ({ position: wanted, onPitch: playing }: never) => {
      const rows = Array.from(document.querySelectorAll('.squadtable__table tbody tr'));
      return rows.findIndex((row) => {
        const pos = row.querySelector('.postag')?.textContent?.trim();
        const name = row.querySelector('.playername__text')?.textContent?.trim();
        return pos === wanted && name !== undefined && !(playing as string[]).includes(name);
      });
    },
    { position, onPitch },
  );
  if (index < 0) throw new Error(`no hay suplente de ${position} en el plantel`);
  return page.locator('.squadtable__table tbody tr').nth(index);
}
