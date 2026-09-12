/**
 * Desarrollo de atributos, entrenamiento e inferiores (fase 4).
 *
 * El test mas importante del archivo es `muerte por redondeo`: la primera
 * version guardaba los atributos redondeados a entero, asi que una ganancia de
 * 0,4 puntos por semana se redondeaba a cero y NO SE ACUMULABA NUNCA. El
 * sistema parecia funcionar —no fallaba nada— y era completamente inerte.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ageFactor,
  BASELINE_COACHING,
  developPlayer,
  developSquad,
  groupOf,
  headroom,
  minutesFactor,
  PEAK_AGE,
  TRAINING_FOCUSES,
  type TrainingFocus,
} from '../src/progression/development.ts';
import {
  coachRoleFor,
  defaultFocusFor,
  focusFor,
  individualCount,
  intensityLabel,
  DEFAULT_TRAINING_PLAN,
} from '../src/domain/training.ts';
import {
  canPromote,
  confidenceOf,
  estimatedPotential,
  intakeShape,
  MIN_PROMOTION_AGE,
  mustLeave,
  scoutPotential,
} from '../src/domain/youth.ts';
import { createPlayer, defaultPotential, type Player } from '../src/domain/player.ts';
import { POSITIONS } from '../src/domain/positions.ts';
import { attributesFor } from '../src/data/squad-builder.ts';
import { overallForPosition } from '../src/ratings/overall.ts';
import { staffEffect } from '../src/domain/staff.ts';
import { buildYouthSquad } from '../src/ui/data/youth.ts';

/** Una temporada de 19 fechas son unas 22 semanas. */
const SEASON_WEEKS = 22;
const SEASON_MINUTES = 1900;

function player(options: {
  age: number;
  overall: number;
  potential?: number;
  position?: Player['position'];
  id?: string;
}): Player {
  const position = options.position ?? 'DC';
  return createPlayer({
    id: options.id ?? `p-${options.age}-${options.overall}`,
    name: 'Test',
    position,
    age: options.age,
    ...(options.potential !== undefined ? { potential: options.potential } : {}),
    attributes: attributesFor(position, options.overall),
  });
}

// ============================================================
// El potencial, que antes no significaba nada
// ============================================================

test('el potencial por defecto deja margen a los jovenes y casi nada a los grandes', () => {
  // Antes de la fase 4 el potencial por defecto era el overall actual: nadie
  // tenia margen y por lo tanto nadie podia crecer nunca.
  const young = [1, 2, 3, 4, 5, 6].map((n) => defaultPotential(70, 17, `j${n}`) - 70);
  const old = [1, 2, 3, 4, 5, 6].map((n) => defaultPotential(70, 31, `v${n}`) - 70);

  assert.ok(Math.min(...young) >= 12, `un pibe de 17 tiene que tener margen: ${young.join(',')}`);
  assert.ok(Math.max(...old) <= 2, `un jugador de 31 casi no tiene margen: ${old.join(',')}`);

  // Y la variacion es lo que hace que valga la pena tener un ojeador: dos
  // pibes del mismo nivel pueden tener techos distintos.
  assert.ok(new Set(young).size > 1, 'todos los juveniles no pueden tener el mismo techo');
});

test('el potencial es determinista: el mismo jugador tiene siempre el mismo techo', () => {
  assert.equal(defaultPotential(70, 18, 'mismo'), defaultPotential(70, 18, 'mismo'));
  assert.notEqual(defaultPotential(70, 18, 'uno'), defaultPotential(70, 18, 'otro'));
});

// ============================================================
// La curva
// ============================================================

test('la curva de edad crece de joven, se estanca en el pico y cae despues', () => {
  assert.ok(ageFactor(17, 'fisico') > ageFactor(24, 'fisico'));
  assert.ok(ageFactor(24, 'fisico') > ageFactor(PEAK_AGE + 2, 'fisico'));
  assert.ok(ageFactor(33, 'fisico') < 0, 'a los 33 se pierde fisico');

  // Lo fisico se va antes que lo mental: es lo que hace que un veterano siga
  // sirviendo.
  assert.ok(
    ageFactor(33, 'mental') > ageFactor(33, 'fisico'),
    'a los 33 la cabeza tiene que aguantar mejor que las piernas',
  );
  assert.ok(ageFactor(36, 'mental') > ageFactor(36, 'fisico'));
});

