/**
 * INGESTA DE ESCUDOS REALES.
 *
 * Toma los escudos vectoriales de FCLOGO (MIT, https://github.com/FCLOGO/fclogo.top),
 * elige para cada club la version en color mas reciente, la optimiza y la
 * escribe en `public/crests/<clubId>.svg`. Ademas genera el manifiesto
 * `src/ui/data/crests.ts`, que es lo unico que la interfaz consulta.
 *
 * Se corre a mano, no en cada build: los escudos cambian una vez por decada.
 *
 *   node scripts/crests.mjs <ruta al clone de fclogo.top>
 *
 * Por que un manifiesto y no un `<img>` a ciegas: la Primera Nacional no esta
 * en el repo de origen, y un `<img>` roto es peor que el escudo dibujado. La
 * interfaz pregunta primero si el club tiene escudo real.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// El mapeo es a mano a proposito. Los nombres de carpeta no son ids y hay
// homonimos reales: el `025_San Martin` del repo es el de San Juan, y el
// nuestro es el de Tucuman. Adivinarlo por nombre pondria el escudo de otro
// club, que es un error que nadie notaria hasta verlo en pantalla.
const MAPPING = {
  // --- Los veinte de Primera del Apertura 98 ---
  boca: '001_Boca Juniors',
  river: '002_River Plate',
  argentinos: '004_Argentinos Juniors',
  belgrano: '008_Belgrano',
  colon: '031_Colón',
  estudiantes: '012_Estudiantes',
  gimnasia: '013_Gimnasia LP',
  huracan: '015_Huracán',
  independiente: '016_Independiente',
  lanus: '019_Lanús',
  newells: "020_Newell's",
  platense: '021_Platense',
  racing: '022_Racing',
  central: '023_Rosario Central',
  sanlorenzo: '024_San Lorenzo',
  talleres: '027_Talleres',
  union: '029_Unión',
  velez: '030_Vélez',
  // --- Del ascenso, que existen como club aunque su torneo no se simule ---
  tigre: '028_Tigre',
};

/** Clubes que a proposito NO tienen escudo real, con el motivo. */
const DELIBERATELY_MISSING = {
  ferro: 'Ferro Carril Oeste no está en la carpeta de AFA del repo de origen',
  jujuy: 'Gimnasia y Esgrima de Jujuy no está en el repo de origen',
  quilmes: 'no está en la carpeta de AFA del repo de origen',
  atlanta: 'no está en la carpeta de AFA del repo de origen',
  sanmartin: 'el repo de origen tiene el San Martín de San Juan, no el de Tucumán',
};

/**
 * Parser minimo del `logo.yaml` de FCLOGO. No es un parser de YAML: es un
 * lector de la forma concreta de estos archivos, que son una lista de bloques
 * con pares `clave: valor`. Traer un parser de YAML para esto seria agregar
 * una dependencia a un proyecto que no tiene ninguna.
 */
function readLogoEntries(yamlPath) {
  const text = readFileSync(yamlPath, 'utf8');
  const entries = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('- data:')) {
      if (current) entries.push(current);
      current = {};
      continue;
    }
    if (!current) continue;
    const match = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    current[key] = value.replace(/^'|'$/g, '').trim();
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * El escudo que queremos: en color (no `mono`, que es la silueta de un solo
 * tono), no marcado como desactualizado, y de la version mas nueva. La
 * version `0000` significa "sin fecha conocida" y se toma como la vigente.
 */
function pickCrest(entries) {
  const usable = entries.filter(
    (entry) => entry.style !== 'mono' && entry.isOutdated !== 'true' && entry.svgPath,
  );
  if (usable.length === 0) return null;
  const score = (entry) => (entry.version === '0000' ? 9999 : Number(entry.version) || 0);
  return usable.sort((a, b) => score(b) - score(a))[0];
}

/**
 * Optimiza el SVG. Son exports de Illustrator: traen el generador, un id en
 * chino, `enable-background` y coordenadas con cuatro decimales sobre un
 * lienzo de 800 unidades. A 26 px de pantalla, el cuarto decimal es 1/8000 de
 * pixel. Redondear a uno solo baja el archivo a un tercio sin diferencia
 * visible.
 */
