// Disposicion visual de la cancha en la pantalla de alineacion (seccion 6.3).
import assert from 'node:assert/strict';
import test from 'node:test';
import { formationIds, getFormation } from '../src/domain/formations.ts';
import { FORMATION_ROWS, layoutFormation } from '../src/ui/components/formation/pitch-layout.ts';

test('cada formacion del motor tiene sus filas declaradas', () => {
  for (const id of formationIds()) {
    const rows = FORMATION_ROWS[id];
    assert.ok(rows, `falta la disposición de ${id}`);
    const total = rows.reduce((a, b) => a + b, 0);
    assert.equal(total, 11, `${id}: las filas suman ${total} y tienen que sumar 11`);
  }
});

test('la disposicion ubica los once puestos, una sola vez cada uno', () => {
  for (const id of formationIds()) {
    const layout = layoutFormation(id);
    assert.equal(layout.length, 11, id);
    const indexes = new Set(layout.map((item) => item.slotIndex));
    assert.equal(indexes.size, 11, `${id}: hay puestos repetidos o faltantes`);
    for (let i = 0; i < 11; i += 1) {
      assert.ok(indexes.has(i), `${id}: falta el puesto ${i}`);
    }
  }
});

test('ningun jugador queda fuera de la cancha', () => {
  for (const id of formationIds()) {
    for (const item of layoutFormation(id)) {
      assert.ok(
        item.x >= 0.05 && item.x <= 0.95,
        `${id}: ${item.slot.position} quedó en x=${item.x.toFixed(3)}, fuera del campo`,
      );
      assert.ok(item.y >= 0 && item.y <= 1, `${id}: ${item.slot.position} quedó en y=${item.y}`);
    }
  }
});

test('el arquero va al fondo y los delanteros adelante', () => {
  for (const id of formationIds()) {
    const layout = layoutFormation(id);
    const keeper = layout.find((item) => item.slot.position === 'POR');
    assert.ok(keeper, `${id}: falta el arquero`);
    assert.equal(keeper.y, 0, `${id}: el arquero tiene que ir en la última línea`);
    assert.ok(Math.abs(keeper.x - 0.5) < 0.01, `${id}: el arquero va centrado`);

    const deepest = Math.max(...layout.map((item) => item.y));
    const forwards = layout.filter((item) => item.y === deepest);
    for (const forward of forwards) {
      assert.ok(
        forward.slot.attackDuty > 0.6,
        `${id}: ${forward.slot.position} está adelante pero no tiene tarea ofensiva`,
      );
    }
  }
});

test('la linea con laterales se abre mas que una linea central', () => {
  // La defensa de cuatro del 4-3-3 usa mas ancho que su mediocampo de tres.
  const layout = layoutFormation('4-3-3');
  const rows = FORMATION_ROWS['4-3-3'] as readonly number[];
  const defence = layout.filter((item) => item.slotIndex >= 1 && item.slotIndex <= 4);
  const midfield = layout.filter((item) => item.slotIndex >= 5 && item.slotIndex <= 7);
  const span = (items: typeof layout): number =>
    Math.max(...items.map((i) => i.x)) - Math.min(...items.map((i) => i.x));
  assert.equal(rows.length, 4);
  assert.ok(span(defence) > span(midfield), 'la línea de cuatro tiene que abrirse más');
});

test('los puestos de banda quedan de su lado de la cancha', () => {
  for (const id of formationIds()) {
    for (const item of layoutFormation(id)) {
      const width = getFormation(id).slots[item.slotIndex]?.position;
      if (width === 'LI' || width === 'EI') {
        assert.ok(item.x < 0.5, `${id}: ${width} tiene que ir a la izquierda, está en ${item.x.toFixed(2)}`);
      }
      if (width === 'LD' || width === 'ED') {
        assert.ok(item.x > 0.5, `${id}: ${width} tiene que ir a la derecha, está en ${item.x.toFixed(2)}`);
      }
    }
  }
});
