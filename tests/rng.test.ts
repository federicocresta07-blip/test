import assert from 'node:assert/strict';
import test from 'node:test';
import { Rng } from '../src/core/rng.ts';

test('la misma semilla produce la misma secuencia', () => {
  const a = new Rng('river-racing');
  const b = new Rng('river-racing');
  for (let i = 0; i < 200; i += 1) assert.equal(a.next(), b.next());
});

test('semillas distintas producen secuencias distintas', () => {
  const a = new Rng(1);
  const b = new Rng(2);
  let differences = 0;
  for (let i = 0; i < 50; i += 1) if (a.next() !== b.next()) differences += 1;
  assert.ok(differences > 45);
});

test('la uniforme queda en [0,1) y centrada en 0.5', () => {
  const rng = new Rng(7);
  let total = 0;
  for (let i = 0; i < 100_000; i += 1) {
    const v = rng.next();
    assert.ok(v >= 0 && v < 1);
    total += v;
  }
  assert.ok(Math.abs(total / 100_000 - 0.5) < 0.01);
});

test('poisson respeta su media', () => {
  const rng = new Rng(11);
  let total = 0;
  for (let i = 0; i < 60_000; i += 1) total += rng.poisson(1.4);
  assert.ok(Math.abs(total / 60_000 - 1.4) < 0.03);
});

test('la normal acotada nunca se escapa del corte', () => {
  const rng = new Rng(13);
  for (let i = 0; i < 50_000; i += 1) {
    const v = rng.boundedNormal(0, 4, 2.5);
    assert.ok(Math.abs(v) <= 4 * 2.5 + 1e-9);
  }
});

test('weightedIndex respeta los pesos', () => {
  const rng = new Rng(17);
  const counts = [0, 0, 0];
  for (let i = 0; i < 30_000; i += 1) {
    const index = rng.weightedIndex([1, 3, 6]);
    counts[index] = (counts[index] ?? 0) + 1;
  }
  assert.ok(Math.abs((counts[0] as number) / 30_000 - 0.1) < 0.02);
  assert.ok(Math.abs((counts[1] as number) / 30_000 - 0.3) < 0.02);
  assert.ok(Math.abs((counts[2] as number) / 30_000 - 0.6) < 0.02);
});
