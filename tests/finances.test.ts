/**
 * LAS FINANZAS DEL CLUB (secciones 9 y 12, fase 6).
 *
 * El test que mas importa de este archivo es el de HONESTIDAD: ninguna linea
 * del balance puede ser un numero sin explicacion. Antes de esta fase las
 * finanzas eran cinco constantes escritas a mano, y el juego mentia en las dos
 * direcciones: se ampliaba el estadio y el ingreso no se movia.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FINANCE_CONFIG,
  MATCHES_PER_MONTH,
  financeReport,
  sponsorIncome,
  televisionIncome,
  transferBudget,
  type FinanceInput,
} from '../src/domain/finances.ts';
import type { Stadium } from '../src/domain/stadium.ts';

const MONUMENTAL: Stadium = { name: 'Antonio Vespucio Liberti', capacity: 76_687, members: 63_000 };
const VICENTE_LOPEZ: Stadium = { name: 'Ciudad de Vicente López', capacity: 12_657, members: 7_500 };

/**
 * El fixture esta en LA ESCALA DEL MERCADO, que es la del juego.
 *
 * Son los numeros reales de River: 98 millones de sueldos del plantel, 22 del
 * cuerpo tecnico, 14,4 de mantenimiento y unos 17 millones por partido de
 * local. La primera version de este archivo usaba una escala de pesos de 1998
 * (sueldos de 3,9 millones, recaudacion de 9,4) y los tests pasaban midiendo
 * un club que no existe: con la television en 62 millones, un plantel de 3,9
 * era irrelevante y ninguna alerta podia dispararse.
 */
function input(over: Partial<FinanceInput> = {}): FinanceInput {
  return {
    stadium: MONUMENTAL,
    reputation: 95,
    position: 5,
    clubsInLeague: 20,
    playerWages: 98_300_000,
    staffWages: 22_350_000,
    facilityUpkeep: 14_400_000,
    stadiumUpkeep: 0,
    gateTotal: 67_200_000,
    homeMatchesPlayed: 4,
    openingCash: 418_500_000,
    capitalSpent: 0,
    capitalReceived: 0,
    homeMatchesLeft: 6,
    ...over,
  };
}

test('HONESTIDAD: ninguna linea del balance es un numero sin explicacion', () => {
  const report = financeReport(input());
  const lines = [...report.income, ...report.expenses];
  assert.ok(lines.length >= 8, 'el balance tiene que estar desglosado');
  for (const line of lines) {
    assert.ok(line.label.length > 0, `una linea sin nombre: ${line.id}`);
    assert.ok(
      line.source.length > 0,
      `la linea "${line.label}" no dice de donde sale su numero`,
    );
    assert.ok(Number.isFinite(line.monthly), `${line.label} no es un numero`);
  }
  // Los ingresos son positivos y los gastos negativos, sin excepciones: si un
  // gasto entrara con signo positivo, el balance saldria al revés.
  for (const line of report.income) assert.ok(line.monthly >= 0, `${line.label} es negativo`);
  for (const line of report.expenses) assert.ok(line.monthly <= 0, `${line.label} es positivo`);
});

test('el balance cierra con sus lineas', () => {
  const report = financeReport(input());
  const income = report.income.reduce((total, line) => total + line.monthly, 0);
  const expenses = -report.expenses.reduce((total, line) => total + line.monthly, 0);
  assert.ok(Math.abs(report.monthlyIncome - income) < 1);
  assert.ok(Math.abs(report.monthlyExpenses - expenses) < 1);
  assert.ok(Math.abs(report.balance - (income - expenses)) < 1);
});

test('LA MASA SALARIAL NO SE DECLARA: es la suma de los contratos', () => {
  const report = financeReport(input({ playerWages: 98_300_000, staffWages: 22_350_000 }));
  assert.equal(report.wageBill, 120_650_000);

  // Vender a medio plantel tiene que moverla. Antes de la fase 3 era una
  // constante y no se movia; este test impide que vuelva a pasar.
  const lighter = financeReport(input({ playerWages: 49_150_000, staffWages: 22_350_000 }));
  assert.ok(lighter.wageBill < report.wageBill);
  assert.ok(lighter.monthlyExpenses < report.monthlyExpenses);
  assert.ok(lighter.balance > report.balance);
});

test('la cuota social sale de los socios reales del archivo', () => {
  const big = financeReport(input({ stadium: MONUMENTAL }));
  const small = financeReport(input({ stadium: VICENTE_LOPEZ }));
  const line = (report: typeof big, id: string) =>
    report.income.find((entry) => entry.id === id)?.monthly ?? 0;

  assert.equal(line(big, 'cuota'), MONUMENTAL.members * DEFAULT_FINANCE_CONFIG.memberFee);
  assert.ok(line(big, 'cuota') > line(small, 'cuota') * 8, 'River tiene 63.000 socios y Platense 7.500');
});

test('la recaudacion del mes sale de los partidos jugados, no de una constante', () => {
  const played = financeReport(input({ gateTotal: 67_200_000, homeMatchesPlayed: 4 }));
  const gate = played.income.find((line) => line.id === 'recaudacion')?.monthly ?? 0;
  assert.equal(played.averageGate, 67_200_000 / 4);
  assert.equal(gate, played.averageGate * MATCHES_PER_MONTH);

  // Sin partidos de local todavia, la linea es cero y lo dice.
  const fresh = financeReport(input({ gateTotal: 0, homeMatchesPlayed: 0 }));
  const freshLine = fresh.income.find((line) => line.id === 'recaudacion');
  assert.equal(freshLine?.monthly, 0);
  assert.ok(freshLine?.source.includes('todavía'), 'tiene que explicar por que es cero');
});

