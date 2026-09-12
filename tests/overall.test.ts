// Seccion 25: atributos y overall por posicion.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttributes } from '../src/domain/attributes.ts';
import { bestPosition, overallForPosition, POSITION_WEIGHTS } from '../src/ratings/overall.ts';
import { POSITIONS } from '../src/domain/positions.ts';
import { attributesFor } from '../src/data/squad-builder.ts';

const MIGUEL = buildAttributes({
  velocidad: 71, aceleracion: 74, resistencia: 83, fuerza: 68,
  paseCorto: 86, paseLargo: 79, tecnica: 84, control: 82, regate: 76,
  definicion: 63, remate: 72, marcaje: 67, quite: 73,
  vision: 87, decisiones: 84, posicionamiento: 81, concentracion: 78,
  trabajoEquipo: 80, agilidad: 74, salto: 60, centros: 70,
  tirosLibres: 70, penales: 65, juegoAereo: 60, agresividad: 65,
});

test('el ejemplo de la especificacion da overall 80 como MC', () => {
  assert.equal(overallForPosition(MIGUEL, 'MC'), 80);
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
    assert.ok(Object.keys(weights).length >= 10, `${position} necesita pesos suficientes`);
    seen.add(JSON.stringify(weights));
  }
  // LD/LI y ED/EI son espejos, asi que quedan 9 tablas distintas de 11 puestos.
  assert.equal(seen.size, 9, 'las formulas no pueden ser todas iguales');
});

test('el delantero pesa definicion muy por encima de marcaje y quite', () => {
  const dc = POSITION_WEIGHTS.DC;
  assert.ok((dc.definicion ?? 0) > 15);
  assert.ok((dc.posicionamiento ?? 0) > 10);
  assert.ok((dc.definicion ?? 0) > 4 * ((dc.marcaje ?? 0) + (dc.quite ?? 0) + 1));
});

test('el defensor central pesa marcaje, quite, fuerza y juego aereo', () => {
  const dfc = POSITION_WEIGHTS.DFC;
  for (const key of ['marcaje', 'quite', 'posicionamiento', 'fuerza', 'juegoAereo', 'concentracion'] as const) {
    assert.ok((dfc[key] ?? 0) >= 6, `DFC deberia valorar ${key}`);
  }
  assert.ok((dfc.marcaje ?? 0) > (dfc.definicion ?? 0) * 5);
});

test('el arquero se mide con atributos de arquero', () => {
  const por = POSITION_WEIGHTS.POR;
  assert.ok((por.reflejos ?? 0) > 15);
  assert.ok((por.manos ?? 0) > 10);
  assert.equal(por.definicion, undefined);
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
