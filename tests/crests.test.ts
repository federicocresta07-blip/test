/**
 * ESCUDOS REALES.
 *
 * El manifiesto `src/ui/data/crests.ts` lo genera `scripts/crests.mjs` y dice
 * que clubes tienen escudo real. Hay tres maneras de que eso quede mal y las
 * tres son invisibles en pantalla hasta que alguien mira:
 *
 * - un id en el manifiesto que no es de ningun club (un `<img>` que nadie pide),
 * - un club que no esta ni en la lista de los que tienen ni en la de los que
 *   faltan a proposito (un escudo que se dejo de cargar sin que se note),
 * - un id declarado con escudo cuyo archivo no existe (un `<img>` roto).
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CLUBS_WITH_CREST, CRESTS_MISSING, crestUrl } from '../src/ui/data/crests.ts';
import { CLUBS } from '../src/ui/data/clubs.ts';

test('todo id del manifiesto es un club que existe', () => {
  const known = new Set(CLUBS.map((club) => club.id));
  for (const id of CLUBS_WITH_CREST) {
    assert.ok(known.has(id), `el manifiesto declara escudo para "${id}", que no es un club`);
  }
  for (const id of Object.keys(CRESTS_MISSING)) {
    assert.ok(known.has(id), `se declara ausente el escudo de "${id}", que no es un club`);
  }
});

test('cada club tiene escudo real o un motivo declarado para no tenerlo', () => {
  for (const club of CLUBS) {
    const hasCrest = CLUBS_WITH_CREST.has(club.id);
    const declaredMissing = club.id in CRESTS_MISSING;
    assert.ok(
      hasCrest !== declaredMissing,
      `${club.name} (${club.id}) tiene que estar en una de las dos listas y en una sola: ` +
        `escudo=${hasCrest}, ausente declarado=${declaredMissing}`,
    );
  }
});

test('el archivo de cada escudo declarado existe', () => {
  for (const id of CLUBS_WITH_CREST) {
    const url = crestUrl(id);
    assert.ok(url, `crestUrl("${id}") tendria que devolver una ruta`);
    const path = join(process.cwd(), 'public', url as string);
    assert.ok(existsSync(path), `falta el archivo ${url}`);
  }
});

test('un club sin escudo no pide ningun archivo', () => {
  for (const id of Object.keys(CRESTS_MISSING)) {
    assert.equal(crestUrl(id), null, `${id} no tiene escudo: crestUrl tiene que dar null`);
  }
});

test('los clubes de Primera sin escudo son exactamente los que no estan en la fuente', () => {
  // La linea no es "todos los de Primera tienen escudo": Ferro Carril Oeste y
  // Gimnasia de Jujuy no estan en la carpeta de AFA del repo de origen, y eso
  // se declara en lugar de dibujarles uno parecido. El test fija la lista para
  // que si algun dia aparecen, o si se pierde otro, salte aca.
  const primera = CLUBS.filter((club) => club.division !== 'Primera Nacional');
  const sinEscudo = primera
    .filter((club) => !CLUBS_WITH_CREST.has(club.id))
    .map((club) => club.id)
    .sort();
  assert.deepEqual(sinEscudo, ['ferro', 'jujuy']);
  assert.equal(primera.length, 20, 'el Apertura 98 se juega con veinte clubes');
});
