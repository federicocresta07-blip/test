/**
 * Verificación de los flujos críticos de la interfaz en un navegador real.
 *
 * Cubre lo que los tests de `tests/ui-logic.test.ts` no pueden: navegación,
 * drag & drop, cambio de formación en pantalla, paneles y guardado.
 *
 * Requiere Playwright, que NO es dependencia del proyecto (regla de la
 * sección 21: no agregar librerías sin razón concreta). Se instala aparte
 * cuando se quiere correr:
 *
 *   npm run build && npx vite preview --port 4173 &
 *   npm i --no-save playwright && node scripts/ui-smoke.mjs
 *
 * Si el Chromium del sistema no es el que espera Playwright:
 *
 *   CHROMIUM_PATH=/ruta/al/chromium node scripts/ui-smoke.mjs
 *
 * Convertir esto en tests automatizados es la fase 8 del plan.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
mkdirSync('./ui-shots', { recursive: true });

// En entornos donde el Chromium instalado no es el que espera esta version de
// Playwright, `CHROMIUM_PATH` apunta al ejecutable a mano.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const check = (label, ok, detail = '') =>
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${label}${detail ? ' — ' + detail : ''}`);

/**
 * Un suplente del puesto pedido, elegido en el momento.
 *
 * Antes esto eran dos nombres escritos a mano ("Hernán Ledesma", "Lisandro
 * Ferreyra"), que venian del plantel de demostracion. Cuando el juego paso a
 * los planteles reales del Apertura 98 esos nombres dejaron de existir y el
 * script se colgaba treinta segundos esperando una fila que no estaba. Ahora
 * se busca por puesto entre los que no estan en la cancha, asi que sirve con
 * cualquier plantel.
 */
async function benchRow(position) {
  const onPitch = await page.locator('.pitch__chipbtn .chip__name').allTextContents();
  const index = await page.evaluate(
    ({ position, onPitch }) => {
      const rows = [...document.querySelectorAll('.squadtable__table tbody tr')];
      return rows.findIndex((tr) => {
        const pos = tr.querySelector('.postag')?.textContent?.trim();
        const name = tr.querySelector('.playername__text')?.textContent?.trim();
        return pos === position && name && !onPitch.includes(name);
      });
    },
    { position, onPitch },
  );
  if (index < 0) throw new Error(`no hay suplente de ${position} en el plantel`);
  return page.locator('.squadtable__table tbody tr').nth(index);
}

