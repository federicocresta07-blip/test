// Seccion 31: la formacion redistribuye la fuerza sin ser mejor en absoluto.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FORMATIONS, formationIds, getFormation } from '../src/domain/formations.ts';

test('toda formacion tiene once puestos y un solo arquero', () => {
  for (const formation of FORMATIONS) {
    assert.equal(formation.slots.length, 11, `${formation.id}`);
    const keepers = formation.slots.filter((s) => s.position === 'POR');
    assert.equal(keepers.length, 1, `${formation.id} necesita exactamente un arquero`);
  }
});

test('ninguna formacion es universalmente superior: sus modificadores suman cero', () => {
  for (const formation of FORMATIONS) {
    const total = Object.values(formation.modifiers).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total) < 1e-9, `${formation.id} suma ${total}`);
  }
});

test('los modificadores son empujones chicos, no saltos', () => {
  for (const formation of FORMATIONS) {
    for (const [dimension, value] of Object.entries(formation.modifiers)) {
      assert.ok(Math.abs(value) <= 4, `${formation.id}.${dimension} = ${value} es demasiado`);
    }
  }
});

test('las tareas de cada puesto estan en rango', () => {
  for (const formation of FORMATIONS) {
    for (const slot of formation.slots) {
      assert.ok(slot.attackDuty >= 0 && slot.attackDuty <= 1);
      assert.ok(slot.defenseDuty >= 0 && slot.defenseDuty <= 1);
    }
  }
});

test('el 4-3-3 favorece ataque y presion; el 5-3-2 defensa y contraataque', () => {
  const f433 = getFormation('4-3-3');
  const f532 = getFormation('5-3-2');
  assert.ok((f433.modifiers.ataque ?? 0) > 0);
  assert.ok((f433.modifiers.presion ?? 0) > 0);
  assert.ok(f433.traits.width > f532.traits.width, 'el 4-3-3 juega mas ancho');
  assert.ok((f532.modifiers.defensa ?? 0) > 0);
  assert.ok((f532.modifiers.contraataque ?? 0) > 0);
  assert.ok(f532.traits.boxProtection > f433.traits.boxProtection, 'el 5-3-2 protege mas el area');
});

test('getFormation avisa cuando la formacion no existe', () => {
  assert.throws(() => getFormation('7-0-3'), /Formacion desconocida/);
  assert.ok(formationIds().length >= 6, 'hacen falta varias formaciones para que haya decision');
});
