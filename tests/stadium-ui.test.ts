/**
 * EL ESTADIO Y LAS FINANZAS EN LA INTERFAZ (fase 6).
 *
 * Lo que estos tests cuidan es lo que la fase 6 vino a arreglar: que las
 * finanzas dejen de ser constantes escritas a mano y se muevan con el club.
 * El test mas importante es el de HONESTIDAD: ninguna linea del balance puede
 * ser un numero sin explicacion, porque es lo unico que impide que vuelvan.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_FACILITIES, DEMO_STAFF, OPENING_CASH } from '../src/ui/data/club-development.ts';
import { DEMO_SQUAD, USER_CLUB, withMarketValues } from '../src/ui/data/squad.ts';
import { LEAGUE_CLUB_IDS, leagueTeams } from '../src/ui/data/league.ts';
import {
  financesOf,
  gateFor,
  momentumFrom,
  originalCapacity,
  reputationOf,
  stadiumOf,
} from '../src/ui/lib/stadium-bridge.ts';
import { apertura98Club } from '../src/data/apertura98.ts';
import { REFERENCE_TICKET_PRICE } from '../src/domain/stadium.ts';
import { facilityUpkeep } from '../src/domain/facilities.ts';
import { staffSalary } from '../src/domain/staff.ts';
import type { GateRecord } from '../src/ui/services/season-store.ts';

const CLUBS = LEAGUE_CLUB_IDS.length;

/**
 * El plantel COMO LO VE EL JUEGO.
 *
 * `DEMO_SQUAD` trae los sueldos en cero a proposito: el valor y el salario los
 * pone el mercado, y el servicio los completa con `withMarketValues` antes de
 * que la interfaz los vea. Usar `DEMO_SQUAD` crudo en un test de finanzas
 * mide un plantel que no existe, con masa salarial cero.
 */
const SQUAD = withMarketValues(DEMO_SQUAD, '1998-09-13');

function baseInput(over: Partial<Parameters<typeof financesOf>[0]> = {}) {
  return {
    clubId: USER_CLUB,
    builtSeats: 0,
    squad: SQUAD,
    staff: DEMO_STAFF,
    facilities: DEMO_FACILITIES,
    position: 7,
    clubsInLeague: CLUBS,
    gates: [] as readonly GateRecord[],
    openingCash: OPENING_CASH,
    capitalSpent: 0,
    capitalReceived: 0,
    homeMatchesLeft: 9,
    ...over,
  };
}

test('EL ESTADIO DEL CLUB ES DATO REAL, del archivo del juego', () => {
  const club = apertura98Club(USER_CLUB);
  const stadium = stadiumOf(USER_CLUB);

  assert.equal(stadium.capacity, club.capacity);
  assert.equal(stadium.members, club.members);
  assert.equal(stadium.name, club.stadium);
  // River en 1998: 76.687 de aforo y 63.000 socios.
  assert.equal(stadium.capacity, 76_687);
  assert.equal(stadium.members, 63_000);
});

test('LA AMPLIACION NO PISA EL DATO ORIGINAL', () => {
  // El aforo del archivo es dato historico y tiene que seguir siendo
  // consultable: la capacidad de juego es la suma, no un reemplazo.
  const original = originalCapacity(USER_CLUB);
  const expanded = stadiumOf(USER_CLUB, 5_000);
  assert.equal(expanded.capacity, original + 5_000);
  assert.equal(originalCapacity(USER_CLUB), original, 'el dato del archivo no se toca');
});

test('HONESTIDAD: ninguna linea del balance de la interfaz es un numero sin explicacion', () => {
  const report = financesOf(baseInput());
  const lines = [...report.income, ...report.expenses];
  assert.ok(lines.length >= 8);
  for (const line of lines) {
    assert.ok(line.source.trim().length > 0, `"${line.label}" no dice de donde sale`);
  }
});

test('LA MASA SALARIAL SALE DEL PLANTEL REAL, no de una constante', () => {
  const report = financesOf(baseInput());
  const players = SQUAD.reduce((total, entry) => total + entry.salary, 0);
  const staff = DEMO_STAFF.reduce(
    (total, member) => total + staffSalary(member.role, member.level),
    0,
  );
  assert.equal(report.wageBill, players + staff);
  assert.ok(players > 0, 'el plantel real tiene contratos');

  // Y si se va la mitad del plantel, la masa salarial baja. Este es el test
  // que hubiera detectado el bug viejo: antes era un numero fijo y se podia
  // vender a medio equipo sin que se moviera.
  const half = financesOf(baseInput({ squad: SQUAD.slice(0, Math.floor(SQUAD.length / 2)) }));
  assert.ok(half.wageBill < report.wageBill);
});

