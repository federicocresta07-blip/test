/**
 * Mercado: valuacion, informes y negociacion (fase 5).
 *
 * Dos invariantes gobiernan el archivo, y las dos nacieron de decisiones de
 * diseño explicitas:
 *
 * - EL VALOR SE CALCULA. Antes estaba escrito a mano en `data/squad.ts` y
 *   contradecia al mercado: un lateral de 80 figuraba en 6,8 M cuando el
 *   mercado lo tasa en 18.
 * - LA RESPUESTA A UNA OFERTA ES UNA CUENTA. Con la misma oferta y el mismo
 *   estado, el club vendedor responde siempre lo mismo.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appraise,
  autoTransferList,
  contractMultiplier,
  MAX_LISTED_PER_CLUB,
  negotiate,
  squadNeed,
  TRANSFER_LIST_NEED,
  valuePlayer,
} from '../src/domain/market.ts';
import { createPlayer, type Player } from '../src/domain/player.ts';
import type { Position } from '../src/domain/positions.ts';
import { attributesFor, buildSquad } from '../src/data/squad-builder.ts';
import { overallForPosition } from '../src/ratings/overall.ts';
import { staffEffect } from '../src/domain/staff.ts';
import {
  applyFilters,
  applyTransfers,
  EMPTY_FILTERS,
  marketPool,
  marketPrecision,
  sortPool,
} from '../src/ui/lib/market-bridge.ts';
import { leagueTeams, USER_CLUB_ID } from '../src/ui/data/league.ts';
import { DEMO_FACILITIES, DEMO_STAFF } from '../src/ui/data/club-development.ts';

function player(options: {
  age: number;
  overall: number;
  potential?: number;
  position?: Position;
  id?: string;
}): Player {
  const position = options.position ?? 'DC';
  return createPlayer({
    id: options.id ?? `m-${options.age}-${options.overall}-${position}`,
    name: 'Test',
    position,
    age: options.age,
    ...(options.potential !== undefined ? { potential: options.potential } : {}),
    attributes: attributesFor(position, options.overall),
  });
}

const value = (options: Parameters<typeof player>[0], months = 36): number =>
  valuePlayer({ player: player(options), contractMonths: months }).value;

// ============================================================
// Valuacion
// ============================================================

test('la calidad se paga cada vez mas caro', () => {
  // La diferencia entre un 70 y un 75 tiene que ser mucho mas chica que entre
  // un 85 y un 90: es asi en el mercado y es lo que hace caros los ultimos
  // puntos de calidad.
  const step70 = value({ age: 25, overall: 75 }) - value({ age: 25, overall: 70 });
  const step85 = value({ age: 25, overall: 90 }) - value({ age: 25, overall: 85 });
  assert.ok(step85 > step70 * 2, `paso 70-75: ${step70}, paso 85-90: ${step85}`);
});

test('el pico de valor llega antes que el pico de rendimiento', () => {
  const at24 = value({ age: 24, overall: 82 });
  const at28 = value({ age: 28, overall: 82 });
  const at33 = value({ age: 33, overall: 82 });
  assert.ok(at24 > at28, 'a los 24 tiene que valer mas que a los 28 con el mismo nivel');
  assert.ok(at28 > at33 * 2, 'a los 33 tiene que valer mucho menos');
});

test('el techo se paga, y mas en un jugador joven', () => {
  const youngWithRoom = value({ age: 19, overall: 70, potential: 88 });
  const youngCapped = value({ age: 19, overall: 70, potential: 70 });
  assert.ok(youngWithRoom > youngCapped * 1.4, 'el margen de crecimiento tiene que valer');

  // A los 29 el mismo margen se paga mucho menos: ya no hay tiempo.
  const oldWithRoom = value({ age: 29, overall: 70, potential: 88 });
  const oldCapped = value({ age: 29, overall: 70, potential: 70 });
  assert.ok(
    oldWithRoom / oldCapped < youngWithRoom / youngCapped,
    'el techo de un jugador grande tiene que valer proporcionalmente menos',
  );
});

test('un juvenil con techo puede valer mas que un titular que hoy juega mejor', () => {
  // Es la decision que hace interesante un mercado.
  const prospect = value({ age: 19, overall: 71, potential: 92, id: 'joya' });
  const veteran = value({ age: 31, overall: 80, potential: 80, id: 'veterano' });
  assert.ok(prospect > veteran, `joya ${prospect} vs veterano ${veteran}`);
});

test('el contrato que se termina destruye el valor', () => {
  const long = value({ age: 26, overall: 80 }, 36);
  const short = value({ age: 26, overall: 80 }, 6);
  const expired = value({ age: 26, overall: 80 }, 0);

  assert.ok(short < long * 0.5, 'a seis meses del final tiene que valer mucho menos');
  assert.ok(expired < short * 0.3, 'con el contrato vencido casi no vale nada');
  assert.equal(contractMultiplier(48), 1);
  assert.ok(contractMultiplier(6) < contractMultiplier(12));
});

test('el mercado paga distinto segun el puesto', () => {
  const striker = value({ age: 26, overall: 82, position: 'DC' });
  const keeper = value({ age: 26, overall: 82, position: 'POR' });
  assert.ok(striker > keeper * 1.4, 'un 9 tiene que valer mas que un arquero del mismo nivel');
});

test('el salario sigue al valor pero mucho mas plano', () => {
  const low = valuePlayer({ player: player({ age: 25, overall: 65 }), contractMonths: 36 });
  const high = valuePlayer({ player: player({ age: 25, overall: 88 }), contractMonths: 36 });

  assert.ok(high.wage > low.wage, 'el mejor tiene que cobrar mas');
  assert.ok(
    high.value / low.value > (high.wage / low.wage) * 3,
    'un jugador que vale diez veces mas no puede cobrar diez veces mas',
  );
  // Y el salario no depende del contrato: lo que cobra no cambia porque le
  // queden seis meses.
  const short = valuePlayer({ player: player({ age: 25, overall: 88 }), contractMonths: 6 });
  assert.equal(short.wage, high.wage);
});

// ============================================================
// El informe del ojeador
// ============================================================

test('el informe SIEMPRE contiene el nivel y el valor reales', () => {
  // Es el contrato del informe, igual que con los juveniles: el ojeador nunca
  // miente, solo es impreciso.
  for (const overall of [55, 65, 75, 85, 92]) {
    for (const margin of [0, 3, 6, 9, 14]) {
      const subject = player({ age: 25, overall, potential: overall + 8, id: `s${overall}-${margin}` });
      const truth = valuePlayer({ player: subject, contractMonths: 24 });
      const report = appraise({
        player: subject,
        contractMonths: 24,
        scoutMargin: margin,
        valuerError: margin * 2,
      });

      assert.ok(
        truth.overall >= report.overallLow && truth.overall <= report.overallHigh,
        `nivel ${truth.overall} fuera de ${report.overallLow}-${report.overallHigh}`,
      );
      assert.ok(
        truth.value >= report.valueLow && truth.value <= report.valueHigh,
        `valor ${truth.value} fuera de ${report.valueLow}-${report.valueHigh}`,
      );
      assert.ok(
        subject.potential >= report.potentialLow && subject.potential <= report.potentialHigh,
        `techo ${subject.potential} fuera de ${report.potentialLow}-${report.potentialHigh}`,
      );
    }
  }
});

test('el techo se estima con mas margen que el nivel', () => {
  // Ver jugar a alguien dice cuanto rinde hoy; adivinar su techo es mas
  // dificil, y el informe lo tiene que reflejar.
  const report = appraise({
    player: player({ age: 21, overall: 72, potential: 88, id: 'techo-margen' }),
    contractMonths: 24,
    scoutMargin: 5,
    valuerError: 8,
  });
  assert.ok(
    report.potentialHigh - report.potentialLow > report.overallHigh - report.overallLow,
    'el rango de techo tiene que ser mas ancho que el de nivel',
  );
});

test('un ojeador perfecto informa el numero exacto', () => {
  const subject = player({ age: 25, overall: 80, potential: 80, id: 'exacto' });
  const truth = valuePlayer({ player: subject, contractMonths: 24 });
  const report = appraise({ player: subject, contractMonths: 24, scoutMargin: 0, valuerError: 0 });

  assert.equal(report.overall, truth.overall);
  assert.equal(report.overallLow, truth.overall);
  assert.equal(report.overallHigh, truth.overall);
  assert.equal(report.value, truth.value);
});

test('mejor staff informa mejor', () => {
  const subject = player({ age: 24, overall: 80, potential: 88, id: 'objetivo' });
  const rough = appraise({
    player: subject,
    contractMonths: 24,
    scoutMargin: staffEffect('Ojeador', 1, 1).actual,
    valuerError: staffEffect('Secretario técnico', 1, 1).actual,
  });
  const sharp = appraise({
    player: subject,
    contractMonths: 24,
    scoutMargin: staffEffect('Ojeador', 5, 5).actual,
    valuerError: staffEffect('Secretario técnico', 5, 5).actual,
  });

  assert.ok(sharp.overallHigh - sharp.overallLow < rough.overallHigh - rough.overallLow);
  assert.ok(sharp.valueMargin < rough.valueMargin);
});

test('el informe es determinista: el mercado no se reordena al recargar', () => {
  const subject = player({ age: 24, overall: 80, id: 'estable' });
  const first = appraise({ player: subject, contractMonths: 24, scoutMargin: 6, valuerError: 10 });
  const second = appraise({ player: subject, contractMonths: 24, scoutMargin: 6, valuerError: 10 });
  assert.deepEqual(first, second);
});

// ============================================================
// Cuanto lo necesita su club
// ============================================================

test('la necesidad sale de la caida hasta el reemplazo, no del orden', () => {
  const starter = player({ age: 26, overall: 85, position: 'DC', id: 'titular' });
  const goodBackup = player({ age: 26, overall: 83, position: 'DC', id: 'buen-suplente' });
  const poorBackup = player({ age: 26, overall: 68, position: 'DC', id: 'mal-suplente' });

  const withGood = squadNeed(starter, [starter, goodBackup]);
  const withPoor = squadNeed(starter, [starter, poorBackup]);

  assert.ok(
    withPoor > withGood,
    `con suplente flojo (${withPoor.toFixed(2)}) tiene que necesitarlo mas que con uno bueno (${withGood.toFixed(2)})`,
  );

  // En los dos casos es "el mejor de su puesto": el orden no alcanza para
  // distinguirlos, y por eso el modelo mira la caida.
  assert.notEqual(withGood, withPoor);
});

test('sin reemplazo el club lo necesita del todo, y con alguien mejor casi nada', () => {
  const only = player({ age: 26, overall: 75, position: 'POR', id: 'unico' });
  assert.equal(squadNeed(only, [only]), 1);

  const worse = player({ age: 26, overall: 70, position: 'DC', id: 'peor' });
  const better = player({ age: 26, overall: 86, position: 'DC', id: 'mejor' });
  assert.ok(squadNeed(worse, [worse, better]) < 0.3);
});

test('un suplente polivalente cuenta como reemplazo', () => {
  const starter = player({ age: 26, overall: 80, position: 'LD', id: 'lateral' });
  const versatile = createPlayer({
    id: 'polivalente',
    name: 'Polivalente',
    position: 'DFC',
    age: 26,
    attributes: attributesFor('DFC', 79),
    secondaryPositions: ['LD'],
  });

  assert.equal(squadNeed(starter, [starter]), 1);
  assert.ok(squadNeed(starter, [starter, versatile]) < 1, 'el polivalente tiene que contar');
});

test('cada club publica pocos, y a los mejores de los que le sobran', () => {
  const squad = buildSquad({ target: 78, prefix: 'lista', seed: 'lista' });
  const listed = autoTransferList(squad);

  assert.ok(listed.length <= MAX_LISTED_PER_CLUB, `publico ${listed.length}`);
  for (const entry of listed) {
    assert.ok(
      squadNeed(entry, squad) <= TRANSFER_LIST_NEED,
      `${entry.name} esta publicado pero el club lo necesita`,
    );
  }

  // El orden es: primero los que menos extranaria, y entre los que empatan en
  // necesidad, el mejor — es el que alguien le va a comprar. No es "los tres
  // mejores del excedente": un club prefiere soltar al que menos le importa,
  // aunque valga menos.
  const surplus = squad
    .map((entry) => ({ entry, need: squadNeed(entry, squad) }))
    .filter((row) => row.need <= TRANSFER_LIST_NEED);

  const lowestNeed = Math.min(...surplus.map((row) => row.need));
  const tied = surplus.filter((row) => Math.abs(row.need - lowestNeed) < 0.001);
  if (tied.length > listed.length) {
    const worstListed = Math.min(
      ...listed.map((entry) => overallForPosition(entry.attributes, entry.position)),
    );
    const bestExcluded = Math.max(
      ...tied
        .filter((row) => !listed.includes(row.entry))
        .map((row) => overallForPosition(row.entry.attributes, row.entry.position)),
    );
    assert.ok(
      worstListed >= bestExcluded - 0.01,
      'entre los que empatan en necesidad tiene que publicar a los mejores',
    );
  }
});

// ============================================================
// Negociacion
// ============================================================

const seller = buildSquad({ target: 78, prefix: 'vende', seed: 'vende' });
const wanted = seller[10] as Player;

function offer(amount: number, listed = false): ReturnType<typeof negotiate> {
  return negotiate({
    player: wanted,
    contractMonths: 24,
    amount,
    need: squadNeed(wanted, seller),
    listed,
  });
}

test('la respuesta escala con el monto: rechaza, contraoferta, acepta', () => {
  const asking = offer(0).asking;

  assert.equal(offer(Math.round(asking * 0.5)).verdict, 'rechazada');
  assert.equal(offer(Math.round(asking * 0.9)).verdict, 'contraoferta');
  assert.equal(offer(asking).verdict, 'aceptada');
  assert.equal(offer(Math.round(asking * 1.5)).verdict, 'aceptada');
});

test('la respuesta es una cuenta, no un sorteo', () => {
  const amount = Math.round(offer(0).asking * 0.9);
  const first = offer(amount);
  const second = offer(amount);
  assert.deepEqual(first, second, 'la misma oferta tiene que dar siempre la misma respuesta');
});

test('por un jugador que necesita pide mas que por uno que le sobra', () => {
  const needed = negotiate({
    player: wanted,
    contractMonths: 24,
    amount: 0,
    need: 1,
  });
  const spare = negotiate({
    player: wanted,
    contractMonths: 24,
    amount: 0,
    need: 0.05,
  });

  assert.ok(needed.asking > spare.asking * 1.3, `pide ${needed.asking} vs ${spare.asking}`);
  assert.match(needed.reason, /venta|acerca|recambio/i);
});

test('un jugador publicado se vende por debajo de su valor', () => {
  const market = valuePlayer({ player: wanted, contractMonths: 24 }).value;
  const listedAsking = offer(0, true).asking;

  assert.ok(listedAsking < market, 'si lo publicaron, lo dejan ir por menos que su valor');
  // Se ofrece justo lo que piden y no el 90% exacto: `asking` se redondea a
  // decenas de mil, asi que el 90% clavado puede caer un peso por debajo.
  assert.equal(offer(listedAsking, true).verdict, 'aceptada');

  // Y piden menos por un publicado que por el mismo jugador sin publicar.
  assert.ok(listedAsking < offer(0, false).asking);
});

test('el contraofertado siempre esta por encima del minimo y explica el numero', () => {
  const result = offer(Math.round(offer(0).asking * 0.9));
  assert.equal(result.verdict, 'contraoferta');
  assert.ok(result.counter !== null);
  assert.ok((result.counter as number) > result.minimum);
  assert.ok(result.reason.includes('$'), 'la contraoferta tiene que decir el numero');
});

// ============================================================
// El pool del mercado
// ============================================================

test('el pool trae a todos los jugadores de los otros clubes y a ninguno propio', () => {
  const precision = marketPrecision(DEMO_STAFF, DEMO_FACILITIES);
  const pool = marketPool({ precision, transferredIds: [], listedIds: [] });

  const teams = leagueTeams();
  let expected = 0;
  for (const [clubId, team] of teams) {
    if (clubId !== USER_CLUB_ID) expected += team.players.length;
  }

  assert.equal(pool.length, expected);
  assert.ok(!pool.some((entry) => entry.clubId === USER_CLUB_ID), 'no puede haber jugadores propios');
});

test('un jugador ya traspasado sale del pool', () => {
  const precision = marketPrecision(DEMO_STAFF, DEMO_FACILITIES);
  const pool = marketPool({ precision, transferredIds: [], listedIds: [] });
  const victim = pool[0] as (typeof pool)[number];
  const after = marketPool({ precision, transferredIds: [victim.id], listedIds: [] });

  assert.equal(after.length, pool.length - 1);
  assert.ok(!after.some((entry) => entry.id === victim.id));
});

test('sin ojeador ni secretario tecnico, el club mira a ciegas', () => {
  const blind = marketPrecision(
    DEMO_STAFF.filter(
      (member) => member.role !== 'Ojeador' && member.role !== 'Secretario técnico',
    ),
    DEMO_FACILITIES,
  );
  const equipped = marketPrecision(DEMO_STAFF, DEMO_FACILITIES);

  assert.equal(blind.hasScout, false);
  assert.equal(blind.hasValuer, false);
  assert.equal(blind.missing.length, 2, 'tiene que decir las dos cosas que faltan');
  assert.ok(blind.scoutMargin > equipped.scoutMargin * 2);
  assert.ok(blind.valuerError > equipped.valuerError * 2);
  assert.equal(equipped.missing.length, 0);
});

test('el filtro de nivel trabaja sobre el informado, no sobre el real', () => {
  const precision = marketPrecision(DEMO_STAFF, DEMO_FACILITIES);
  const pool = marketPool({ precision, transferredIds: [], listedIds: [] });
  const filtered = applyFilters(pool, { ...EMPTY_FILTERS, minOverall: 80 });

  assert.ok(filtered.length > 0);
  for (const entry of filtered) {
    assert.ok(entry.appraisal.overall >= 80, `${entry.name} entro con ${entry.appraisal.overall}`);
  }

  // Y puede dejar afuera a alguien que de verdad es mejor: el club no lo sabe.
  const hidden = pool.filter(
    (entry) =>
      entry.appraisal.overall < 80 &&
      overallForPosition(entry.player.attributes, entry.player.position) >= 80,
  );
  assert.ok(hidden.length > 0, 'con margen de error tiene que haber jugadores subestimados');
});

test('los filtros y el orden funcionan juntos', () => {
  const precision = marketPrecision(DEMO_STAFF, DEMO_FACILITIES);
  const pool = marketPool({ precision, transferredIds: [], listedIds: [] });

  const young = applyFilters(pool, { ...EMPTY_FILTERS, maxAge: 22, positions: ['DC'] });
  for (const entry of young) {
    assert.ok(entry.age <= 22);
    assert.equal(entry.position, 'DC');
  }

  const byValue = sortPool(pool, 'valor');
  for (let index = 1; index < Math.min(20, byValue.length); index += 1) {
    assert.ok(
      (byValue[index - 1] as (typeof byValue)[number]).appraisal.value >=
        (byValue[index] as (typeof byValue)[number]).appraisal.value,
    );
  }

  const byName = sortPool(pool, 'nombre');
  assert.ok((byName[0] as (typeof byName)[number]).name <= (byName[1] as (typeof byName)[number]).name);
});

// ============================================================
// Traspasos
// ============================================================

test('un traspaso mueve al jugador de un plantel al otro', () => {
  const teams = leagueTeams();
  const boca = teams.get('boca') as NonNullable<ReturnType<typeof teams.get>>;
  const target = boca.players[5] as Player;
  const sizeBefore = boca.players.length;
  const userBefore = (teams.get(USER_CLUB_ID) as NonNullable<ReturnType<typeof teams.get>>).players.length;

  const after = applyTransfers(teams, [
    { playerId: target.id, fromClubId: 'boca', toClubId: USER_CLUB_ID },
  ]);

  const bocaAfter = after.get('boca') as NonNullable<ReturnType<typeof teams.get>>;
  const userAfter = after.get(USER_CLUB_ID) as NonNullable<ReturnType<typeof teams.get>>;

  assert.equal(bocaAfter.players.length, sizeBefore - 1);
  assert.equal(userAfter.players.length, userBefore + 1);
  assert.ok(!bocaAfter.players.some((entry) => entry.id === target.id));
  assert.ok(userAfter.players.some((entry) => entry.id === target.id));

  // Y no muta el mapa de entrada.
  assert.equal((teams.get('boca') as NonNullable<ReturnType<typeof teams.get>>).players.length, sizeBefore);
});

test('un traspaso repetido no duplica al jugador', () => {
  const teams = leagueTeams();
  const target = (teams.get('boca') as NonNullable<ReturnType<typeof teams.get>>).players[3] as Player;
  const move = { playerId: target.id, fromClubId: 'boca', toClubId: USER_CLUB_ID };

  const after = applyTransfers(teams, [move, move]);
  const userAfter = after.get(USER_CLUB_ID) as NonNullable<ReturnType<typeof teams.get>>;
  assert.equal(userAfter.players.filter((entry) => entry.id === target.id).length, 1);
});

test('sin traspasos el mapa vuelve tal cual', () => {
  const teams = leagueTeams();
  assert.equal(applyTransfers(teams, []), teams);
});