test('el margen se mide contra el potencial y se agota en el techo', () => {
  assert.equal(headroom(player({ age: 20, overall: 70, potential: 70 })), 0);
  assert.equal(headroom(player({ age: 20, overall: 70, potential: 65 })), 0, 'por encima del techo, cero');
  assert.ok(headroom(player({ age: 20, overall: 70, potential: 90 })) > 0.5);
});

test('jugar desarrolla mas, pero entrenar sin jugar tampoco es cero', () => {
  const none = minutesFactor(0, 20);
  const some = minutesFactor(900, 20);
  const all = minutesFactor(1800, 20);

  assert.ok(none > 0.3, 'el que no juega igual entrena');
  assert.ok(some > none && all > some);
  assert.equal(all, 1, 'jugar todo es el maximo');
  assert.equal(minutesFactor(5000, 20), 1, 'jugar el doble no desarrolla el doble');
});

// ============================================================
// El desarrollo, medido
// ============================================================

test('un juvenil con margen que juega crece de verdad en una temporada', () => {
  const young = player({ age: 17, overall: 59, potential: 80, id: 'joven' });
  const result = developPlayer({
    player: young,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    coaching: 17,
    seed: 'x',
  });

  const gained = result.overallAfter - result.overallBefore;
  assert.ok(gained >= 7, `un juvenil con margen tendria que ganar varios puntos, gano ${gained}`);
  assert.ok(gained <= 16, `tampoco puede pegar un salto irreal: gano ${gained}`);
  assert.ok(result.changes.length > 10, 'tendrian que moverse muchos atributos');
  assert.ok(result.reasons.length >= 3, 'el resultado tiene que explicarse');
});

test('MUERTE POR REDONDEO: el desarrollo semanal se acumula', () => {
  // Aplicar el desarrollo fecha a fecha con los atributos redondeados a entero
  // hacia que una ganancia de 0,4 puntos por semana se redondeara a cero y no
  // se acumulara nunca. El sistema no fallaba: simplemente no hacia nada.
  const young = player({ age: 18, overall: 62, potential: 84, id: 'acumula' });

  let weekly = young;
  for (let week = 0; week < SEASON_WEEKS; week += 1) {
    weekly = developPlayer({
      player: weekly,
      weeks: 1,
      minutes: SEASON_MINUTES / SEASON_WEEKS,
      coaching: 17,
      seed: `semana-${week}`,
    }).player;
  }

  const inOneGo = developPlayer({
    player: young,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    coaching: 17,
    seed: 'de-una',
  }).player;

  const weeklyGain =
    overallForPosition(weekly.attributes, weekly.position) -
    overallForPosition(young.attributes, young.position);
  const singleGain =
    overallForPosition(inOneGo.attributes, inOneGo.position) -
    overallForPosition(young.attributes, young.position);

  assert.ok(weeklyGain > 4, `semana a semana tiene que acumular, gano ${weeklyGain.toFixed(2)}`);
  // No tienen que dar exactamente lo mismo (el azar se sortea por separado),
  // pero tienen que estar en el mismo orden de magnitud.
  assert.ok(
    Math.abs(weeklyGain - singleGain) < singleGain * 0.5 + 2,
    `semana a semana dio ${weeklyGain.toFixed(2)} y de una vez ${singleGain.toFixed(2)}`,
  );
});

test('un jugador en su techo no crece por mas que entrene', () => {
  const capped = player({ age: 26, overall: 80, potential: 80, id: 'techo' });
  const result = developPlayer({
    player: capped,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    coaching: 21,
    intensity: 1,
    seed: 'x',
  });
  assert.equal(result.overallAfter, result.overallBefore);
  assert.ok(result.reasons.some((reason) => reason.includes('potencial')));
});

test('un veterano pierde piernas y conserva la cabeza', () => {
  const veteran = player({ age: 34, overall: 78, potential: 78, id: 'veterano' });
  const result = developPlayer({
    player: veteran,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    seed: 'x',
  });

  const physical = result.changes.filter((change) => groupOf(change.attribute) === 'fisico');
  const mental = result.changes.filter((change) => groupOf(change.attribute) === 'mental');

  assert.ok(physical.length > 0, 'tendria que perder algo de fisico');
  assert.ok(
    physical.every((change) => change.to < change.from),
    'lo fisico solo puede bajar a esta edad',
  );

  const physicalLoss =
    physical.reduce((total, change) => total + (change.from - change.to), 0) /
    Math.max(1, physical.length);
  const mentalLoss =
    mental.reduce((total, change) => total + (change.from - change.to), 0) /
    Math.max(1, mental.length);
  assert.ok(
    physicalLoss > mentalLoss,
    `tendria que perder mas fisico (${physicalLoss.toFixed(1)}) que cabeza (${mentalLoss.toFixed(1)})`,
  );

  // Y la caida tiene que ser gradual: en tres temporadas sigue jugable.
  assert.ok(
    result.overallBefore - result.overallAfter <= 4,
    `perdio ${result.overallBefore - result.overallAfter} puntos en una temporada: demasiado`,
  );
});