test('la television tiene piso y premia al que mueve audiencia', () => {
  const top = televisionIncome(100);
  const bottom = televisionIncome(1);
  assert.ok(bottom >= DEFAULT_FINANCE_CONFIG.televisionFloor, 'hay un piso que cobran todos');
  assert.ok(top > bottom, 'el grande cobra mas');
  assert.equal(top, DEFAULT_FINANCE_CONFIG.televisionAtTop);

  // No es proporcional: el reparto premia al de arriba mas que linealmente,
  // asi que al club chico la television le pesa MAS en su presupuesto.
  const mid = televisionIncome(50);
  assert.ok(mid < (top + bottom) / 2, 'el reparto tiene que ser convexo');
});

test('el sponsor mira la reputacion y tambien como va el equipo', () => {
  const leader = sponsorIncome(80, 1, 20);
  const bottomTable = sponsorIncome(80, 20, 20);
  assert.ok(leader > bottomTable, 'salir campeon tiene que valer algo');

  const bigClub = sponsorIncome(95, 10, 20);
  const smallClub = sponsorIncome(50, 10, 20);
  assert.ok(bigClub > smallClub, 'la reputacion tambien pesa');

  // Pero la posicion no puede pesar mas que la reputacion: un club chico
  // puntero no factura como River.
  assert.ok(sponsorIncome(50, 1, 20) < sponsorIncome(95, 10, 20));
});

test('EL PRESUPUESTO DE FICHAJES SE DERIVA: no es un numero aparte', () => {
  const healthy = financeReport(input());
  assert.ok(healthy.transferBudget > 0);

  // Mas caja, mas presupuesto.
  const richer = financeReport(input({ openingCash: 900_000_000 }));
  assert.ok(richer.transferBudget > healthy.transferBudget);

  // Y una masa salarial que hunde el balance lo baja, aunque la caja sea la
  // misma: es lo que hace que firmar un contrato grande tenga consecuencia.
  const overpaying = financeReport(input({ playerWages: 200_000_000 }));
  assert.ok(
    overpaying.transferBudget < healthy.transferBudget,
    'un club en rojo tiene menos margen del que dice su caja',
  );
});

test('un club fundido no tiene presupuesto, y nunca es negativo', () => {
  const broke = financeReport(
    input({ openingCash: 0, playerWages: 400_000_000, gateTotal: 0, homeMatchesPlayed: 0 }),
  );
  assert.equal(broke.transferBudget, 0, 'no se puede fichar con la caja en cero');
  assert.ok(broke.balance < 0, 'y el balance tiene que mostrar el rojo');
  assert.equal(broke.cash, 0, 'la caja no baja de cero');

  // El colchon: con exactamente el colchon en caja y balance cero, el
  // presupuesto es cero. Es la regla que separa invertir de fundir al club.
  const expenses = 135_000_000;
  assert.equal(
    transferBudget(expenses * DEFAULT_FINANCE_CONFIG.reserveMonths, 0, expenses, 0),
    0,
  );
});

test('la caja se mueve con lo que entro y lo que se gasto', () => {
  const base = financeReport(input({ openingCash: 100_000_000, gateTotal: 50_000_000 }));
  assert.equal(base.cash, 150_000_000);

  const afterWork = financeReport(
    input({ openingCash: 100_000_000, gateTotal: 50_000_000, capitalSpent: 120_000_000 }),
  );
  assert.equal(afterWork.cash, 30_000_000, 'la obra pagada sale de la caja');

  const afterSale = financeReport(
    input({ openingCash: 100_000_000, gateTotal: 50_000_000, capitalReceived: 80_000_000 }),
  );
  assert.equal(afterSale.cash, 230_000_000, 'el traspaso cobrado entra a la caja');
});

test('ampliar el estadio aparece como gasto de mantenimiento', () => {
  const before = financeReport(input({ stadiumUpkeep: 0 }));
  const after = financeReport(input({ stadiumUpkeep: 45_000_000 }));
  const line = (report: typeof before) =>
    report.expenses.find((entry) => entry.id === 'estadio');

  assert.equal(line(before)?.monthly, 0);
  assert.ok(line(before)?.source.includes('sin ampliaciones'));
  assert.equal(line(after)?.monthly, -45_000_000);
  assert.ok(after.monthlyExpenses > before.monthlyExpenses, 'lo construido se mantiene');
});

test('la parte de los sueldos se mide contra lo que el club GANA', () => {
  // Contra los gastos el numero daba ~89% para cualquier club, porque el
  // mantenimiento es chico al lado de la masa salarial: la alerta quedaba
  // siempre encendida. Contra los ingresos dice algo.
  const sane = financeReport(input({ playerWages: 20_000_000 }));
  const reckless = financeReport(input({ playerWages: 300_000_000 }));
  assert.ok(sane.wageShare < reckless.wageShare);
  assert.ok(reckless.wageShare > 0.9, 'un plantel carisimo tiene que disparar la alerta');
  assert.ok(sane.wageShare > 0, 'y con un plantel barato no');
  assert.ok(sane.wageShare < 0.9);

  // Y llenar la cancha lo baja sin tocar un contrato: mas ingreso, misma masa.
  const withGate = financeReport(
    input({ playerWages: 300_000_000, gateTotal: 400_000_000, homeMatchesPlayed: 4 }),
  );
  assert.ok(withGate.wageShare < reckless.wageShare, 'recaudar mejora la proporcion');
});
