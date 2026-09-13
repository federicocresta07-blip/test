/**
 * EL PUENTE ENTRE PC FUTBOL Y EL MOTOR.
 *
 * El motor usa los MISMOS diez atributos que guarda PC Apertura 98, asi que no
 * hay nada derivado y el mapeo es una identidad. Este archivo lo fija: si algun
 * dia vuelve a aparecer un atributo derivado, el test lo dice.
 *
 * LA COMPROBACION QUE VALE. El motor calcula su overall por puesto con once
 * tablas de pesos; PC Futbol calcula su media con cuatro de los diez
 * atributos. Siguen siendo dos formulas distintas, asi que su correlacion
 * sobre los 462 jugadores sigue midiendo algo: que las tablas de pesos del
 * motor no deformen el plantel.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APERTURA98_CLUBS,
  APERTURA98_SOURCE,
  apertura98Squad,
} from '../src/data/apertura98.ts';
import {
  PCF_ATTRIBUTE_SOURCE,
  PCF_ROLE_TO_POSITION,
  attributesFromPcf,
  pcfMedia,
  playerFromApertura98,
  positionFromPcf,
} from '../src/data/pcf-bridge.ts';
import { ATTRIBUTE_KEYS } from '../src/domain/attributes.ts';
import { overallForPosition } from '../src/ratings/overall.ts';
import { POSITIONS } from '../src/domain/positions.ts';

function allPlayers() {
  return APERTURA98_CLUBS.flatMap((club) =>
    apertura98Squad(club.id).map((raw) => ({ raw, club: club.id })),
  );
}

test('estan los veinte clubes y sus planteles', () => {
  assert.equal(APERTURA98_CLUBS.length, 20);
  assert.equal(APERTURA98_SOURCE.file, 'EQ003003.PKF');
  const total = allPlayers().length;
  assert.equal(total, APERTURA98_SOURCE.players);
  for (const club of APERTURA98_CLUBS) {
    const squad = apertura98Squad(club.id);
    assert.ok(squad.length >= 18, `${club.shortName} tiene solo ${squad.length} jugadores`);
    assert.ok(
      squad.some((p) => p.dem === 'Portero'),
      `${club.shortName} no tiene arquero`,
    );
  }
});

test('el mapeo cubre los veintinueve atributos del motor, sin inventar ninguno', () => {
  const declared = Object.keys(PCF_ATTRIBUTE_SOURCE).sort();
  assert.deepEqual(declared, [...ATTRIBUTE_KEYS].sort());
});

test('los diez atributos salen del archivo y NINGUNO se deriva', () => {
  // Este test existia al reves: verificaba que nueve fueran originales y
  // veinte derivados. Al bajar el motor a diez atributos la capa de derivacion
  // desaparecio, y lo que hay que fijar ahora es que no vuelva.
  const sources = Object.values(PCF_ATTRIBUTE_SOURCE);
  assert.equal(sources.length, ATTRIBUTE_KEYS.length);
  assert.equal(sources.filter((s) => s.startsWith('original')).length, 10);
  assert.equal(sources.filter((s) => s.startsWith('derivado')).length, 0);
});

test('los diecinueve roles de PC Futbol mapean a puestos que el motor conoce', () => {
  const known = new Set<string>(POSITIONS);
  for (const [role, position] of Object.entries(PCF_ROLE_TO_POSITION)) {
    assert.ok(known.has(position), `el rol "${role}" mapea a "${position}", que no existe`);
  }
  // Los 19 codigos del README menos el 0x00, que es "vacio".
  assert.equal(Object.keys(PCF_ROLE_TO_POSITION).length, 18);
});

function correlation(rows: readonly { readonly a: number; readonly b: number }[]): number {
  const meanA = rows.reduce((t, r) => t + r.a, 0) / rows.length;
  const meanB = rows.reduce((t, r) => t + r.b, 0) / rows.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const r of rows) {
    sxy += (r.a - meanA) * (r.b - meanB);
    sxx += (r.a - meanA) ** 2;
    syy += (r.b - meanB) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

function mediaOf(raw: { readonly a: Record<string, number> }): number {
  return pcfMedia({
    velocidad: raw.a.ve as number, resistencia: raw.a.re as number,
    agresividad: raw.a.ag as number, calidad: raw.a.ca as number,
    remate: raw.a.rm as number, regate: raw.a.rg as number,
    pase: raw.a.pa as number, tiro: raw.a.ti as number,
    entradas: raw.a.en as number, portero: raw.a.po as number,
  });
}

test('el overall del motor sigue a la media de PC Futbol en los jugadores de campo', () => {
  const rows = allPlayers()
    .map(({ raw, club }) => {
      const player = playerFromApertura98(raw, club);
      return { keeper: player.position === 'POR', a: mediaOf(raw), b: overallForPosition(player.attributes, player.position) };
    })
    .filter((row) => !row.keeper);

  const r = correlation(rows);
  assert.ok(r > 0.8, `la correlacion de los jugadores de campo cayo a ${r.toFixed(3)}`);

  // El sesgo global tiene que ser chico: si el mapeo empujara a todos para
  // arriba o para abajo, el torneo entero cambiaria de escala.
  const bias = rows.reduce((t, row) => t + (row.b - row.a), 0) / rows.length;
  assert.ok(Math.abs(bias) < 3, `sesgo global de ${bias.toFixed(2)} puntos`);
});

test('con los arqueros diverge, y la culpa es de la formula de PC Futbol', () => {
  // La media de PC Futbol es (velocidad + resistencia + agresividad + calidad)
  // / 4: NO incluye el atributo `portero`. Asi que para un arquero la media del
  // juego no mide lo unico que importa de su puesto, y hay arqueros con media
  // alta y `portero` bajo.
  //
  // El overall del motor si es por puesto, asi que los dos numeros divergen.
  // Esto no es un problema del mapeo y se prueba desde el archivo: la
  // correlacion entre la media de PC Futbol y su propio atributo `portero`, sin
  // que el motor intervenga en nada, ya es floja.
  const keepers = allPlayers().filter(({ raw }) => raw.dem === 'Portero');
  assert.ok(keepers.length > 40, 'tiene que haber arqueros de sobra para medir');

  const sourceOnly = correlation(keepers.map(({ raw }) => ({ a: mediaOf(raw), b: raw.a.po })));
  assert.ok(
    sourceOnly < 0.85,
    `la media de PC Futbol seria buena para arqueros (r=${sourceOnly.toFixed(3)}): ` +
      'si esto sube, revisar la formula',
  );

  // Aun divergiendo, el motor no los corre de escala en promedio.
  const rows = keepers.map(({ raw, club }) => {
    const player = playerFromApertura98(raw, club);
    return { a: mediaOf(raw), b: overallForPosition(player.attributes, player.position) };
  });
  const bias = rows.reduce((t, row) => t + (row.b - row.a), 0) / rows.length;
  assert.ok(Math.abs(bias) < 6, `los arqueros se corrieron ${bias.toFixed(2)} puntos de escala`);
});

test('ningun atributo derivado se sale de la escala', () => {
  for (const { raw, club } of allPlayers()) {
    const player = playerFromApertura98(raw, club);
    for (const key of ATTRIBUTE_KEYS) {
      const value = player.attributes[key];
      assert.ok(
        value >= 1 && value <= 100,
        `${raw.n}: ${key} = ${value} fuera de la escala 1..100`,
      );
    }
  }
});

test('el arco no se mezcla con la cancha', () => {
  // Tres arqueros del archivo traen un rol de campo en el segundo slot. Si se
  // tomara literal, el motor podria poner a Burgos de lateral izquierdo sin
  // penalizacion por jugar fuera de puesto.
  for (const { raw, club } of allPlayers()) {
    const player = playerFromApertura98(raw, club);
    if (player.position === 'POR') {
      assert.deepEqual(
        player.secondaryPositions.filter((p) => p !== 'POR'),
        [],
        `${raw.n} es arquero y tiene puestos de campo como secundarios`,
      );
    } else {
      assert.ok(
        !player.secondaryPositions.includes('POR'),
        `${raw.n} juega de campo y tiene POR como secundario`,
      );
    }
  }
});

test('el mapeo es deterministico', () => {
  const squad = apertura98Squad('boca');
  const first = squad.map((raw) => playerFromApertura98(raw, 'boca'));
  const second = squad.map((raw) => playerFromApertura98(raw, 'boca'));
  for (let i = 0; i < first.length; i += 1) {
    assert.deepEqual(second[i]!.attributes, first[i]!.attributes);
    assert.deepEqual(second[i]!.condition, first[i]!.condition);
  }
});

test('los diez atributos llegan intactos al motor', () => {
  const raw = apertura98Squad('boca').find((p) => p.n.includes('RIQUELME'));
  assert.ok(raw, 'Riquelme tiene que estar en el plantel de Boca');
  const { position } = positionFromPcf(raw.roles, raw.dem);
  const { attributes } = attributesFromPcf({
    attributes: {
      velocidad: raw.a.ve, resistencia: raw.a.re, agresividad: raw.a.ag,
      calidad: raw.a.ca, remate: raw.a.rm, regate: raw.a.rg,
      pase: raw.a.pa, tiro: raw.a.ti, entradas: raw.a.en, portero: raw.a.po,
    },
    position,
    height: raw.h,
    weight: raw.w,
  });

  // Los diez, uno por uno, en el orden del archivo.
  assert.equal(attributes.velocidad, raw.a.ve);
  assert.equal(attributes.resistencia, raw.a.re);
  assert.equal(attributes.agresividad, raw.a.ag);
  assert.equal(attributes.calidad, raw.a.ca);
  assert.equal(attributes.remate, raw.a.rm);
  assert.equal(attributes.regate, raw.a.rg);
  assert.equal(attributes.pase, raw.a.pa);
  assert.equal(attributes.tiro, raw.a.ti);
  assert.equal(attributes.entradas, raw.a.en);
  assert.equal(attributes.portero, raw.a.po);
});

test('Riquelme queda de volante y no de lateral', () => {
  // Sus seis roles del archivo son medio centro organizador, interior derecho,
  // interior izquierdo, centrocampista izquierda, centrocampista derecha y
  // media punta por el centro.
  const raw = apertura98Squad('boca').find((p) => p.n.includes('RIQUELME'));
  assert.ok(raw);
  assert.equal(raw.roles[0], 'Medio centro organizador');
  assert.equal(raw.d, 10);
  const player = playerFromApertura98(raw, 'boca');
  assert.equal(player.position, 'MC');
  assert.ok(player.secondaryPositions.includes('MCO'));
  assert.equal(player.age, 20);
});
