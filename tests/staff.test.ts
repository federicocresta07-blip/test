/**
 * Staff, instalaciones y su interaccion (secciones 7, 8).
 *
 * El test que mas importa de este archivo es `HONESTIDAD`: verifica que
 * ningun rol declare `implementado` si el juego no lo consume de verdad. Es
 * la unica forma de que el criterio "sin boosts magicos" siga siendo cierto
 * dentro de seis meses y no solo el dia que se escribio.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FACILITY_IDS,
  facilitySpec,
  facilityUpgradeCost,
  facilityUpgradeWeeks,
  facilityUpkeep,
  MAX_FACILITY_LEVEL,
  type FacilityLevel,
} from '../src/domain/facilities.ts';
import {
  MAX_STAFF_LEVEL,
  NO_STAFF_EFFECTS,
  progressionEffects,
  rolesSupportedBy,
  STAFF_ROLES,
  STAFF_SPECS,
  STAFF_UTILISATION_FLOOR,
  higherIsBetter,
  staffEffect,
  staffHireCost,
  staffSalary,
  staffSpec,
  staffUpgradeCost,
  staffUpgradeWeeks,
  utilisation,
  type StaffLevel,
} from '../src/domain/staff.ts';
import { advanceDays } from '../src/progression/after-match.ts';
import { createTeam } from '../src/domain/team.ts';
import { buildSquad } from '../src/data/squad-builder.ts';

const LEVELS: readonly StaffLevel[] = [1, 2, 3, 4, 5];
const FACILITY_LEVELS: readonly FacilityLevel[] = [1, 2, 3, 4, 5];

// ============================================================
// Las tablas de datos de juego son coherentes
// ============================================================

test('los trece roles tienen especificacion y la clave coincide con el rol', () => {
  assert.equal(STAFF_ROLES.length, 13);
  for (const role of STAFF_ROLES) {
    const spec = STAFF_SPECS[role];
    assert.equal(spec.role, role, `la clave ${role} apunta a ${spec.role}`);
    assert.ok(spec.effect.length > 10, `${role} no explica que mejora`);
    assert.ok(FACILITY_IDS.includes(spec.facility), `${role} apunta a una instalacion inexistente`);
  }
});

test('la tabla de cada rol es monotona y mejora con el nivel', () => {
  // Cada tabla va en un solo sentido, y ese sentido es el que `higherIsBetter`
  // deriva de ella. No se puede declarar al reves porque no se declara.
  for (const role of STAFF_ROLES) {
    const spec = STAFF_SPECS[role];
    const up = higherIsBetter(role);
    for (let index = 1; index < spec.effectByLevel.length; index += 1) {
      const previous = spec.effectByLevel[index - 1] as number;
      const current = spec.effectByLevel[index] as number;
      assert.ok(
        up ? current > previous : current < previous,
        `${role}: el nivel ${index + 1} no es mejor que el ${index}`,
      );
    }
  }
});

test('una reduccion se lee con signo menos aunque su tabla suba', () => {
  // El caso que confundimos una vez: el medico "reduce" y sin embargo su
  // numero crece con el nivel, porque el numero es el tamano de la reduccion.
  assert.equal(staffSpec('Médico').direction, 'reduce');
  assert.equal(higherIsBetter('Médico'), true);

  // El ojeador tambien se lee como algo que baja, pero su tabla baja de verdad:
  // el numero es el error que queda, no lo que se corrige.
  assert.equal(staffSpec('Ojeador').direction, 'reduce');
  assert.equal(higherIsBetter('Ojeador'), false);
});

test('subir de nivel siempre cuesta mas y paga mas', () => {
  for (const role of STAFF_ROLES) {
    const spec = STAFF_SPECS[role];
    for (let index = 1; index < 5; index += 1) {
      assert.ok(
        (spec.salaryByLevel[index] as number) > (spec.salaryByLevel[index - 1] as number),
        `${role}: el salario no sube al nivel ${index + 1}`,
      );
      assert.ok(
        (spec.hireCost[index] as number) > (spec.hireCost[index - 1] as number),
        `${role}: contratar un nivel mas no cuesta mas`,
      );
    }
    for (let index = 1; index < 4; index += 1) {
      assert.ok(
        (spec.upgradeCost[index] as number) > (spec.upgradeCost[index - 1] as number),
        `${role}: la mejora no se encarece con el nivel`,
      );
    }
  }
});

test('las cinco instalaciones respaldan al menos un rol cada una', () => {
  for (const id of FACILITY_IDS) {
    assert.ok(rolesSupportedBy(id).length >= 1, `${id} no respalda a nadie`);
    assert.equal(facilitySpec(id).id, id);
  }
  // Ningun rol queda sin instalacion y ninguna instalacion sobra.
  const covered = FACILITY_IDS.flatMap((id) => rolesSupportedBy(id));
  assert.equal(covered.length, STAFF_ROLES.length);
  assert.equal(new Set(covered).size, STAFF_ROLES.length);
});

test('al maximo nivel no hay mejora pendiente, ni de staff ni de instalacion', () => {
  for (const role of STAFF_ROLES) {
    assert.equal(staffUpgradeCost(role, MAX_STAFF_LEVEL), null);
    assert.equal(staffUpgradeWeeks(role, MAX_STAFF_LEVEL), null);
    assert.ok(staffSalary(role, MAX_STAFF_LEVEL) > 0);
    assert.ok(staffHireCost(role, MAX_STAFF_LEVEL) > 0);
  }
  for (const id of FACILITY_IDS) {
    assert.equal(facilityUpgradeCost(id, MAX_FACILITY_LEVEL), null);
    assert.equal(facilityUpgradeWeeks(id, MAX_FACILITY_LEVEL), null);
    assert.ok(facilityUpkeep(id, MAX_FACILITY_LEVEL) > facilityUpkeep(id, 1));
  }
});

// ============================================================
// La interaccion staff <-> instalaciones
// ============================================================

test('las instalaciones nunca potencian por encima del nivel del profesional', () => {
  for (const staffLevel of LEVELS) {
    for (const facilityLevel of FACILITY_LEVELS) {
      const factor = utilisation(staffLevel, facilityLevel);
      assert.ok(factor <= 1, `${staffLevel}/${facilityLevel} aprovecha mas del 100%`);
      assert.ok(factor >= STAFF_UTILISATION_FLOOR);
      if (facilityLevel >= staffLevel) {
        assert.equal(factor, 1, `${staffLevel}/${facilityLevel} deberia aprovechar todo`);
      } else {
        assert.ok(factor < 1, `${staffLevel}/${facilityLevel} deberia estar limitado`);
      }
    }
  }
});

test('una instalacion mejor nunca empeora el aprovechamiento', () => {
  for (const staffLevel of LEVELS) {
    for (let level = 2; level <= 5; level += 1) {
      assert.ok(
        utilisation(staffLevel, level as FacilityLevel) >=
          utilisation(staffLevel, (level - 1) as FacilityLevel),
      );
    }
  }
});

test('un rol que mejora entrega como maximo su nominal, y menos si lo limitan', () => {
  const limited = staffEffect('Preparador físico', 5, 2);
  assert.equal(limited.nominal, 26);
  assert.ok(limited.limited);
  assert.ok(limited.actual < limited.nominal);
  assert.equal(Math.round(limited.actual * 10) / 10, 19);

  const free = staffEffect('Preparador físico', 5, 5);
  assert.equal(free.utilisation, 1);
  assert.equal(free.actual, free.nominal);
  assert.equal(free.limited, false);
});

test('en un rol que reduce, el limite se aplica sobre lo que el nivel agrega', () => {
  // El medico de nivel 4 reduce un 25% el tiempo de lesion. Con el centro
  // medico en 2, no puede reducir 25: reduce algo entre el 8 (nivel 1) y 25.
  const base = staffSpec('Médico').effectByLevel[0] as number;
  const limited = staffEffect('Médico', 4, 2);
  assert.equal(limited.nominal, 25);
  assert.ok(limited.actual < limited.nominal, 'limitado tiene que reducir menos de 25');
  assert.ok(limited.actual > base, 'pero mas que un medico de nivel 1');
  assert.equal(Math.round(limited.actual * 10) / 10, 21.2);
  assert.equal(staffEffect('Médico', 4, 5).actual, 25);

  // El ojeador va al revés y la misma regla lo tiene que cubrir: su numero es
  // el margen de error, y limitado se equivoca MAS.
  const scout = staffEffect('Ojeador', 4, 2);
  assert.equal(scout.nominal, 4);
  assert.ok(scout.actual > scout.nominal, 'limitado tiene que equivocarse mas');
  assert.ok(scout.actual < (staffSpec('Ojeador').effectByLevel[0] as number));
});

test('el efecto real nunca sale del rango entre el nivel 1 y el nominal', () => {
  // Es la invariante de la interpolacion, y vale para los dos sentidos de
  // tabla: aprovechar a medias deja al profesional a medio camino entre el
  // piso de su rol y lo que su nivel permite.
  for (const role of STAFF_ROLES) {
    const table = STAFF_SPECS[role].effectByLevel;
    const floor = table[0] as number;
    for (const level of LEVELS) {
      for (const facilityLevel of FACILITY_LEVELS) {
        const effect = staffEffect(role, level, facilityLevel);
        const low = Math.min(floor, effect.nominal);
        const high = Math.max(floor, effect.nominal);
        assert.ok(
          effect.actual >= low - 1e-9 && effect.actual <= high + 1e-9,
          `${role} ${level}/${facilityLevel}: ${effect.actual} fuera de [${low}, ${high}]`,
        );
      }
    }
  }
});

test('el proximo nivel siempre es una mejora, incluso limitado', () => {
  for (const role of STAFF_ROLES) {
    const spec = STAFF_SPECS[role];
    void spec;
    for (const level of LEVELS) {
      for (const facilityLevel of FACILITY_LEVELS) {
        const effect = staffEffect(role, level, facilityLevel);
        if (level === MAX_STAFF_LEVEL) {
          assert.equal(effect.nextActual, null);
          continue;
        }
        assert.notEqual(effect.nextActual, null);
        const next = effect.nextActual as number;
        assert.ok(
          effect.higherIsBetter ? next > effect.actual : next < effect.actual,
          `${role} ${level}->${level + 1} en instalacion ${facilityLevel} no es una mejora`,
        );
      }
    }
  }
});

test('mejorar la instalacion sube el efecto sin tocar el nivel del profesional', () => {
  const before = staffEffect('Entrenador ofensivo', 5, 1);
  const after = staffEffect('Entrenador ofensivo', 5, 3);
  assert.ok(after.actual > before.actual);
  assert.equal(before.nominal, after.nominal, 'el nominal no depende de la instalacion');
});

// ============================================================
// HONESTIDAD: ningun efecto afirma hacer algo que el juego no hace
// ============================================================

test('HONESTIDAD: solo los roles que la progresion consume se declaran implementados', () => {
  const claimed = STAFF_ROLES.filter(
    (role) => STAFF_SPECS[role].consumer.kind === 'implementado',
  );

  // Los tres que la progresion entre partidos consume de verdad.
  const consumed = ['Preparador físico', 'Médico', 'Psicólogo deportivo'];
  assert.deepEqual([...claimed].sort(), [...consumed].sort());

  // Y cada uno de ellos mueve de verdad su campo en la progresion: si alguien
  // agrega un rol "implementado" sin engancharlo, este assert lo agarra.
  for (const role of claimed) {
    const withRole = progressionEffects([{ role, level: 5, facilityLevel: 5 }]);
    const withoutRole = progressionEffects([]);
    assert.notDeepEqual(withRole, withoutRole, `${role} se declara implementado pero no aporta nada`);
  }
});

test('cada efecto pendiente nombra su modulo y una fase futura', () => {
  for (const role of STAFF_ROLES) {
    const consumer = STAFF_SPECS[role].consumer;
    if (consumer.kind === 'implementado') {
      assert.ok(consumer.where.length > 5, `${role} no dice donde se aplica`);
      continue;
    }
    assert.ok(consumer.module.length > 3, `${role} no nombra el modulo que lo va a usar`);
    assert.ok(consumer.phase > 3, `${role} dice fase ${consumer.phase}: ya deberia estar hecho`);
  }
});

test('un puesto vacante no aporta ni penaliza', () => {
  assert.deepEqual(progressionEffects([]), NO_STAFF_EFFECTS);
  const partial = progressionEffects([{ role: 'Médico', level: 3, facilityLevel: 3 }]);
  assert.ok(partial.injuryRecovery > 0);
  assert.equal(partial.recovery, 0);
  assert.equal(partial.morale, 0);
});

// ============================================================
// El efecto llega hasta el plantel
// ============================================================

test('el staff acelera de verdad la recuperacion fisica del plantel', () => {
  const squad = buildSquad({ prefix: 'test', target: 78, seed: 'staff-a' });
  const tired = squad.map((player) => ({
    ...player,
    condition: { ...player.condition, fatigue: 60 },
  }));
  const team = createTeam({ id: 'test', name: 'Test', players: tired, chemistry: 70 });

  const alone = advanceDays(team, 3);
  const withStaff = advanceDays(team, 3, progressionEffects([
    { role: 'Preparador físico', level: 5, facilityLevel: 5 },
  ]));

  const fatigueOf = (input: typeof team): number =>
    input.players.reduce((total, player) => total + player.condition.fatigue, 0) /
    input.players.length;

  assert.ok(
    fatigueOf(withStaff) < fatigueOf(alone),
    'con preparador fisico el plantel tendria que recuperarse mas rapido',
  );
});

test('las instalaciones cambian cuanto sirve el mismo preparador fisico', () => {
  const squad = buildSquad({ prefix: 'test', target: 78, seed: 'staff-b' });
  const tired = squad.map((player) => ({
    ...player,
    condition: { ...player.condition, fatigue: 60 },
  }));
  const team = createTeam({ id: 'test', name: 'Test', players: tired, chemistry: 70 });

  const poor = advanceDays(team, 3, progressionEffects([
    { role: 'Preparador físico', level: 5, facilityLevel: 1 },
  ]));
  const good = advanceDays(team, 3, progressionEffects([
    { role: 'Preparador físico', level: 5, facilityLevel: 5 },
  ]));

  const fatigueOf = (input: typeof team): number =>
    input.players.reduce((total, player) => total + player.condition.fatigue, 0) /
    input.players.length;

  assert.ok(
    fatigueOf(good) < fatigueOf(poor),
    'el mismo profesional tendria que rendir mas con mejores instalaciones',
  );
});
