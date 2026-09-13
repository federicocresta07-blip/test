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
  type StaffRole,
} from '../src/domain/staff.ts';
import { advanceDays } from '../src/progression/after-match.ts';
import { preventionFactor } from '../src/engine/discipline.ts';
import { developPlayer } from '../src/progression/development.ts';
import { scoutPotential } from '../src/domain/youth.ts';
import { appraise } from '../src/domain/market.ts';
import { scoutingDetail } from '../src/ui/lib/scouting.ts';
import { createPlayer } from '../src/domain/player.ts';
import { createTeam } from '../src/domain/team.ts';
import { simulateMatch } from '../src/engine/match-engine.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';
import { navigationPhaseMismatches } from '../src/ui/router/navigation.ts';
import { phasePlan } from '../src/ui/router/plan.ts';

const LEVELS: readonly StaffLevel[] = [1, 2, 3, 4, 5];

/** Un jugador del mercado, para probar los informes del ojeador. */
const marketTarget = createPlayer({
  id: 'objetivo',
  name: 'Objetivo',
  position: 'DC',
  age: 24,
  potential: 88,
  attributes: attributesFor('DC', 80),
});
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

/**
 * Los tres caminos por los que un efecto del staff llega al juego.
 *
 * Un rol que se declara implementado tiene que estar en alguno. Si alguien
 * agrega uno sin engancharlo, este test lo agarra.
 */
const CONSUMED_BY: Readonly<Record<string, readonly StaffRole[]>> = {
  // Evolucion del plantel entre partidos (`progression/after-match.ts`).
  progresion: ['Preparador físico', 'Médico', 'Psicólogo deportivo'],
  // Desarrollo de atributos (`progression/development.ts` via `training.ts`).
  desarrollo: [
    'Entrenador de arqueros',
    'Entrenador defensivo',
    'Entrenador de mediocampistas',
    'Entrenador ofensivo',
    'Entrenador juvenil',
  ],
  // Informes: el ancho del rango de un juvenil y el detalle de un rival.
  informes: ['Ojeador juvenil', 'Analista de rivales'],
  // Mercado: con cuanta precision se ve a un jugador de otro club y cuanto se
  // cree que vale.
  mercado: ['Ojeador', 'Secretario técnico'],
  // Las lesiones que sortea el partido (`engine/discipline.ts` via
  // `team.injuryPrevention`). Fue el ultimo rol en engancharse: hasta la fase
  // 8 el motor tomaba el riesgo de su configuracion global, igual para los
  // veinte clubes, asi que mejorar al fisioterapeuta no movia nada.
  partido: ['Fisioterapeuta'],
};

test('HONESTIDAD: todo rol implementado tiene un consumidor de verdad', () => {
  const claimed = STAFF_ROLES.filter(
    (role) => STAFF_SPECS[role].consumer.kind === 'implementado',
  );
  const wired = Object.values(CONSUMED_BY).flat();

  assert.deepEqual(
    [...claimed].sort(),
    [...wired].sort(),
    'hay un rol que se declara implementado sin estar enganchado a ningun modulo',
  );

  // Y cada camino mueve de verdad lo que tiene que mover.
  for (const role of CONSUMED_BY['progresion'] as readonly StaffRole[]) {
    const withRole = progressionEffects([{ role, level: 5, facilityLevel: 5 }]);
    assert.notDeepEqual(withRole, NO_STAFF_EFFECTS, `${role} no aporta nada a la progresion`);
  }

  for (const role of CONSUMED_BY['desarrollo'] as readonly StaffRole[]) {
    // El entrenador tiene que acelerar el desarrollo de sus jugadores.
    const player = createPlayer({
      id: 'joven',
      name: 'Joven',
      position: role === 'Entrenador de arqueros' ? 'POR' : 'DC',
      age: 18,
      potential: 88,
      attributes: attributesFor(role === 'Entrenador de arqueros' ? 'POR' : 'DC', 65),
    });
    const coaching = staffEffect(role, 5, 5).actual;
    assert.ok(coaching > 0, `${role} declara un efecto de cero`);

    const withCoach = developPlayer({ player, weeks: 22, minutes: 1800, coaching, seed: 'x' });
    const without = developPlayer({ player, weeks: 22, minutes: 1800, coaching: 0, seed: 'x' });
    assert.ok(
      withCoach.overallAfter > without.overallAfter,
      `${role} no hace crecer mas rapido a sus jugadores`,
    );
  }

  // El fisioterapeuta tiene que reducir las lesiones que sortea el partido.
  for (const role of CONSUMED_BY['partido'] as readonly StaffRole[]) {
    const effect = staffEffect(role, 5, 5).actual;
    assert.ok(effect > 0, `${role} declara un efecto de cero`);
    assert.ok(
      preventionFactor(effect) < preventionFactor(0),
      `${role} no reduce el riesgo de lesion`,
    );
    // Y nunca lo anula: el mejor fisioterapeuta no evita un ligamento roto.
    assert.ok(preventionFactor(effect) > 0, `${role} anula el riesgo por completo`);
  }

  // El ojeador del mercado angosta el informe sobre un jugador ajeno y el
  // secretario tecnico afina la tasacion.
  const rough = appraise({
    player: marketTarget,
    contractMonths: 24,
    scoutMargin: staffEffect('Ojeador', 1, 1).actual,
    valuerError: staffEffect('Secretario técnico', 1, 1).actual,
  });
  const sharp = appraise({
    player: marketTarget,
    contractMonths: 24,
    scoutMargin: staffEffect('Ojeador', 5, 5).actual,
    valuerError: staffEffect('Secretario técnico', 5, 5).actual,
  });
  assert.ok(
    sharp.overallHigh - sharp.overallLow < rough.overallHigh - rough.overallLow,
    'un mejor ojeador tiene que informar un rango de nivel mas angosto',
  );
  assert.ok(
    sharp.valueMargin < rough.valueMargin,
    'un mejor secretario tecnico tiene que tasar con menos error',
  );

  // El ojeador juvenil angosta el rango; el analista sube el detalle.
  const poor = scoutPotential(80, staffEffect('Ojeador juvenil', 1, 1).actual, 'x');
  const good = scoutPotential(80, staffEffect('Ojeador juvenil', 5, 5).actual, 'x');
  assert.ok(good.width < poor.width, 'un mejor ojeador juvenil tiene que informar un rango mas angosto');
  assert.ok(
    scoutingDetail(staffEffect('Analista de rivales', 5, 5)).showsSquad,
    'un analista de cinco estrellas tiene que destrabar el plantel del rival',
  );
  assert.equal(
    scoutingDetail(staffEffect('Analista de rivales', 1, 1)).showsSquad,
    false,
    'un analista de una estrella no puede mostrar el plantel del rival',
  );
});