test('el entrenador acelera y los minutos pesan mas que el entrenador', () => {
  const young = player({ age: 18, overall: 62, potential: 85, id: 'comparar' });
  const base = { player: young, weeks: SEASON_WEEKS, seed: 'igual' } as const;

  const playingWithCoach = developPlayer({ ...base, minutes: SEASON_MINUTES, coaching: 21 });
  const playingAlone = developPlayer({ ...base, minutes: SEASON_MINUTES, coaching: 0 });
  const benchedWithCoach = developPlayer({ ...base, minutes: 120, coaching: 21 });

  assert.ok(
    playingWithCoach.overallAfter > playingAlone.overallAfter,
    'el entrenador tiene que acelerar el desarrollo',
  );
  assert.ok(
    playingAlone.overallAfter > benchedWithCoach.overallAfter,
    'jugar sin entrenador tiene que desarrollar mas que no jugar con el mejor entrenador',
  );
});

test('el plan reparte en lugar de sumar', () => {
  const young = player({ age: 19, overall: 66, potential: 86, id: 'plan' });
  const physical = developPlayer({
    player: young,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    focus: 'fisico',
    seed: 'igual',
  });
  const technical = developPlayer({
    player: young,
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    focus: 'tecnica',
    seed: 'igual',
  });

  const gainOf = (result: typeof physical, group: 'fisico' | 'tecnico'): number =>
    result.changes
      .filter((change) => groupOf(change.attribute) === group)
      .reduce((total, change) => total + (change.to - change.from), 0);

  assert.ok(
    gainOf(physical, 'fisico') > gainOf(technical, 'fisico'),
    'el plan fisico tiene que dar mas fisico',
  );
  assert.ok(
    gainOf(technical, 'tecnico') > gainOf(physical, 'tecnico'),
    'el plan tecnico tiene que dar mas tecnica',
  );
});

test('los atributos de arquero solo se mueven en un arquero', () => {
  const striker = developPlayer({
    player: player({ age: 18, overall: 62, potential: 84, position: 'DC', id: 'nueve' }),
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    seed: 'x',
  });
  assert.equal(
    striker.changes.filter((change) => groupOf(change.attribute) === 'arquero').length,
    0,
    'un delantero no mejora los reflejos',
  );

  const keeper = developPlayer({
    player: player({ age: 18, overall: 62, potential: 84, position: 'POR', id: 'arquero' }),
    weeks: SEASON_WEEKS,
    minutes: SEASON_MINUTES,
    focus: 'arquero',
    seed: 'x',
  });
  assert.ok(
    keeper.changes.some((change) => groupOf(change.attribute) === 'arquero'),
    'un arquero si tiene que mejorar lo suyo',
  );
});

test('el desarrollo no muta al jugador ni depende del azar del momento', () => {
  const young = player({ age: 18, overall: 62, potential: 84, id: 'inmutable' });
  const before = { ...young.attributes };

  const first = developPlayer({ player: young, weeks: 10, minutes: 900, seed: 'fijo' });
  const second = developPlayer({ player: young, weeks: 10, minutes: 900, seed: 'fijo' });

  assert.deepEqual(young.attributes, before, 'developPlayer no puede mutar al jugador');
  assert.deepEqual(first.player.attributes, second.player.attributes, 'tiene que ser reproducible');
});

test('sin semanas no pasa nada', () => {
  const young = player({ age: 18, overall: 62, potential: 84 });
  const result = developPlayer({ player: young, weeks: 0, minutes: 0 });
  assert.equal(result.changes.length, 0);
  assert.equal(result.player, young);
});

// ============================================================
// El plantel
// ============================================================