await page.goto(`${BASE}/#/equipo/alineacion`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// --- 1. Navegación entre secciones ---
await page.click('.sidebar__item:has-text("Plantel")');
await page.waitForTimeout(250);
check('navegación a Plantel', (await page.locator('.clubheader__title').textContent()) === 'Plantel');
await page.click('.sidebar__item:has-text("Alineación")');
await page.waitForTimeout(250);
check('navegación a Alineación', (await page.locator('.clubheader__title').textContent()) === 'Alineación');

// --- 2. Once completo en la cancha ---
const chips = await page.locator('.pitch__chipbtn').count();
check('once completo en la cancha', chips === 11, `${chips} fichas`);

// --- 3. Cambio de formación conserva la selección ---
const before = await page.locator('.pitch__chipbtn .chip__name').allTextContents();
await page.selectOption('.formationpick select', '3-5-2');
await page.waitForTimeout(300);
const after = await page.locator('.pitch__chipbtn .chip__name').allTextContents();
check('cambio de formación llena los 11 puestos', after.length === 11, `${after.length} fichas`);
const kept = after.filter((n) => before.includes(n)).length;
check('cambio de formación conserva jugadores', kept >= 9, `${kept}/11 conservados`);
await page.selectOption('.formationpick select', '4-3-3');
await page.waitForTimeout(300);

// --- 4. Métricas en vivo ---
const metricBefore = await page.locator('.metricrow:has-text("Ataque") .metricrow__value').textContent();

// --- 5. Drag & drop: plantel -> cancha ---
// Se arrastra un suplente del ataque al puesto de delantero.
const source = await benchRow('DC');
const target = page.locator('.pitch__slot').filter({ has: page.locator('.chip') }).nth(1);
const targetNameBefore = await target.locator('.chip__name').textContent();
await source.dragTo(target);
await page.waitForTimeout(400);
const targetNameAfter = await target.locator('.chip__name').textContent();
check('drag & drop plantel → cancha', targetNameBefore !== targetNameAfter, `${targetNameBefore} → ${targetNameAfter}`);
const chipsAfterDrag = await page.locator('.pitch__chipbtn').count();
check('la cancha sigue con 11 después del drag', chipsAfterDrag === 11, `${chipsAfterDrag}`);

const metricAfter = await page.locator('.metricrow:has-text("Ataque") .metricrow__value').textContent();
check('las métricas se actualizan al cambiar el XI', metricBefore !== metricAfter, `${metricBefore} → ${metricAfter}`);

// --- 6. Estado "sin guardar" y guardado ---
check('avisa cambios sin guardar', (await page.locator('.saveind.is-pending').count()) === 1);
await page.click('button:has-text("Guardar equipo")');
await page.waitForTimeout(400);
check('confirma el guardado', (await page.locator('.saveind.is-ok').count()) === 1);

// --- 7. Ficha rápida del jugador ---
await page.locator('.pitch__chipbtn').first().click();
await page.waitForTimeout(300);
const drawerOpen = await page.locator('.drawer').count();
check('la ficha rápida se abre sin salir de la pantalla', drawerOpen === 1 && (await page.locator('.clubheader__title').textContent()) === 'Alineación');
await page.screenshot({ path: `./ui-shots/ficha.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// --- 8. Jugador fuera de posición muestra el efecto (sección 6.5) ---
// Se pone un defensor central de extremo. El puesto se busca por su etiqueta:
// antes era `.pitch__slot` primero, que es el ARCO, asi que el test ponia al
// central de arquero y comprobaba el caso extremo en lugar del que dice.
const dfc = await benchRow('DFC');
const wing = page.locator('.pitch__slot').filter({ has: page.locator('.pitch__slotlabel:text-is("ED")') }).first();
await dfc.dragTo(wing);
await page.waitForTimeout(400);
const outOfPos = await page.locator('.chip--outofposition').count();
check('marca al jugador fuera de posición', outOfPos >= 1, `${outOfPos} fichas marcadas`);
await page.locator('.chip--outofposition').first().click();
await page.waitForTimeout(300);
const penaltyShown = await page.locator('.outofpos').count();
check('la ficha muestra overall natural vs efectivo', penaltyShown === 1);
if (penaltyShown) console.log('       ' + (await page.locator('.outofpos').innerText()).replace(/\n/g, ' | '));
await page.keyboard.press('Escape');

// --- 9. Panel de táctica ---
await page.click('button:has-text("Configurar táctica")');
await page.waitForTimeout(300);
check('abre el panel de táctica', (await page.locator('.tacticsform').count()) === 1);
await page.click('.choice__option:has-text("Directo")');
await page.waitForTimeout(250);
const style = await page.locator('.tacticsummary__row:has-text("Estilo") .tacticsummary__value').textContent();
check('el cambio de táctica se refleja', style === 'Directo', `estilo = ${style}`);
await page.screenshot({ path: `./ui-shots/tactica.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// --- 10. Autoseleccionar XI ---
await page.click('button:has-text("Autoseleccionar XI")');
await page.waitForTimeout(400);
const chipsAuto = await page.locator('.pitch__chipbtn').count();
check('autoseleccionar arma los 11', chipsAuto === 11, `${chipsAuto}`);

// Antes esto exigia CERO fichas marcadas, y con el plantel de demostracion se
// cumplia porque tenia un jugador natural para cada puesto. Los planteles
// reales no: River 98 no tiene ningun extremo izquierdo natural, asi que
// alguien tiene que jugar ahi corrido de puesto y la ficha se marca. Exigir
// cero era exigir que el plantel fuese de laboratorio.
//
// Lo que si tiene que cumplirse es que la seleccion automatica no ponga a
// nadie MUY fuera de puesto: cada ficha marcada pierde poco, porque es su
// posicion secundaria o una vecina, no un central de nueve.
const deltas = (await page.locator('.chip--outofposition .chip__delta').allTextContents()).map(Number);
const worst = deltas.length > 0 ? Math.min(...deltas) : 0;
check(
  'autoseleccionar no pone a nadie muy fuera de puesto',
  worst >= -6,
  `${deltas.length} fichas corridas, la peor ${worst}`,
);

// --- 11. Suplentes ---
const bench = await page.locator('.bench__chip').count();
check('el banco tiene suplentes', bench >= 5, `${bench} suplentes`);

// --- 12. Filtros del plantel ---
await page.click('.squadtable__filters .tabs__tab:has-text("ATA")');
await page.waitForTimeout(250);
const rows = await page.locator('.squadtable__table tbody tr').count();
const positions = await page.locator('.squadtable__table tbody .postag').allTextContents();
const onlyAttackers = positions.every((p) => ['ED', 'EI', 'DC', 'SD'].includes(p.trim()));
check('los filtros por posición funcionan', rows > 0 && onlyAttackers, `${rows} filas`);

// --- 13. Orden por overall ---
await page.click('.squadtable__filters .tabs__tab:has-text("Todos")');
await page.waitForTimeout(200);
await page.click('.th-sort:has-text("Ovr")');
await page.waitForTimeout(250);
const ovrs = (await page.locator('.squadtable__table tbody .rating').allTextContents()).map(Number);
const sorted = ovrs.every((v, i) => i === 0 || ovrs[i - 1] >= v);
check('el orden por overall funciona', sorted, `${ovrs.slice(0, 5).join(', ')}…`);

await page.screenshot({ path: `./ui-shots/alineacion-final.png` });
console.log(errors.length ? `\nERRORES DE CONSOLA:\n${errors.join('\n')}` : '\nsin errores de consola');
await browser.close();
