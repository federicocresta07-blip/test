// Seccion 25: atributos y overall por posicion.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRIBUTE_KEYS, buildAttributes } from '../src/domain/attributes.ts';
import { bestPosition, overallForPosition, POSITION_WEIGHTS } from '../src/ratings/overall.ts';
import { POSITIONS } from '../src/domain/positions.ts';
import { attributesFor } from '../src/data/squad-builder.ts';

/**
 * El volante de la especificacion, con los diez atributos.
 *
 * Es el mismo jugador que antes: los veinticinco valores originales se
 * promediaron dentro del atributo que los absorbio. Su pase y su calidad son
 * lo mas alto, su remate lo mas bajo, y sigue siendo un MC.
 */
const MIGUEL = buildAttributes({
  velocidad: 73, resistencia: 83, agresividad: 64, calidad: 83,
  remate: 63, regate: 76, pase: 78, tiro: 69, entradas: 70, portero: 12,
});

test('el ejemplo de la especificacion sigue siendo un volante de 80', () => {
  // Con veintinueve atributos daba exactamente 80. Con diez y los pesos
  // reequilibrados da 79: un punto de diferencia en la escala entera del juego
  // es el costo de la baja, y se fija aca para que un cambio de pesos que lo
  // corra mas se note.
  const overall = overallForPosition(MIGUEL, 'MC');
  assert.ok(overall >= 78 && overall <= 81, `dio ${overall}`);
});

test('el mismo jugador vale distinto en cada puesto', () => {
  const asMc = overallForPosition(MIGUEL, 'MC');
  const asMcd = overallForPosition(MIGUEL, 'MCD');
  const asDfc = overallForPosition(MIGUEL, 'DFC');
  const asPor = overallForPosition(MIGUEL, 'POR');
  assert.ok(asMc > asMcd, 'su mejor puesto es MC');
  assert.ok(asMcd > asDfc, 'como DFC vale menos que como MCD');
  assert.ok(asPor < asDfc, 'un jugador de campo no sirve de arquero');
});

test('cada posicion tiene su propia formula', () => {
  const seen = new Set<string>();
  for (const position of POSITIONS) {
    const weights = POSITION_WEIGHTS[position];
    // Con diez atributos ningun puesto usa los diez: un arquero no se mide por
    // el remate. Cinco es el minimo para que la formula no sea un promedio.
    assert.ok(Object.keys(weights).length >= 5, `${position} necesita pesos suficientes`);
    seen.add(JSON.stringify(weights));
  }
  // LD/LI y ED/EI son espejos, asi que quedan 9 tablas distintas de 11 puestos.
  assert.equal(seen.size, 9, 'las formulas no pueden ser todas iguales');
});

test('el delantero pesa el remate muy por encima de las entradas', () => {
  const dc = POSITION_WEIGHTS.DC;
  assert.ok((dc.remate ?? 0) > 20, 'el 9 vive del remate');
  assert.ok((dc.remate ?? 0) > 8 * (dc.entradas ?? 0));
});

test('el defensor central pesa las entradas y la agresividad', () => {
  const dfc = POSITION_WEIGHTS.DFC;
  assert.ok((dfc.entradas ?? 0) >= 30, 'un central se mide por las entradas');
  assert.ok((dfc.agresividad ?? 0) >= 20, 'y por el empuje fisico');
  assert.ok((dfc.entradas ?? 0) > ((dfc.remate ?? 0) + 1) * 5);
});

test('el arquero se mide por el atributo de arquero, y no por el remate', () => {
  const por = POSITION_WEIGHTS.POR;
  // Es el unico atributo de puesto que guarda el archivo, asi que pesa mas de
  // la mitad del overall por definicion.
  assert.ok((por.portero ?? 0) > 50);
  assert.equal(por.remate, undefined);
  assert.equal(por.entradas, undefined);
});

test('los diez atributos aparecen en alguna tabla, y ninguno sobra', () => {
  // Si un atributo no pesa en ningun puesto, no deberia existir.
  const used = new Set<string>();
  for (const position of POSITIONS) {
    for (const key of Object.keys(POSITION_WEIGHTS[position])) used.add(key);
  }
  assert.deepEqual([...used].sort(), [...ATTRIBUTE_KEYS].sort());
});

test('bestPosition encuentra el puesto natural del jugador generado', () => {
  for (const position of POSITIONS) {
    const attrs = buildAttributes(attributesFor(position, 80), position === 'POR');
    const best = bestPosition(attrs);
    // Los laterales y los extremos son intercambiables por diseño.
    const acceptable: Record<string, readonly string[]> = {
      LD: ['LD', 'LI'], LI: ['LD', 'LI'], ED: ['ED', 'EI'], EI: ['ED', 'EI'],
    };
    const allowed = acceptable[position] ?? [position];
    assert.ok(allowed.includes(best.position), `${position} dio ${best.position}`);
  }
});

test('el overall siempre queda entre 1 y 100', () => {
  const floor = buildAttributes({});
  const ceiling = buildAttributes(Object.fromEntries([...Object.keys(floor)].map((k) => [k, 100])), true);
  for (const position of POSITIONS) {
    assert.ok(overallForPosition(floor, position) >= 1);
    assert.ok(overallForPosition(ceiling, position) <= 100);
  }
});
