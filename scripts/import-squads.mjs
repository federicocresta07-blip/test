/**
 * IMPORTADOR DE PLANTELES DEL CLAUSURA 1998.
 *
 * Convierte un archivo de texto plano —lo que se puede pegar de una pagina o
 * escribir a mano— en entradas del dataset, validando contra el motor.
 *
 *   node scripts/import-squads.mjs planteles.txt            # valida y muestra
 *   node scripts/import-squads.mjs planteles.txt --escribir # ademas genera el TS
 *
 * Existe porque los planteles no se pueden bajar: la politica de red de estas
 * sesiones bloquea Wikipedia, BDFA, livefutbol y el resto de las paginas de
 * referencia. Lo que si se puede es que cargarlos a mano sea mecanico y que
 * los errores salten antes de entrar al dataset, no despues.
 *
 * FORMATO
 * =======
 *
 *   # boca
 *   DT: Hector Veira
 *   fuente: https://...
 *   nota: las ultimas seis fechas las dirigio Carlos Garcia Cambon
 *
 *   POR | Carlos Navarro Montoya | 1  | 33
 *   DFC | Jorge Bermudez         | 2  | 27
 *   DC  | Martin Palermo         | 9  | 24
 *
 * Una linea por jugador: posicion | nombre | dorsal | edad.
 * Lo unico obligatorio es la POSICION y el NOMBRE; dorsal y edad pueden ir
 * vacios o no ir. Las lineas en blanco y las que empiezan con // se ignoran.
 *
 * El overall NO se pide. Es valoracion nuestra, no dato historico, y ponerlo
 * en el mismo archivo que los nombres invita a confundir las dos cosas. Los
 * jugadores importados entran con el overall por defecto y el plantel declara
 * cuantos lo tienen, para que se vea que falta valorarlos.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { POSITIONS } from '../src/domain/positions.ts';
import { CLAUSURA_1998_CLUBS } from '../src/data/clausura-1998/clubs.ts';

/**
 * El overall con el que entra un jugador importado sin valorar. Es el de un
 * profesional de Primera de mitad de tabla: no lo hace ni bueno ni malo.
 */
const DEFAULT_RATING = 70;

const VALID_POSITIONS = new Set(POSITIONS);
const VALID_CLUBS = new Set(CLAUSURA_1998_CLUBS.map((club) => club.id));

function parse(text) {
  const clubs = [];
  let current = null;
  const problems = [];
  let lineNumber = 0;

  for (const rawLine of text.split('\n')) {
    lineNumber += 1;
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//')) continue;

    if (line.startsWith('#')) {
      const clubId = line.slice(1).trim();
      if (!VALID_CLUBS.has(clubId)) {
        problems.push(
          `linea ${lineNumber}: "${clubId}" no es un club del Clausura 1998. ` +
            `Los validos son: ${[...VALID_CLUBS].join(', ')}`,
        );
        current = null;
        continue;
      }
      current = { clubId, manager: null, sources: [], notes: [], players: [] };
      clubs.push(current);
      continue;
    }

    if (!current) {
      problems.push(`linea ${lineNumber}: hay datos antes del primer "# <club>"`);
      continue;
    }

    const header = /^(DT|fuente|nota):\s*(.+)$/i.exec(line);
    if (header) {
      const [, key, value] = header;
      const lower = key.toLowerCase();
      if (lower === 'dt') current.manager = value.trim();
      else if (lower === 'fuente') current.sources.push(value.trim());
      else current.notes.push(value.trim());
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim());
    const [position, name, number, age] = cells;

    if (!position || !name) {
      problems.push(`linea ${lineNumber}: falta la posicion o el nombre -> "${line}"`);
      continue;
    }
    if (!VALID_POSITIONS.has(position)) {
      problems.push(
        `linea ${lineNumber}: "${position}" no es una posicion del motor (${name}). ` +
          `Validas: ${POSITIONS.join(' ')}`,
      );
      continue;
    }
    const parsedNumber = number ? Number(number) : undefined;
    const parsedAge = age ? Number(age) : undefined;
    if (number && !Number.isInteger(parsedNumber)) {
      problems.push(`linea ${lineNumber}: el dorsal "${number}" no es un entero (${name})`);
      continue;
    }
    if (age && (!Number.isInteger(parsedAge) || parsedAge < 15 || parsedAge > 45)) {
      problems.push(`linea ${lineNumber}: la edad "${age}" no es verosimil (${name})`);
      continue;
    }

    current.players.push({
      name,
      position,
      ...(parsedNumber !== undefined ? { number: parsedNumber } : {}),
      ...(parsedAge !== undefined ? { age: parsedAge } : {}),
    });
  }

  return { clubs, problems };
}

