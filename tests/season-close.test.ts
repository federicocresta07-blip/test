/**
 * EL CIERRE DE TEMPORADA (seccion 19, fase 6).
 *
 * Estos tests existen por una razon concreta: `ageUp` estaba en el motor desde
 * la fase 4 y NADIE LO LLAMABA. El juego dejaba empezar un torneo nuevo y
 * nadie cumplia un anio. El primer test de este archivo es el que hubiera
 * detectado eso.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayer, type Player } from '../src/domain/player.ts';
import { YOUTH_MAX_AGE, type YouthPlayer } from '../src/domain/youth.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';
import { APERTURA98_CLUBS, apertura98Squad } from '../src/data/apertura98.ts';
import { playerFromApertura98 } from '../src/data/pcf-bridge.ts';
import {
  DEFAULT_RETIREMENT_CONFIG,
  RETIREMENT_FORCED_AGE,
  RETIREMENT_MIN_AGE,
  closeSeason,
  retirementChance,
} from '../src/progression/season-close.ts';
import { overallForPosition } from '../src/ratings/overall.ts';
import { developPlayer } from '../src/progression/development.ts';
import { buildYouthSquad } from '../src/ui/data/youth.ts';

function youth(age: number, id = `juv-${age}`): YouthPlayer {
  return {
    player: createPlayer({ id, name: `Juvenil ${age}`, position: 'MC', age, attributes: attributesFor('MC', 55) }),
    origin: 'de la séptima del club',
    yearsAtClub: 2,
  };
}

function squad(): readonly Player[] {
  return buildSquad({ target: 78, prefix: 'EQ', seed: 'cierre' });
}

test('TODOS CUMPLEN UN ANIO: es la deuda que esta fase paga', () => {
  const before = squad();
  const result = closeSeason({ players: before, youth: [], intake: [], seed: 'a' });

  // Los que siguen tienen exactamente un anio mas que antes.
  for (const player of result.players) {
    const previous = before.find((entry) => entry.id === player.id);
    assert.ok(previous, `${player.name} aparecio de la nada`);
    assert.equal(player.age, previous.age + 1, `${player.name} no cumplio anios`);
  }
  // Y los que se retiraron tambien envejecieron: se retiran a la edad que
  // cumplen, no a la que tenian.
  for (const entry of result.retired) {
    const previous = before.find((player) => player.id === entry.player.id);
    assert.equal(entry.player.age, (previous as Player).age + 1);
  }
  assert.equal(result.players.length + result.retired.length, before.length);
});

test('nadie se retira antes de los 33 y todos se retiran a los 40', () => {
  const young = createPlayer({ id: 'j', name: 'Joven', position: 'MC', age: 24, attributes: attributesFor('MC', 78) });
  assert.equal(retirementChance(young, 78), 0);

  const onTheEdge = createPlayer({ id: 'e', name: 'Justo', position: 'MC', age: RETIREMENT_MIN_AGE - 1, attributes: attributesFor('MC', 70) });
  assert.equal(retirementChance(onTheEdge, 78), 0);

  const ancient = createPlayer({ id: 'v', name: 'Eterno', position: 'MC', age: RETIREMENT_FORCED_AGE, attributes: attributesFor('MC', 92) });
  assert.equal(retirementChance(ancient, 60), 1, 'a los 40 se retira aunque sea el mejor');
});

test('el que todavia rinde estira la carrera', () => {
  const age = 36;
  const star = createPlayer({ id: 's', name: 'Crack', position: 'MC', age, attributes: attributesFor('MC', 88) });
  const spent = createPlayer({ id: 'x', name: 'Gastado', position: 'MC', age, attributes: attributesFor('MC', 62) });

  const squadAverage = 75;
  const starChance = retirementChance(star, squadAverage);
  const spentChance = retirementChance(spent, squadAverage);

  assert.ok(starChance < spentChance, 'el que sigue siendo titular se retira menos');
  assert.ok(starChance > 0, 'pero tampoco es inmortal');
  // La proteccion esta acotada: no puede anular la edad.
  assert.ok(starChance >= spentChance * (1 - DEFAULT_RETIREMENT_CONFIG.formProtection) - 1e-9);
});

test('la probabilidad crece con la edad', () => {
  const chances = [33, 35, 37, 39].map((age) =>
    retirementChance(
      createPlayer({ id: 'p', name: 'P', position: 'MC', age, attributes: attributesFor('MC', 70) }),
      75,
    ),
  );
  for (let i = 1; i < chances.length; i += 1) {
    assert.ok((chances[i] as number) > (chances[i - 1] as number), `${chances}`);
  }
});

test('en una temporada se retira alguien, pero no medio plantel', () => {
  // Medido sobre LOS VEINTE PLANTELES REALES del Apertura 98, que es la data
  // con la que se juega. Es la unica calibracion que significa algo: sus 462
  // jugadores tienen 24,1 anios de media y solo el 6,3% tiene 32 o mas.
  //
  // El primer intento de este test usaba un plantel de `buildSquad`, que
  // reparte las edades uniformemente entre 20 y 34 y por eso deja un tercio
  // del plantel arriba de 32. Con eso se retiraban siete de una vez y parecia
  // un problema del modelo: era un plantel que no existe.
  const squads = APERTURA98_CLUBS.map((club) =>
    apertura98Squad(club.id).map((raw) => playerFromApertura98(raw, club.id)),
  );

  let totalRetired = 0;
  let closes = 0;
  let worst = 0;
  for (const [index, players] of squads.entries()) {
    for (let season = 0; season < 5; season += 1) {
      const result = closeSeason({ players, youth: [], intake: [], seed: `c-${index}-${season}` });
      totalRetired += result.retired.length;
      worst = Math.max(worst, result.retired.length);
      closes += 1;
      assert.equal(result.players.length + result.retired.length, players.length);
    }
  }

  const average = totalRetired / closes;
  assert.ok(totalRetired > 0, 'en cien cierres tendria que retirarse alguien');
  assert.ok(average < 2, `promedio de ${average.toFixed(2)} retiros por temporada: demasiado`);
  assert.ok(worst <= 4, `un cierre retiro ${worst} jugadores de una vez`);
});

test('a los juveniles se les termina el tiempo, y es consecuencia de no subirlos', () => {
  const kids = [16, 18, YOUTH_MAX_AGE, YOUTH_MAX_AGE + 1].map((age) => youth(age));
  const result = closeSeason({ players: [], youth: kids, intake: [], seed: 'juv' });

  // El que ya estaba por encima de la edad y el que la cruza al cumplir.
  assert.equal(result.released.length, 2, `se fueron ${result.released.length}`);
  for (const entry of result.released) {
    assert.ok(entry.player.age > YOUTH_MAX_AGE, `${entry.player.name} se fue con ${entry.player.age}`);
  }
  for (const entry of result.youth) {
    assert.ok(entry.player.age <= YOUTH_MAX_AGE, 'no puede quedarse nadie pasado de edad');
  }
  // Los que se quedan cumplieron anios y sumaron un anio en el club.
  const stayed = result.youth.find((entry) => entry.player.id === 'juv-16');
  assert.equal(stayed?.player.age, 17);
  assert.equal(stayed?.yearsAtClub, 3);
});

test('entra la camada nueva de la academia', () => {
  const intake = [youth(15, 'nuevo-1'), youth(16, 'nuevo-2')];
  const result = closeSeason({ players: [], youth: [youth(17)], intake, seed: 'camada' });

  assert.equal(result.youth.length, 3, 'el que se queda mas los dos nuevos');
  for (const nuevo of intake) {
    assert.ok(
      result.youth.some((entry) => entry.player.id === nuevo.player.id),
      `${nuevo.player.name} no entro`,
    );
  }
  // La camada entra SIN envejecer: son los que llegan este anio.
  const fresh = result.youth.find((entry) => entry.player.id === 'nuevo-1');
  assert.equal(fresh?.player.age, 15);
});

test('el cierre es deterministico', () => {
  const players = squad();
  const kids = [youth(17), youth(19)];
  const a = closeSeason({ players, youth: kids, intake: [youth(15, 'n')], seed: 'igual' });
  const b = closeSeason({ players, youth: kids, intake: [youth(15, 'n')], seed: 'igual' });

  assert.deepEqual(
    b.retired.map((entry) => entry.player.id),
    a.retired.map((entry) => entry.player.id),
  );
  assert.deepEqual(b.players.map((p) => p.age), a.players.map((p) => p.age));

  // Con otra semilla puede dar distinto: el azar existe, pero con semilla.
  const different = closeSeason({ players, youth: kids, intake: [], seed: 'otra' });
  assert.equal(different.players.length + different.retired.length, players.length);
});

test('el retiro trae un motivo listo para la bandeja', () => {
  const old = createPlayer({ id: 'o', name: 'Ultimo Partido', position: 'DFC', age: RETIREMENT_FORCED_AGE - 1, attributes: attributesFor('DFC', 60) });
  const result = closeSeason({ players: [old], youth: [], intake: [], seed: 'aviso' });
  assert.equal(result.retired.length, 1, 'a los 39 y sin rendir se tiene que retirar');
  assert.match(result.retired[0]?.reason ?? '', /se retira a los 40/);
});

test('el cierre no cambia los atributos: solo pasa el tiempo', () => {
  // El desarrollo es de `developPlayer`, que corre fecha a fecha. El cierre no
  // es otra oportunidad de crecer: tener dos lugares que muevan atributos
  // seria tener dos fuentes de verdad.
  const before = squad();
  const result = closeSeason({ players: before, youth: [], intake: [], seed: 'atributos' });
  for (const player of result.players) {
    const previous = before.find((entry) => entry.id === player.id) as Player;
    assert.deepEqual(player.attributes, previous.attributes);
    assert.equal(
      overallForPosition(player.attributes, player.position),
      overallForPosition(previous.attributes, previous.position),
    );
  }
});

test('SEIS TEMPORADAS SEGUIDAS: el plantel envejece y hay que renovarlo', () => {
  // Es la prueba de que la fase 6 paga su deuda. Con `ageUp` sin llamar, este
  // test daba la misma edad media seis veces y el mismo plantel: un manager
  // sin paso del tiempo no tiene carrera, y las inferiores, el scouting y el
  // mercado eran adornos porque nunca hacia falta reemplazar a nadie.
  let players = APERTURA98_CLUBS.flatMap((club) =>
    club.id === 'river' ? apertura98Squad(club.id).map((raw) => playerFromApertura98(raw, club.id)) : [],
  );
  let kids: readonly YouthPlayer[] = [youth(16, 'a'), youth(17, 'b'), youth(18, 'c')];

  const startAge = average(players.map((player) => player.age));
  const startSize = players.length;
  let totalRetired = 0;

  for (let season = 1; season <= 6; season += 1) {
    const intake = [youth(15, `n${season}-1`), youth(16, `n${season}-2`)];
    const result = closeSeason({ players, youth: kids, intake, seed: `s${season}` });
    players = [...result.players];
    kids = result.youth;
    totalRetired += result.retired.length;

    // Ningun juvenil puede quedarse pasado de edad, ninguna temporada.
    for (const entry of kids) {
      assert.ok(entry.player.age <= YOUTH_MAX_AGE, `${entry.player.name} con ${entry.player.age}`);
    }
  }

  const endAge = average(players.map((player) => player.age));
  assert.ok(
    endAge > startAge + 3,
    `en seis temporadas la edad media tendria que subir: ${startAge.toFixed(1)} -> ${endAge.toFixed(1)}`,
  );
  assert.ok(totalRetired > 0, 'en seis temporadas se tiene que retirar alguien');
  assert.ok(
    players.length < startSize,
    `el plantel tendria que achicarse y obligar a renovarlo: ${startSize} -> ${players.length}`,
  );
  // Pero no desaparecer: seis temporadas no pueden dejar al club sin equipo.
  assert.ok(players.length > startSize * 0.6, `quedaron solo ${players.length}`);
});

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

test('LOS JUVENILES SE DESARROLLAN, y respetan su techo', () => {
  // El `Entrenador juvenil` declara en `staff.ts` que su efecto se consume en
  // el "desarrollo de los atributos de sus jugadores". Hasta la fase 6 eso era
  // falso: la camada se regeneraba identica en cada carga, ningun juvenil
  // mejoraba nunca y el rol no movia nada. El cierre de temporada lo dejo a la
  // vista, porque ahora un pibe se queda hasta cinco anios en inferiores.
  const cohort = buildYouthSquad('river', 2, 'camada-0', 0);
  assert.ok(cohort.length > 0);

  for (const entry of cohort) {
    const start = overallForPosition(entry.player.attributes, entry.player.position);
    assert.ok(start < entry.player.potential, 'un juvenil arranca lejos de su techo');

    // Cuatro temporadas en inferiores, aplicadas de a una.
    let player = entry.player;
    for (let year = 0; year < 4; year += 1) {
      player = developPlayer({
        player,
        weeks: 22,
        minutes: 1_100,
        focus: 'general',
        intensity: 0.65,
        coaching: 15,
        seed: `inferiores:${entry.player.id}:${year}`,
      }).player;
    }
    const end = overallForPosition(player.attributes, player.position);

    assert.ok(end > start + 4, `${entry.player.name} no crecio: ${start} -> ${end}`);
    // Y NO PASA SU TECHO. Este es el test que encontro el bug: pedirle al
    // motor cuatro temporadas de una sola vez crece como si el margen del
    // primer dia durara los cuatro anios, y un juvenil de potencial 66
    // terminaba en 74. El margen se mide por llamada, asi que hay que
    // aplicarlo anio por anio.
    assert.ok(
      end <= entry.player.potential + 1,
      `${entry.player.name} paso su techo: ${end} con potencial ${entry.player.potential}`,
    );
  }
});