test('el mantenimiento sale del nivel de cada instalacion', () => {
  const report = financesOf(baseInput());
  const expected = DEMO_FACILITIES.reduce(
    (total, facility) => total + facilityUpkeep(facility.id, facility.level),
    0,
  );
  const line = report.expenses.find((entry) => entry.id === 'instalaciones');
  assert.equal(line?.monthly, -expected);

  // Subir una instalacion sube el gasto.
  const better = financesOf(
    baseInput({
      facilities: DEMO_FACILITIES.map((facility) =>
        facility.id === 'entrenamiento' ? { ...facility, level: 5 as const } : facility,
      ),
    }),
  );
  assert.ok(better.monthlyExpenses > report.monthlyExpenses);
});

test('LA RECAUDACION ENTRA A LA CAJA', () => {
  const dry = financesOf(baseInput());
  assert.equal(dry.cash, OPENING_CASH);

  const gates: readonly GateRecord[] = [
    { round: 1, opponentId: 'boca', attendance: 60_000, ticketPrice: 600, total: 18_900_000 },
    { round: 3, opponentId: 'racing', attendance: 48_000, ticketPrice: 600, total: 14_100_000 },
  ];
  const played = financesOf(baseInput({ gates }));
  assert.equal(played.cash, OPENING_CASH + 33_000_000);
  assert.equal(played.averageGate, 16_500_000);
  assert.ok(played.monthlyIncome > dry.monthlyIncome, 'la recaudacion suma al ingreso mensual');
});

test('la obra pagada sale de la caja y el traspaso cobrado entra', () => {
  const spent = financesOf(baseInput({ capitalSpent: 50_000_000 }));
  assert.equal(spent.cash, OPENING_CASH - 50_000_000);
  const received = financesOf(baseInput({ capitalReceived: 30_000_000 }));
  assert.equal(received.cash, OPENING_CASH + 30_000_000);
});

test('EL PRESUPUESTO DE FICHAJES SE MUEVE CON EL CLUB', () => {
  // Con fechas de local jugadas, que es cuando el club tiene margen: sin
  // recaudacion el presupuesto de River es cero y entonces no se puede medir
  // si sube o baja. Que arranque en cero es correcto —el colchon de tres
  // meses de gastos se come la caja— pero para medir movimiento hace falta
  // un club con aire.
  const gates: readonly GateRecord[] = [1, 3, 5, 7].map((round) => ({
    round,
    opponentId: 'racing',
    attendance: 55_000,
    ticketPrice: 600,
    total: 16_800_000,
  }));
  const base = financesOf(baseInput({ gates, homeMatchesLeft: 5 }));
  assert.ok(base.transferBudget > 0, 'un River que recauda tiene con que fichar');

  const richer = financesOf(baseInput({ gates, homeMatchesLeft: 5, capitalReceived: 200_000_000 }));
  assert.ok(richer.transferBudget > base.transferBudget, 'vender sube el presupuesto');

  const heavier = financesOf(
    baseInput({
      gates,
      homeMatchesLeft: 5,
      squad: SQUAD.map((entry) => ({ ...entry, salary: entry.salary * 2 })),
    }),
  );
  assert.ok(
    heavier.transferBudget < base.transferBudget,
    'una masa salarial que hunde el balance baja el presupuesto',
  );
});

test('UNA SOLA FORMULA DE REPUTACION para todo el juego', () => {
  // Habia dos: una con logaritmos en `ui/data/league.ts` para la presion del
  // partido y otra en el dominio para la television y el sponsor. Daban el
  // mismo ORDEN pero valores distintos, y eran dos fuentes de verdad. Este
  // test fija que la del equipo del motor sea exactamente la del dominio.
  const teams = leagueTeams();
  for (const clubId of LEAGUE_CLUB_IDS) {
    const team = teams.get(clubId);
    if (!team) continue;
    assert.equal(
      team.reputation,
      reputationOf(clubId),
      `${clubId} tiene dos reputaciones distintas`,
    );
  }
});

test('la recaudacion responde al rival, a la racha y al precio', () => {
  const common = {
    clubId: USER_CLUB,
    builtSeats: 0,
    position: 7,
    clubsInLeague: CLUBS,
    importance: 0.5,
  };
  const vsBig = gateFor({ ...common, ticketPrice: REFERENCE_TICKET_PRICE, opponentId: 'boca', form: ['V', 'V', 'V'] });
  const vsSmall = gateFor({ ...common, ticketPrice: REFERENCE_TICKET_PRICE, opponentId: 'belgrano', form: ['V', 'V', 'V'] });
  assert.ok(vsBig.attendance > vsSmall.attendance, 'contra Boca va mas gente que contra Belgrano');

  const winning = gateFor({ ...common, ticketPrice: REFERENCE_TICKET_PRICE, opponentId: 'racing', form: ['V', 'V', 'V', 'V', 'V'] });
  const losing = gateFor({ ...common, ticketPrice: REFERENCE_TICKET_PRICE, opponentId: 'racing', form: ['D', 'D', 'D', 'D', 'D'] });
  assert.ok(winning.attendance > losing.attendance, 'la racha se nota en la puerta');

  const dear = gateFor({ ...common, ticketPrice: 2_800, opponentId: 'racing', form: ['V', 'E', 'D'] });
  const cheap = gateFor({ ...common, ticketPrice: 150, opponentId: 'racing', form: ['V', 'E', 'D'] });
  assert.ok(cheap.attendance > dear.attendance, 'la entrada cara vacia la cancha');
});