test('developSquad informa solo a los que cambiaron de overall entero', () => {
  const squad = [
    player({ age: 18, overall: 62, potential: 86, id: 'crece' }),
    player({ age: 28, overall: 80, potential: 80, id: 'techo' }),
  ];

  const result = developSquad({
    players: squad,
    weeks: SEASON_WEEKS,
    minutes: { crece: SEASON_MINUTES, techo: SEASON_MINUTES },
    focusOf: () => 'general',
    coachingOf: () => 15,
    seed: 'x',
  });

  assert.equal(result.players.length, 2);
  assert.ok(result.moved.some((entry) => entry.playerId === 'crece'));
  assert.ok(
    !result.moved.some((entry) => entry.playerId === 'techo'),
    'el que no se movio no tiene que figurar',
  );
  assert.deepEqual(squad[0]?.attributes, squad[0]?.attributes, 'no muta la entrada');
});

test('los clubes sin cuerpo tecnico simulado desarrollan igual, pero mas lento', () => {
  // Si a los rivales les diera cero, sus juveniles no crecerian nunca y el
  // torneo se desbalancearia solo.
  assert.ok(BASELINE_COACHING > 0, 'los rivales tienen que desarrollar');
  assert.ok(
    BASELINE_COACHING < staffEffect('Entrenador defensivo', 3, 3).actual,
    'tener staff propio tiene que ser una ventaja',
  );
});

// ============================================================
// El plan de entrenamiento
// ============================================================

test('cada puesto tiene un entrenador y un plan por defecto', () => {
  const covered = new Set<string>();
  for (const position of POSITIONS) {
    const role = coachRoleFor(position);
    covered.add(role);
    assert.ok(TRAINING_FOCUSES.includes(defaultFocusFor(position)), `${position} sin plan valido`);
  }
  assert.equal(covered.size, 4, 'los cuatro entrenadores por linea tienen que cubrir todo');
  assert.equal(coachRoleFor('POR'), 'Entrenador de arqueros');
  assert.equal(coachRoleFor('DFC'), 'Entrenador defensivo');
  assert.equal(coachRoleFor('MC'), 'Entrenador de mediocampistas');
  assert.equal(coachRoleFor('DC'), 'Entrenador ofensivo');
});

test('el plan individual manda sobre el del equipo, y el del equipo sobre el del puesto', () => {
  assert.equal(focusFor(DEFAULT_TRAINING_PLAN, 'x', 'DC'), defaultFocusFor('DC'));

  const teamWide = { ...DEFAULT_TRAINING_PLAN, teamFocus: 'fisico' as TrainingFocus };
  assert.equal(focusFor(teamWide, 'x', 'DC'), 'fisico');

  const withOwn = { ...teamWide, individual: { x: 'mental' as TrainingFocus } };
  assert.equal(focusFor(withOwn, 'x', 'DC'), 'mental');
  assert.equal(focusFor(withOwn, 'otro', 'DC'), 'fisico');
  assert.equal(individualCount(withOwn), 1);
});

test('la intensidad tiene etiqueta para cualquier valor', () => {
  for (const value of [0, 0.25, 0.3, 0.6, 0.9, 1]) {
    assert.ok(intensityLabel(value).length > 3, `${value} sin etiqueta`);
  }
});

// ============================================================
// Inferiores y el informe del ojeador
// ============================================================

test('el informe del ojeador SIEMPRE contiene el potencial real', () => {
  // Es el contrato del informe: el ojeador nunca miente, solo es impreciso. Si
  // el real pudiera quedar afuera, el rango no querria decir nada.
  for (let truth = 40; truth <= 95; truth += 1) {
    for (const spread of [3, 4, 8, 11, 15, 22]) {
      const report = scoutPotential(truth, spread, `s${truth}-${spread}`);
      assert.ok(
        truth >= report.low && truth <= report.high,
        `potencial ${truth} con margen ${spread} quedo afuera de ${report.low}-${report.high}`,
      );
      assert.equal(report.width, report.high - report.low);
    }
  }
});

test('un mejor ojeador informa un rango mas angosto', () => {
  const widths = [1, 2, 3, 4, 5].map(
    (level) => scoutPotential(78, staffEffect('Ojeador juvenil', level as 1, 5).actual, 'igual').width,
  );
  for (let index = 1; index < widths.length; index += 1) {
    assert.ok(
      (widths[index] as number) <= (widths[index - 1] as number),
      `el nivel ${index + 1} informa mas ancho que el ${index}: ${widths.join(',')}`,
    );
  }
  assert.ok((widths[4] as number) < (widths[0] as number), 'cinco estrellas tiene que informar mejor que una');
});