test('HONESTIDAD: un efecto pendiente apunta a una fase que de verdad esta pendiente', () => {
  // La version anterior de este test pedia `phase > 3`, y eso dejo pasar al
  // analista de rivales diciendo "fase 7" DESPUES de entregar la fase 7. Ahora
  // se verifica contra el plan declarado en `router/plan.ts`, que es el unico
  // lugar donde vive el estado de cada fase.

  for (const role of STAFF_ROLES) {
    const consumer = STAFF_SPECS[role].consumer;
    if (consumer.kind === 'implementado') {
      assert.ok(consumer.where.length > 5, `${role} no dice donde se aplica`);
      continue;
    }
    assert.ok(consumer.module.length > 3, `${role} no nombra el modulo que lo va a usar`);
    const promised = phasePlan(consumer.phase);
    assert.ok(promised, `${role} promete la fase ${consumer.phase}, que no existe en el plan`);
    assert.equal(
      promised.delivered,
      false,
      `${role} promete la fase ${consumer.phase} (${promised.label}), que ya esta entregada`,
    );
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

test('HONESTIDAD: la navegacion y el plan dicen lo mismo', () => {
  // Marcar una pantalla como lista sin actualizar su fase dejaria el plan
  // diciendo una cosa y la aplicacion otra.
  assert.deepEqual(navigationPhaseMismatches(), []);
});

test('EL FISIOTERAPEUTA CAMBIA EL PARTIDO, no solo la ficha', () => {
  // El test de honestidad de mas arriba verifica que el rol este enganchado.
  // Este mide que el enganche SIRVA: se juegan miles de partidos con y sin
  // fisioterapeuta y se cuentan las lesiones que salen.
  //
  // Medido: sin fisioterapeuta 0,203 lesiones por partido; con uno de cinco
  // estrellas 0,159. Sobre un torneo de 19 fechas es casi una lesion menos por
  // temporada, que es poco y es exactamente lo que un fisioterapeuta hace.
  const squadOf = (id: string) => buildSquad({ target: 78, prefix: id, seed: 'fisio' });
  const teamWith = (id: string, prevention: number) =>
    createTeam({
      id,
      name: id,
      players: squadOf(id),
      chemistry: 70,
      injuryPrevention: prevention,
    });

  const injuriesWith = (prevention: number): number => {
    let total = 0;
    const matches = 1500;
    for (let seed = 0; seed < matches; seed += 1) {
      const result = simulateMatch({
        home: teamWith('A', prevention),
        away: teamWith('B', 0),
        seed,
      });
      total += result.events.filter(
        (event) => event.type === 'lesion' && event.side === 'local',
      ).length;
    }
    return total / matches;
  };

  const without = injuriesWith(0);
  const withBest = injuriesWith(staffEffect('Fisioterapeuta', 5, 5).actual);

  assert.ok(without > 0, 'tienen que salir lesiones: si no, el test no mide nada');
  assert.ok(
    withBest < without,
    `el fisioterapeuta tiene que reducirlas: ${without.toFixed(3)} vs ${withBest.toFixed(3)}`,
  );
  // Y no puede hacerlas desaparecer: un plantel blindado rompe el juego.
  assert.ok(
    withBest > without * 0.6,
    `el mejor fisioterapeuta no puede blindar al plantel: ${withBest.toFixed(3)}`,
  );

  // El rival, que no tiene fisioterapeuta, se sigue lesionando igual: el
  // efecto es POR EQUIPO y no una constante global del motor.
  let awayInjuries = 0;
  for (let seed = 0; seed < 600; seed += 1) {
    const result = simulateMatch({
      home: teamWith('A', staffEffect('Fisioterapeuta', 5, 5).actual),
      away: teamWith('B', 0),
      seed,
    });
    awayInjuries += result.events.filter(
      (event) => event.type === 'lesion' && event.side === 'visitante',
    ).length;
  }
  assert.ok(awayInjuries / 600 > withBest, 'el rival sin fisioterapeuta se lesiona mas');
});
