/**
 * EL ESTADIO Y LA RECAUDACION (seccion 9, fase 6).
 *
 * Lo que estos tests cuidan no es que los numeros sean los "correctos" —es un
 * modelo, no un dato— sino que el modelo tenga las propiedades que lo hacen
 * un juego: la capacidad es un techo duro, el precio tiene filo en las dos
 * direcciones, y un club chico no recauda como uno grande.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { APERTURA98_CLUBS } from '../src/data/apertura98.ts';
import {
  DEFAULT_STADIUM_CONFIG,
  EXPANSION_STEPS,
  MAX_TICKET_PRICE,
  MIN_TICKET_PRICE,
  REFERENCE_TICKET_PRICE,
  expansionCost,
  expansionUpkeep,
  expansionWeeks,
  expectedAttendance,
  matchRevenue,
  priceFactor,
  reputationFromStadium,
  type AttendanceInput,
  type Stadium,
} from '../src/domain/stadium.ts';

const MONUMENTAL: Stadium = { name: 'Antonio Vespucio Liberti', capacity: 76_687, members: 63_000 };
const VICENTE_LOPEZ: Stadium = { name: 'Ciudad de Vicente López', capacity: 12_657, members: 7_500 };

function input(stadium: Stadium, over: Partial<AttendanceInput> = {}): AttendanceInput {
  return {
    stadium,
    ticketPrice: REFERENCE_TICKET_PRICE,
    opponentReputation: 60,
    position: 8,
    clubsInLeague: 20,
    momentum: 0.5,
    importance: 0.5,
    ...over,
  };
}

test('la capacidad es un techo duro', () => {
  // Todo al maximo: el mejor rival, puntero, en racha, final, entrada regalada.
  const best = input(VICENTE_LOPEZ, {
    ticketPrice: MIN_TICKET_PRICE,
    opponentReputation: 100,
    position: 1,
    momentum: 1,
    importance: 1,
  });
  const attendance = expectedAttendance(best);
  assert.ok(
    attendance <= VICENTE_LOPEZ.capacity,
    `entraron ${attendance} en una cancha de ${VICENTE_LOPEZ.capacity}`,
  );
  // Y con todo a favor tiene que llenarse de verdad, no quedar a medias.
  assert.ok(attendance > VICENTE_LOPEZ.capacity * 0.8, `solo ${attendance}`);
});

test('los socios son el piso: un partido sin atractivo igual mete gente', () => {
  const worst = input(MONUMENTAL, {
    ticketPrice: MAX_TICKET_PRICE,
    opponentReputation: 1,
    position: 20,
    momentum: 0,
    importance: 0,
  });
  const attendance = expectedAttendance(worst);
  const floor = MONUMENTAL.members * DEFAULT_STADIUM_CONFIG.memberTurnout;
  assert.ok(attendance >= Math.floor(floor), `${attendance} por debajo del piso de socios`);
});

test('el precio tiene filo en las dos direcciones', () => {
  assert.ok(priceFactor(REFERENCE_TICKET_PRICE) > 0.99 && priceFactor(REFERENCE_TICKET_PRICE) < 1.01);
  assert.ok(priceFactor(MAX_TICKET_PRICE) < priceFactor(REFERENCE_TICKET_PRICE));
  assert.ok(priceFactor(MIN_TICKET_PRICE) > priceFactor(REFERENCE_TICKET_PRICE));

  // Fuera de rango no explota: se acota.
  assert.equal(priceFactor(9999), priceFactor(MAX_TICKET_PRICE));
  assert.equal(priceFactor(-5), priceFactor(MIN_TICKET_PRICE));
});

test('SUBIR EL PRECIO PUEDE RECAUDAR MENOS: la decision tiene consecuencia', () => {
  // Es la propiedad que hace que elegir el precio sea una decision y no un
  // deslizador que siempre conviene subir. En un club con poco margen de
  // publico no socio, cobrar la fortuna vacia la cancha.
  const cheap = matchRevenue(input(VICENTE_LOPEZ, { ticketPrice: 400 }));
  const dear = matchRevenue(input(VICENTE_LOPEZ, { ticketPrice: MAX_TICKET_PRICE }));

  assert.ok(dear.attendance < cheap.attendance, 'a mayor precio tiene que ir menos gente');

  // Y en algun punto del rango la curva tiene maximo interior: existe un
  // precio mejor que el minimo y que el maximo.
  // En la escala del juego, no en pesos de 1998: ver `domain/stadium.ts`.
  const prices = [120, 250, 400, 600, 850, 1_200, 1_600, 2_100, 2_600, 3_000];
  const totals = prices.map((price) => matchRevenue(input(VICENTE_LOPEZ, { ticketPrice: price })).total);
  const bestIndex = totals.indexOf(Math.max(...totals));
  assert.ok(
    bestIndex > 0 && bestIndex < prices.length - 1,
    `el mejor precio quedo en el borde (${prices[bestIndex]}): la curva no tiene filo`,
  );
});

test('el socio no paga entrada, y eso cambia la economia del club', () => {
  // River tiene 63.000 socios y Platense 7.500. El grande recauda mas en
  // total, pero vende MENOS entradas en proporcion: su ingreso es la cuota.
  const big = matchRevenue(input(MONUMENTAL));
  const small = matchRevenue(input(VICENTE_LOPEZ));

  assert.ok(big.total > small.total, 'el club grande recauda mas');
  assert.ok(
    big.ticketsSold / big.attendance < small.ticketsSold / small.attendance,
    'el club de muchos socios vende proporcionalmente menos entradas',
  );
  // La parte del visitante sale de las entradas, no de la cuota ni del consumo.
  assert.ok(Math.abs(big.awayCut - big.ticketIncome * DEFAULT_STADIUM_CONFIG.awayShare) < 1);
  assert.ok(
    Math.abs(big.total - (big.ticketIncome - big.awayCut + big.extrasIncome)) < 1,
    'el total tiene que cerrar con sus partes',
  );
});

test('la ocupacion es derivada y nunca pasa de 1', () => {
  for (const stadium of [MONUMENTAL, VICENTE_LOPEZ]) {
    for (const price of [MIN_TICKET_PRICE, REFERENCE_TICKET_PRICE, MAX_TICKET_PRICE]) {
      const revenue = matchRevenue(input(stadium, { ticketPrice: price, opponentReputation: 100, position: 1, momentum: 1, importance: 1 }));
      assert.ok(revenue.occupancy >= 0 && revenue.occupancy <= 1, `ocupacion ${revenue.occupancy}`);
      assert.equal(revenue.attendance, Math.round(revenue.occupancy * stadium.capacity));
    }
  }
});

test('un mejor rival y una mejor posicion meten gente', () => {
  const base = input(MONUMENTAL, { opponentReputation: 30, position: 18 });
  const better = expectedAttendance(input(MONUMENTAL, { opponentReputation: 95, position: 18 }));
  const higher = expectedAttendance(input(MONUMENTAL, { opponentReputation: 30, position: 1 }));
  assert.ok(better > expectedAttendance(base), 'un clasico mete gente');
  assert.ok(higher > expectedAttendance(base), 'pelear el campeonato mete gente');
});

test('LA REPUTACION SALE DEL ARCHIVO, no de una etiqueta puesta a mano', () => {
  // Los veinte clubes traen socios y aforo del PKF. La reputacion sale de ahi,
  // asi que el orden tiene que respetar lo que era cada club en 1998.
  const clubs = APERTURA98_CLUBS.filter((club) => club.capacity !== null && club.members !== null);
  assert.equal(clubs.length, 20, 'los veinte clubes tienen que traer estadio y socios');

  const reputation = new Map(
    clubs.map((club) => [
      club.id,
      reputationFromStadium({
        name: club.stadium ?? '',
        capacity: club.capacity as number,
        members: club.members as number,
      }),
    ]),
  );

  for (const value of reputation.values()) {
    assert.ok(value >= 1 && value <= 100, `reputacion fuera de escala: ${value}`);
  }

  // El orden general tiene que ser el que era: los grandes arriba, el que
  // tenia 2.500 socios abajo.
  const ranked = [...reputation.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  assert.equal(ranked[0], 'river', 'River es el techo del torneo en socios y aforo');
  assert.equal(ranked[ranked.length - 1], 'belgrano', 'Belgrano tenia 2.500 socios');
  const topFive = new Set(ranked.slice(0, 5));
  for (const big of ['river', 'independiente', 'boca', 'velez', 'racing']) {
    assert.ok(topFive.has(big), `${big} tendria que estar entre los cinco primeros`);
  }

  // Y la cancha grande y vacia NO hace grande a un club: Huracan tenia 48.314
  // de aforo con 9.800 socios, y Lanus 30.500 con 24.635. Esta es la
  // propiedad que justifica que los socios pesen mas que el aforo.
  assert.ok(
    (reputation.get('lanus') as number) > (reputation.get('huracan') as number),
    'los socios tienen que pesar mas que el aforo',
  );

  // Lo que el test NO afirma: un orden entre clubes que el archivo empata.
  // Platense (7.500 socios, 12.657 de aforo) y Union (5.200 y 22.300) dan
  // practicamente lo mismo, uno por socios y el otro por cancha. Inventar un
  // orden ahi seria afirmar ruido, asi que se exige que queden cerca.
  assert.ok(
    Math.abs((reputation.get('platense') as number) - (reputation.get('union') as number)) <= 4,
    'Platense y Union tendrian que quedar parejos',
  );
});

test('ampliar el estadio es caro, lento y tiene mantenimiento', () => {
  for (const seats of EXPANSION_STEPS) {
    assert.ok(expansionCost(seats, 30_000) > 0);
    assert.ok(expansionWeeks(seats) >= 4, 'ninguna obra es instantanea');
    assert.ok(expansionUpkeep(seats) > 0, 'lo que se construye se mantiene');
  }
  // Mas asientos cuestan mas y tardan mas.
  assert.ok(expansionCost(10_000, 30_000) > expansionCost(2_000, 30_000));
  assert.ok(expansionWeeks(10_000) > expansionWeeks(2_000));
  // Y ampliar una cancha ya grande cuesta mas por asiento.
  assert.ok(expansionCost(5_000, 76_687) > expansionCost(5_000, 12_657));
  // La obra mas grande no entra en una temporada de 19 fechas.
  assert.ok(expansionWeeks(10_000) > 19, 'la ampliacion grande tiene que cruzar temporadas');
});

test('el modelo es deterministico', () => {
  const a = matchRevenue(input(MONUMENTAL));
  const b = matchRevenue(input(MONUMENTAL));
  assert.deepEqual(b, a);
});