test('el centro del rango no es el potencial real: con un rango ancho no se puede adivinar', () => {
  // Si el real estuviera siempre en el centro, promediar el rango daria la
  // verdad exacta y el ojeador no serviria para nada.
  let offCentre = 0;
  for (let index = 0; index < 60; index += 1) {
    const report = scoutPotential(75, 12, `centro-${index}`);
    if (estimatedPotential(report) !== 75) offCentre += 1;
  }
  assert.ok(offCentre > 20, `el centro coincidio con el real casi siempre (${60 - offCentre}/60)`);
});

test('la confianza del informe sale de su ancho', () => {
  assert.equal(confidenceOf(6), 'muy alta');
  assert.equal(confidenceOf(30), 'muy baja');
  assert.ok(confidenceOf(8) !== confidenceOf(25));
});

test('la academia decide cuantos juveniles salen y con que techo', () => {
  const shapes = [1, 2, 3, 4, 5].map((level) => intakeShape(level));
  for (let index = 1; index < shapes.length; index += 1) {
    assert.ok(
      (shapes[index]?.count ?? 0) >= (shapes[index - 1]?.count ?? 0),
      'una academia mejor no puede producir menos',
    );
    assert.ok(
      (shapes[index]?.potentialMean ?? 0) > (shapes[index - 1]?.potentialMean ?? 0),
      'una academia mejor tiene que producir techos mas altos',
    );
  }
});

test('la camada es determinista y mejora con la academia', () => {
  const poor = buildYouthSquad('club', 1, 'camada');
  const same = buildYouthSquad('club', 1, 'camada');
  const good = buildYouthSquad('club', 5, 'camada');

  assert.deepEqual(
    poor.map((entry) => [entry.player.id, entry.player.potential]),
    same.map((entry) => [entry.player.id, entry.player.potential]),
    'la misma academia tiene que dar la misma camada',
  );
  assert.ok(good.length > poor.length, 'una academia de cinco produce mas juveniles');

  // Y todos los juveniles tienen margen real: sin eso no habria nada que
  // desarrollar ni nada que estimar.
  for (const entry of [...poor, ...good]) {
    const current = overallForPosition(entry.player.attributes, entry.player.position);
    assert.ok(
      entry.player.potential > current,
      `${entry.player.name} no tiene margen: ${current} de ${entry.player.potential}`,
    );
    assert.ok(entry.player.age >= 15 && entry.player.age <= 19, 'un juvenil tiene entre 15 y 19');
  }
});

test('un juvenil sube desde los diecisiete y deja inferiores pasados los veinte', () => {
  const kid = { player: player({ age: 15, overall: 40 }), origin: '', yearsAtClub: 1 };
  const ready = { player: player({ age: MIN_PROMOTION_AGE, overall: 55 }), origin: '', yearsAtClub: 3 };
  const late = { player: player({ age: 21, overall: 66 }), origin: '', yearsAtClub: 5 };

  assert.equal(canPromote(kid), false);
  assert.equal(canPromote(ready), true);
  assert.equal(mustLeave(ready), false);
  assert.equal(mustLeave(late), true);
});

// ============================================================
// El guard de honestidad de la fase
// ============================================================

test('HONESTIDAD: la pantalla de inferiores no lee el potencial real', () => {
  // El potencial real viaja en `ScoutedYouth.player.potential` porque el juego
  // lo necesita para promover y desarrollar al jugador. La pantalla tiene que
  // mostrar SOLO el informe del ojeador.
  //
  // Esto se verifica leyendo el archivo porque no hay forma de expresarlo en el
  // sistema de tipos sin romper la promocion: el tipo tiene que llevar al
  // jugador entero. Un test que lee el fuente es feo, y es mejor que confiar en
  // que nadie lo toque.
  const source = readFileSync(
    new URL('../src/ui/pages/YouthPage.tsx', import.meta.url),
    'utf8',
  );

  const offenders = source
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((entry) => /\.player\.potential|\bpotential\b\s*[),}]/.test(entry.line))
    .filter((entry) => !entry.line.startsWith('*') && !entry.line.startsWith('//'));

  assert.deepEqual(
    offenders,
    [],
    `la pantalla de inferiores lee el potencial real: ${offenders.map((o) => `linea ${o.number}`).join(', ')}`,
  );

  // Y el componente del rango tampoco: solo recibe el informe.
  const range = readFileSync(
    new URL('../src/ui/components/youth/PotentialRange.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(!range.includes('.player'), 'PotentialRange no tiene que ver al jugador, solo el informe');
});