function optimize(svg) {
  let out = svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\sid="[^"]*"/g, '')
    .replace(/style="enable-background:[^"]*"/g, '')
    // `style="fill:#fff;"` es mas largo que `fill="#fff"` y significa lo mismo.
    .replace(/style="fill:(#[0-9a-fA-F]{3,6});?"/g, 'fill="$1"')
    .replace(/\sxml:space="preserve"/g, '')
    .replace(/\sversion="1\.1"/g, '')
    .replace(/\sx="0px"\s*y="0px"/g, '');

  // Redondeo de coordenadas a dos decimales.
  //
  // La primera version redondeaba a entero, razonando que una unidad de un
  // lienzo de 800 es 0,08 px en el escudo mas grande que dibujamos. El
  // razonamiento estaba mal y rompio dos escudos: los trazos de estos SVG
  // usan comandos RELATIVOS, asi que cada numero es un delta y el error se
  // acumula a lo largo del trazo. Peor: todo delta menor a 0,5 colapsaba a
  // cero y el trazo de Velez quedaba en cosas como `c00-1-1-1`.
  //
  // Huracan y Velez se dibujaban como una mancha. No dio ningun error: el
  // SVG era valido, solo describia otra figura. Lo encontre mirando la
  // captura de la tabla, no corriendo los tests.
  out = out.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100));

  return out.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function main() {
  const source = process.argv[2];
  if (!source) {
    console.error('Uso: node scripts/crests.mjs <ruta al clone de FCLOGO/fclogo.top>');
    process.exit(1);
  }
  const clubsDir = join(source, 'src/data/logos/AFA/clubs');
  if (!existsSync(clubsDir)) {
    console.error(`No encuentro los clubes de AFA en ${clubsDir}`);
    process.exit(1);
  }

  const outDir = join(process.cwd(), 'public/crests');
  mkdirSync(outDir, { recursive: true });
  // Borrar, no vaciar. La primera version escribia '' encima y dejaba
  // archivos de cero bytes: un escudo que ya no se carga seguia existiendo
  // como archivo vacio, y un `<img>` a un SVG vacio no muestra nada sin dar
  // error.
  for (const stale of readdirSync(outDir)) {
    if (stale.endsWith('.svg')) unlinkSync(join(outDir, stale));
  }

  const loaded = [];
  let totalBefore = 0;
  let totalAfter = 0;

  for (const [clubId, folder] of Object.entries(MAPPING)) {
    const dir = join(clubsDir, folder);
    const entries = readLogoEntries(join(dir, 'logo.yaml'));
    const pick = pickCrest(entries);
    if (!pick) {
      console.error(`  ${clubId.padEnd(14)} SIN escudo en color utilizable`);
      continue;
    }
    const raw = readFileSync(join(dir, pick.svgPath), 'utf8');
    const optimized = optimize(raw);
    totalBefore += Buffer.byteLength(raw);
    totalAfter += Buffer.byteLength(optimized);
    writeFileSync(join(outDir, `${clubId}.svg`), `${optimized}\n`);
    loaded.push({ clubId, version: pick.version, verName: pick.verName, style: pick.style });
    const kb = (Buffer.byteLength(optimized) / 1024).toFixed(1);
    console.log(`  ${clubId.padEnd(14)} v${pick.version.padEnd(5)} ${kb.padStart(6)} kB  ${pick.svgPath}`);
  }

  const manifest = `/**
 * QUE CLUBES TIENEN ESCUDO REAL.
 *
 * Generado por \`node scripts/crests.mjs\`. No editar a mano.
 *
 * Los escudos son los oficiales de cada club, en vectorial, tomados de FCLOGO
 * (https://github.com/FCLOGO/fclogo.top, MIT) y optimizados. Viven en
 * \`public/crests/<id>.svg\` y se sirven como archivos estaticos: no van
 * embebidos en el bundle.
 *
 * Los escudos de los clubes son marcas registradas de cada club. Se usan para
 * identificarlo, que es para lo que existen; no hay vinculo ni aval de los
 * clubes con este proyecto.
 */

/** Ids de club con escudo real disponible. */
export const CLUBS_WITH_CREST: ReadonlySet<string> = new Set([
${loaded.map((entry) => `  '${entry.clubId}',`).join('\n')}
]);

/**
 * Los que a proposito no tienen, con el motivo. Que el hueco este declarado
 * es lo que permite que un test verifique que no falta ninguno por descuido.
 */
export const CRESTS_MISSING: Readonly<Record<string, string>> = {
${Object.entries(DELIBERATELY_MISSING)
  .map(([id, reason]) => `  ${id}: '${reason}',`)
  .join('\n')}
};

export function crestUrl(clubId: string): string | null {
  return CLUBS_WITH_CREST.has(clubId) ? \`crests/\${clubId}.svg\` : null;
}
`;
  writeFileSync(join(process.cwd(), 'src/ui/data/crests.ts'), manifest);

  console.log('');
  console.log(`${loaded.length} escudos cargados, ${Object.keys(DELIBERATELY_MISSING).length} declarados ausentes.`);
  console.log(
    `Optimizacion: ${(totalBefore / 1024).toFixed(0)} kB -> ${(totalAfter / 1024).toFixed(0)} kB ` +
      `(${Math.round((1 - totalAfter / totalBefore) * 100)}% menos).`,
  );
}

main();
