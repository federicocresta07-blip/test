/**
 * CALENDARIO DEL TORNEO.
 *
 * Genera el fixture de todos contra todos con el metodo del circulo: un
 * equipo queda fijo y el resto rota, lo que garantiza que cada fecha tenga a
 * todos jugando y que nadie repita rival.
 *
 * Es determinista a proposito. Con la misma lista de clubes y la misma
 * semilla sale el mismo torneo, asi que un calendario guardado se puede
 * reconstruir sin guardarlo entero.
 */

import { Rng } from '../core/rng.ts';

export type SeasonFixture = {
  readonly id: string;
  /** Fecha del torneo, desde 1. */
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
};

/** Marca del club que descansa cuando la cantidad de equipos es impar. */
const BYE = '__libre__';

/**
 * Fixture de una sola vuelta.
 *
 * Con N clubes salen N-1 fechas de N/2 partidos. Si N es impar se agrega un
 * descanso, y en esa fecha un club queda libre.
 *
 * La localia alterna por fecha para que nadie juegue toda la temporada del
 * mismo lado: es lo que hace que la ventaja de localia (seccion 34) se
 * reparta parejo.
 */
export function buildRoundRobin(
  clubIds: readonly string[],
  seed: string | number = 'temporada',
): readonly SeasonFixture[] {
  if (clubIds.length < 2) return [];

  // El orden del sorteo cambia con la semilla; el metodo del circulo no.
  const rng = new Rng(seed);
  const drawn = [...clubIds];
  for (let index = drawn.length - 1; index > 0; index -= 1) {
    const swap = rng.int(index + 1);
    const current = drawn[index] as string;
    drawn[index] = drawn[swap] as string;
    drawn[swap] = current;
  }

  const teams = drawn.length % 2 === 0 ? drawn : [...drawn, BYE];
  const half = teams.length / 2;
  const rotating = teams.slice(1);

  // Primero los cruces, sin decidir quien es local.
  const pairs: { round: number; a: string; b: string }[] = [];
  for (let round = 0; round < teams.length - 1; round += 1) {
    const order = [teams[0] as string, ...rotating];
    for (let match = 0; match < half; match += 1) {
      const a = order[match] as string;
      const b = order[order.length - 1 - match] as string;
      if (a === BYE || b === BYE) continue;
      pairs.push({ round: round + 1, a, b });
    }
    rotating.unshift(rotating.pop() as string);
  }

  // Y despues la localia, equilibrandola.
  //
  // Alternarla por paridad de la fecha y de la posicion en la rueda —que es
  // lo primero que uno escribe— no funciona: el equipo que queda fijo en el
  // circulo siempre cae en la misma posicion, y termina con 16 partidos de
  // local de 19. Asignarla partido a partido al que viene mas necesitado deja
  // a todos en 9 o 10.
  const homeCount = new Map<string, number>(teams.map((team) => [team, 0]));
  const awayCount = new Map<string, number>(teams.map((team) => [team, 0]));
  const balance = (team: string): number => (homeCount.get(team) ?? 0) - (awayCount.get(team) ?? 0);

  // Primera pasada: la localia va al que viene mas necesitado. Cuando los dos
  // vienen igual hay que desempatar, y ahi esta el detalle: desempatar siempre
  // por el nombre le da la localia al primero del alfabeto en todas las fechas
  // iniciales. Se alterna por fecha para que el sesgo se cancele.
  const assigned = pairs.map(({ round, a, b }) => {
    const tieBreak = round % 2 === 0 ? a < b : b < a;
    const aIsHome = balance(a) === balance(b) ? tieBreak : balance(a) < balance(b);
    const home = aIsHome ? a : b;
    const away = aIsHome ? b : a;
    homeCount.set(home, (homeCount.get(home) ?? 0) + 1);
    awayCount.set(away, (awayCount.get(away) ?? 0) + 1);
    return { round, home, away };
  });

  // Segunda pasada: corregir lo que la primera no pudo.
  //
  // Ir partido a partido no alcanza para garantizar el reparto: con algunos
  // sorteos alguien queda con 8 de local sobre 19 y otro con 11. Aca se dan
  // vuelta los partidos que arreglan las dos puntas a la vez —el que tiene
  // demasiados de local visita al que tiene de menos—, hasta que nadie se
  // pasa de uno. Es determinista: mismo sorteo, misma correccion.
  const flip = (entry: { round: number; home: string; away: string }): void => {
    homeCount.set(entry.home, (homeCount.get(entry.home) ?? 0) - 1);
    awayCount.set(entry.away, (awayCount.get(entry.away) ?? 0) - 1);
    homeCount.set(entry.away, (homeCount.get(entry.away) ?? 0) + 1);
    awayCount.set(entry.home, (awayCount.get(entry.home) ?? 0) + 1);
    const previousHome = entry.home;
    entry.home = entry.away;
    entry.away = previousHome;
  };

  for (let pass = 0; pass < teams.length; pass += 1) {
    let changed = false;
    for (const entry of assigned) {
      // Dar vuelta este partido tiene que mejorar a los dos, no compensar a
      // uno rompiendo al otro.
      if (balance(entry.home) > 1 && balance(entry.away) < -1) {
        flip(entry);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return assigned.map(({ round, home, away }) => ({
    id: `f${round}-${home}-${away}`,
    round,
    homeClubId: home,
    awayClubId: away,
  }));
}

/** Los partidos de una fecha. */
export function fixturesOfRound(
  fixtures: readonly SeasonFixture[],
  round: number,
): readonly SeasonFixture[] {
  return fixtures.filter((fixture) => fixture.round === round);
}

/** El partido de un club en una fecha, si juega. */
export function fixtureOf(
  fixtures: readonly SeasonFixture[],
  round: number,
  clubId: string,
): SeasonFixture | undefined {
  return fixtures.find(
    (fixture) =>
      fixture.round === round &&
      (fixture.homeClubId === clubId || fixture.awayClubId === clubId),
  );
}

/** Todos los partidos de un club, en orden de fecha. */
export function fixturesOfClub(
  fixtures: readonly SeasonFixture[],
  clubId: string,
): readonly SeasonFixture[] {
  return fixtures
    .filter((fixture) => fixture.homeClubId === clubId || fixture.awayClubId === clubId)
    .slice()
    .sort((a, b) => a.round - b.round);
}

export function totalRounds(fixtures: readonly SeasonFixture[]): number {
  return fixtures.reduce((highest, fixture) => Math.max(highest, fixture.round), 0);
}