test('el momento del equipo sale de sus ultimos resultados', () => {
  assert.equal(momentumFrom([]), 0.5, 'sin partidos, neutro');
  assert.equal(momentumFrom(['V', 'V', 'V', 'V']), 1);
  assert.equal(momentumFrom(['D', 'D', 'D', 'D']), 0);
  assert.equal(momentumFrom(['V', 'D']), 0.5);
  assert.equal(momentumFrom(['E', 'E']), 0.5);
});

test('la ampliacion sube la recaudacion, pero no de un dia para el otro', () => {
  const common = {
    clubId: 'platense',
    ticketPrice: REFERENCE_TICKET_PRICE,
    opponentId: 'river',
    position: 3,
    clubsInLeague: CLUBS,
    form: ['V', 'V', 'V', 'V'] as const,
    importance: 0.9,
  };
  // Platense llena sus 12.657: es el club mas chico del torneo y el que mas
  // gana ampliando.
  const before = gateFor({ ...common, builtSeats: 0 });
  const after = gateFor({ ...common, builtSeats: 10_000 });
  // Al precio de referencia la cancha queda cerca de llena pero no agotada:
  // para agotarla hay que bajar la entrada, que es exactamente el filo que
  // tiene que tener la decision del precio.
  assert.ok(before.occupancy > 0.85, `la cancha tendria que estar casi llena: ${before.occupancy}`);
  const cheaper = gateFor({ ...common, builtSeats: 0, ticketPrice: 200 });
  assert.ok(cheaper.occupancy > 0.97, `con la entrada barata se agota: ${cheaper.occupancy}`);
  assert.ok(after.attendance > before.attendance, 'con mas asientos entra mas gente');
  assert.ok(after.total > before.total, 'y se recauda mas');

  // Y el mantenimiento nuevo aparece en el balance.
  const expanded = financesOf(baseInput({ builtSeats: 10_000 }));
  const plain = financesOf(baseInput({ builtSeats: 0 }));
  assert.ok(expanded.monthlyExpenses > plain.monthlyExpenses, 'lo construido se mantiene');
});

test('LAS DOS ESCALAS DE PLATA DEL JUEGO SON LA MISMA', () => {
  // EL BUG QUE ESTE TEST IMPIDE. La primera version de la fase 6 uso precios
  // de 1998 —entrada a 25 pesos, cuota de 12— mientras el mercado de la fase 5
  // ya valuaba a Aimar en 111 millones con un sueldo de 4,6 por mes. El
  // resultado: la recaudacion de un partido daba 700 mil contra una masa
  // salarial de 120 millones, el club quedaba fundido por un factor de treinta
  // y el presupuesto de fichajes era cero para siempre.
  //
  // Ninguno de los dos modelos estaba mal por dentro; estaban en escalas
  // distintas. Este test verifica la relacion entre las dos, que es lo unico
  // que importa: un club grande que llena su cancha tiene que poder pagar su
  // plantel.
  const gates: readonly GateRecord[] = [1, 3, 5, 7].map((round) => ({
    round,
    opponentId: 'racing',
    attendance: 55_000,
    ticketPrice: REFERENCE_TICKET_PRICE,
    total: gateFor({
      clubId: USER_CLUB,
      builtSeats: 0,
      ticketPrice: REFERENCE_TICKET_PRICE,
      opponentId: 'racing',
      position: 4,
      clubsInLeague: CLUBS,
      form: ['V', 'V', 'E'],
      importance: 0.5,
    }).total,
  }));
  const report = financesOf(baseInput({ gates, position: 4, homeMatchesLeft: 5 }));

  assert.ok(
    report.monthlyIncome > report.wageBill,
    `River gana ${Math.round(report.monthlyIncome / 1e6)}M y paga ${Math.round(report.wageBill / 1e6)}M de sueldos: ` +
      'las escalas del mercado y del estadio se separaron',
  );
  assert.ok(report.balance > 0, 'un club grande que llena la cancha tiene que cerrar en positivo');

  // Y tampoco al revés: si la recaudacion fuese enorme al lado de los sueldos,
  // el mercado dejaria de tener consecuencia y fichar seria gratis.
  assert.ok(
    report.monthlyIncome < report.wageBill * 4,
    'los ingresos no pueden empequenecer a la masa salarial: el mercado tiene que doler',
  );
});
