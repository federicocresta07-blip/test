// Seccion 27: overall dinamico. Y secciones 35, 36, 37, 40.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config/engine-config.ts';
import { Rng } from '../src/core/rng.ts';
import { getFormation } from '../src/domain/formations.ts';
import { createPlayer, type Player, type PlayerCondition } from '../src/domain/player.ts';
import { buildTacticalProfile, createTactics } from '../src/domain/tactics.ts';
import { evaluatePerformance } from '../src/ratings/effective-rating.ts';
import { playerOverall } from '../src/domain/player.ts';
import { attributesFor } from '../src/data/squad-builder.ts';

const profile = buildTacticalProfile(createTactics({ formationId: '4-4-2' }));
const slot = getFormation('4-4-2').slots[6]!; // un MC
const context = { isHome: false, importance: 0.4, chemistry: 60 };

function mc(condition: Partial<PlayerCondition> = {}, extra: Partial<Player> = {}): Player {
  const base = createPlayer({
    id: 'mc', name: 'Mediocampista', position: 'MC',
    attributes: attributesFor('MC', 82),
    condition: { form: 55, morale: 60, fatigue: 10, sharpness: 85, ...condition },
    consistency: 60, experience: 60,
  });
  return { ...base, ...extra };
}

test('el jugador base ronda su overall', () => {
  const player = mc();
  assert.equal(playerOverall(player), 82);
  const perf = evaluatePerformance(player, 'MC', slot, profile, context, DEFAULT_CONFIG);
  assert.ok(Math.abs(perf.expected - 82) < 6, `esperado ${perf.expected}`);
});

test('un 82 puede rendir como 86 y otro dia como 77, pero la variacion es acotada', () => {
  const player = mc();
  let min = 100;
  let max = 0;
  const rng = new Rng('variacion');
  for (let i = 0; i < 4000; i += 1) {
    const perf = evaluatePerformance(player, 'MC', slot, profile, context, DEFAULT_CONFIG, rng);
    min = Math.min(min, perf.effective);
    max = Math.max(max, perf.effective);
  }
  const expected = evaluatePerformance(player, 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  assert.ok(max - expected >= 3, 'tiene que poder rendir por encima de su nivel');
  assert.ok(expected - min >= 3, 'y tambien por debajo');
  assert.ok(max - expected <= 11, `la variacion hacia arriba se fue de rango: ${max - expected}`);
  assert.ok(expected - min <= 11, `la variacion hacia abajo se fue de rango: ${expected - min}`);
});

test('la forma sube y baja el rendimiento (seccion 36)', () => {
  const great = evaluatePerformance(mc({ form: 95 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  const normal = evaluatePerformance(mc({ form: 50 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  const awful = evaluatePerformance(mc({ form: 10 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  assert.ok(great > normal && normal > awful);
  assert.ok(great - awful <= DEFAULT_CONFIG.performance.formSwing * 2.2, 'la forma no puede ser decisiva sola');
});

test('la moral influye, poco (seccion 35)', () => {
  const high = evaluatePerformance(mc({ morale: 95 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  const low = evaluatePerformance(mc({ morale: 10 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  assert.ok(high > low);
  assert.ok(high - low <= DEFAULT_CONFIG.performance.moraleSwing * 2.2);
});

test('la fatiga baja el rendimiento (seccion 37)', () => {
  const fresh = evaluatePerformance(mc({ fatigue: 0 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  const spent = evaluatePerformance(mc({ fatigue: 95 }), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  assert.ok(fresh - spent > 8, `la fatiga tiene que doler: ${fresh - spent}`);
});

test('la experiencia pesa en los partidos importantes (seccion 40)', () => {
  const veteran = { ...mc(), experience: 95 };
  const kid = { ...mc(), experience: 15 };
  const friendly = { isHome: false, importance: 0, chemistry: 60 };
  const final = { isHome: false, importance: 1, chemistry: 60 };

  const gapFriendly =
    evaluatePerformance(veteran, 'MC', slot, profile, friendly, DEFAULT_CONFIG).expected -
    evaluatePerformance(kid, 'MC', slot, profile, friendly, DEFAULT_CONFIG).expected;
  const gapFinal =
    evaluatePerformance(veteran, 'MC', slot, profile, final, DEFAULT_CONFIG).expected -
    evaluatePerformance(kid, 'MC', slot, profile, final, DEFAULT_CONFIG).expected;

  assert.ok(Math.abs(gapFriendly) < 0.5, 'en un amistoso la experiencia casi no pesa');
  assert.ok(gapFinal > 2, `en una final si: ${gapFinal}`);
});

test('el jugador consistente varia menos que el irregular (seccion 40)', () => {
  const steady = { ...mc(), consistency: 95, experience: 90 };
  const erratic = { ...mc(), consistency: 20, experience: 20 };
  const spread = (player: Player): number => {
    const rng = new Rng('spread');
    const values: number[] = [];
    for (let i = 0; i < 3000; i += 1) {
      values.push(evaluatePerformance(player, 'MC', slot, profile, context, DEFAULT_CONFIG, rng).variation);
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  };
  assert.ok(spread(steady) < spread(erratic) * 0.8, 'el consistente tiene que variar menos');
});

test('la cohesion del equipo mueve el rendimiento (seccion 39)', () => {
  const gelled = evaluatePerformance(mc(), 'MC', slot, profile, { ...context, chemistry: 95 }, DEFAULT_CONFIG).expected;
  const broken = evaluatePerformance(mc(), 'MC', slot, profile, { ...context, chemistry: 15 }, DEFAULT_CONFIG).expected;
  assert.ok(gelled > broken);
  assert.ok(gelled - broken < 6, 'la quimica ayuda, no define');
});

test('la localia suma poco (seccion 34)', () => {
  const home = evaluatePerformance(mc(), 'MC', slot, profile, { ...context, isHome: true }, DEFAULT_CONFIG).expected;
  const away = evaluatePerformance(mc(), 'MC', slot, profile, context, DEFAULT_CONFIG).expected;
  assert.ok(home > away);
  assert.ok(home - away <= 2);
});

test('el desglose explica de donde sale cada punto', () => {
  const perf = evaluatePerformance(mc({ form: 90, fatigue: 40 }), 'MCD', slot, profile, context, DEFAULT_CONFIG);
  assert.ok(perf.form > 0);
  assert.ok(perf.fatigue < 0);
  assert.equal(perf.positionFit.assigned, 'MCD');
  assert.ok(perf.effective >= 1 && perf.effective <= 100);
});
