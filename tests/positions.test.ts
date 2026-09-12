// Seccion 26: posiciones y penalizacion por jugar fuera de puesto.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { createPlayer } from '../src/domain/player.ts';
import { POSITIONS, POSITION_META, familiarityTier } from '../src/domain/positions.ts';
import { evaluatePositionFit } from '../src/ratings/position-fit.ts';
import { attributesFor } from '../src/data/squad-builder.ts';

function player(position: Parameters<typeof attributesFor>[0], secondary: readonly string[] = []) {
  return createPlayer({
    id: `p-${position}`,
    name: `Jugador ${position}`,
    position,
    attributes: attributesFor(position, 80),
    secondaryPositions: secondary as never,
  });
}

const penalty = (natural: Parameters<typeof player>[0], assigned: Parameters<typeof player>[0]): number =>
  evaluatePositionFit(player(natural), assigned, DEFAULT_CONFIG).penalty;

test('las once posiciones minimas existen', () => {
  for (const code of ['POR', 'LD', 'DFC', 'LI', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'SD', 'DC'] as const) {
    assert.ok(POSITIONS.includes(code), `falta ${code}`);
    assert.ok(POSITION_META[code].name.length > 0);
  }
});

test('en su posicion natural no hay penalizacion', () => {
  for (const position of POSITIONS) assert.equal(penalty(position, position), 0);
});

test('los ejemplos de la especificacion se cumplen: MCD < DFC < DC a DFC', () => {
  const mcToMcd = penalty('MC', 'MCD');
  const mcToDfc = penalty('MC', 'DFC');
  const dcToDfc = penalty('DC', 'DFC');

  assert.ok(mcToMcd > 0 && mcToMcd <= 0.05, `MC jugando MCD deberia ser chica, fue ${mcToMcd}`);
  assert.ok(mcToDfc >= 0.12 && mcToDfc <= 0.2, `MC jugando DFC deberia ser considerable, fue ${mcToDfc}`);
  assert.ok(dcToDfc >= 0.25, `DC jugando DFC deberia ser muy grande, fue ${dcToDfc}`);
  assert.ok(mcToMcd < mcToDfc && mcToDfc < dcToDfc, 'la penalizacion tiene que escalar');
});

test('el arco es un caso aparte en los dos sentidos', () => {
  for (const position of POSITIONS) {
    if (position === 'POR') continue;
    assert.ok(penalty(position, 'POR') >= 0.5, `${position} al arco deberia ser catastrofico`);
    assert.ok(penalty('POR', position) >= 0.5, `el arquero afuera deberia ser catastrofico`);
  }
});

test('una posicion secundaria casi no penaliza', () => {
  const versatile = player('MC', ['DFC']);
  const fit = evaluatePositionFit(versatile, 'DFC', DEFAULT_CONFIG);
  assert.equal(fit.isSecondary, true);
  assert.ok(fit.penalty <= DEFAULT_CONFIG.performance.secondaryPositionPenalty);
  assert.ok(fit.penalty < penalty('MC', 'DFC'), 'tenerla trabajada tiene que servir');
});

test('la familiaridad es simetrica', () => {
  for (const a of POSITIONS) {
    for (const b of POSITIONS) {
      assert.equal(familiarityTier(a, b), familiarityTier(b, a), `${a}/${b}`);
    }
  }
});

test('cambiar de banda cuesta, pero menos que cambiar de linea', () => {
  assert.ok(penalty('LD', 'LI') > 0);
  assert.ok(penalty('LD', 'LI') < penalty('LD', 'MC'));
  assert.ok(penalty('ED', 'EI') < penalty('ED', 'DFC'));
});

test('la etiqueta describe la situacion', () => {
  assert.equal(evaluatePositionFit(player('MC'), 'MC', DEFAULT_CONFIG).label, 'natural');
  assert.equal(evaluatePositionFit(player('MC', ['MCO']), 'MCO', DEFAULT_CONFIG).label, 'secundaria');
  assert.equal(evaluatePositionFit(player('DC'), 'DFC', DEFAULT_CONFIG).label, 'fuera de posicion');
});