/** Revisiones que no son de formato sino de sentido futbolistico. */
function review(club) {
  const warnings = [];
  const keepers = club.players.filter((player) => player.position === 'POR');
  if (keepers.length === 0) warnings.push('no tiene ningun arquero');
  if (club.players.length < 11) {
    warnings.push(`solo ${club.players.length} jugadores: no alcanza para un once`);
  }
  const numbers = club.players.map((p) => p.number).filter((n) => n !== undefined);
  const repeated = numbers.filter((n, index) => numbers.indexOf(n) !== index);
  if (repeated.length > 0) {
    warnings.push(`dorsales repetidos: ${[...new Set(repeated)].join(', ')}`);
  }
  const names = club.players.map((p) => p.name.toLowerCase());
  const dupes = names.filter((n, index) => names.indexOf(n) !== index);
  if (dupes.length > 0) warnings.push(`nombres repetidos: ${[...new Set(dupes)].join(', ')}`);
  if (club.sources.length === 0) warnings.push('sin fuente declarada');
  return warnings;
}

function emit(club) {
  const players = club.players
    .map((player) => {
      const fields = [
        `name: ${JSON.stringify(player.name)}`,
        `position: '${player.position}'`,
        ...(player.number !== undefined ? [`number: ${player.number}`] : []),
        ...(player.age !== undefined ? [`age: ${player.age}`] : []),
        `estimatedRating: ${DEFAULT_RATING}`,
      ];
      return `    { ${fields.join(', ')} },`;
    })
    .join('\n');

  const notes = [
    // Cada nota termina en punto para que al unirlas no queden pegadas.
    ...club.notes.map((note) => (note.endsWith('.') ? note : `${note}.`)),
    `Importado con scripts/import-squads.mjs. Los ${club.players.length} jugadores entran con ` +
      `el overall por defecto (${DEFAULT_RATING}): los nombres y las posiciones son dato, ` +
      `el overall todavia no esta valorado.`,
  ].join(' ');

  // Se exportan aunque sea un archivo de paso: un `const` sin usar no compila
  // con la config del proyecto, y el archivo generado tiene que typecheckear
  // tal como sale.
  return `export const ${club.clubId.toUpperCase()}: HistoricalSquad = {
  clubId: '${club.clubId}',
  manager: ${club.manager ? JSON.stringify(club.manager) : 'null'},
  confidence: 'parcial',
  sources: [
${club.sources.map((source) => `    ${JSON.stringify(source)},`).join('\n')}
  ],
  notes:
    ${JSON.stringify(notes)},
  players: [
${players}
  ],
};
`;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node scripts/import-squads.mjs <archivo> [--escribir]');
    console.error('El formato esta documentado arriba de este script y en docs/clausura-1998.md');
    process.exit(1);
  }

  const { clubs, problems } = parse(readFileSync(file, 'utf8'));

  if (problems.length > 0) {
    console.error(`\n${problems.length} problema(s) de formato. No se importa nada:\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  if (clubs.length === 0) {
    console.error('El archivo no tiene ningun club.');
    process.exit(1);
  }

  console.log('');
  let total = 0;
  let withWarnings = 0;
  for (const club of clubs) {
    const warnings = review(club);
    total += club.players.length;
    if (warnings.length > 0) withWarnings += 1;
    console.log(
      `  ${club.clubId.padEnd(14)} ${String(club.players.length).padStart(2)} jugadores` +
        `  DT: ${club.manager ?? '(sin declarar)'}`,
    );
    for (const warning of warnings) console.log(`      ojo: ${warning}`);
  }
  console.log('');
  console.log(
    `${clubs.length} club(es), ${total} jugadores. ` +
      `${withWarnings === 0 ? 'Sin observaciones.' : `${withWarnings} con observaciones.`}`,
  );

  if (process.argv.includes('--escribir')) {
    const out = clubs.map(emit).join('\n');
    const path = 'src/data/clausura-1998/imported-squads.ts';
    writeFileSync(
      path,
      `/**\n * PLANTELES IMPORTADOS — generado por scripts/import-squads.mjs.\n *\n` +
        ` * Revisar antes de mover a squads.ts: el overall de todos es el valor por\n` +
        ` * defecto y hay que valorarlos uno por uno.\n */\n\n` +
        `import type { HistoricalSquad } from './squads.ts';\n\n${out}`,
    );
    console.log(`\nEscrito en ${path}. Revisar y mover a squads.ts.`);
  } else {
    console.log('\nNada escrito. Volver a correr con --escribir para generar el TypeScript.');
  }
}

main();
