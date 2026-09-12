/**
 * VALUACION Y NEGOCIACION (secciones 10, 11 — fase 5 del plan).
 *
 * Dos reglas ordenan todo el modulo.
 *
 * 1. EL VALOR SE CALCULA, NO SE DECLARA. Sale del nivel del jugador, su edad,
 *    su margen de crecimiento, su contrato y su puesto. Por eso un pibe de 19
 *    con techo alto puede valer mas que un titular de 31 que hoy juega mejor
 *    que el, que es la decision que hace interesante un mercado.
 *
 * 2. LA RESPUESTA A UNA OFERTA ES UNA CUENTA, NO UN SORTEO. El club vendedor
 *    valua al jugador, mira cuanto lo necesita y compara. Con la misma oferta
 *    y el mismo estado, responde siempre lo mismo. Nada de
 *    `random(acepta)`: esa es la regla del motor y vale igual aca.
 *
 * Lo que SI tiene azar acotado es el informe del ojeador: no la decision, sino
 * cuanto se sabe antes de decidir.
 */

import { clamp } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import { maxHeadroomForAge, type Player } from './player.ts';
import type { Position } from './positions.ts';
import { overallForPosition } from '../ratings/overall.ts';

// ============================================================
// Valuacion
// ============================================================

/**
 * Cuanto pesa el overall en el valor.
 *
 * La curva es exponencial a proposito: la diferencia entre un 70 y un 75 es
 * chica, y entre un 85 y un 90 es enorme. Es asi en el mercado real, y es lo
 * que hace que los ultimos puntos de calidad se paguen caros.
 */
function qualityValue(overall: number): number {
  // Calibrado contra el presupuesto del club: con unos 140 M de presupuesto de
  // fichajes se compra UN jugador que mueva el equipo, no tres. La escala que
  // sale de aca, antes de los multiplicadores de edad y puesto:
  //   overall 60 -> ~2 M      overall 80 -> ~24 M
  //   overall 70 -> ~9 M      overall 85 -> ~42 M
  //   overall 90 -> ~66 M     overall 95 -> ~97 M
  const normalized = clamp(overall - 45, 0, 55) / 55;
  return 700_000 + Math.pow(normalized, 3.4) * 130_000_000;
}

/**
 * Cuanto multiplica o divide la edad.
 *
 * El pico de valor esta antes del pico de rendimiento: a los 24 un jugador ya
 * juega bien y le quedan siete anios buenos, asi que vale mas que el mismo
 * jugador a los 29.
 */
function ageMultiplier(age: number): number {
  if (age <= 18) return 1.3;
  if (age <= 21) return 1.35;
  if (age <= 24) return 1.3;
  if (age <= 27) return 1.1;
  if (age <= 29) return 0.85;
  if (age <= 31) return 0.6;
  if (age <= 33) return 0.38;
  if (age <= 35) return 0.2;
  return 0.1;
}

/**
 * Lo que suma el margen de crecimiento.
 *
 * Se paga el techo, no solo lo que el jugador rinde hoy. Un juvenil con veinte
 * puntos de margen vale bastante mas que uno del mismo nivel sin margen, y esa
 * diferencia es la que el ojeador te ayuda a ver.
 */
function potentialBonus(overall: number, potential: number, age: number): number {
  const room = Math.max(0, potential - overall);
  if (room <= 0) return 0;
  // Cuanto mas joven, mas probable que llegue a su techo, asi que mas se paga.
  const credibility = age <= 21 ? 1 : age <= 24 ? 0.7 : age <= 27 ? 0.35 : 0.1;
  return qualityValue(potential) * 0.45 * credibility * clamp(room / 20, 0, 1);
}

/**
 * Cuanto descuenta un contrato que se termina.
 *
 * A seis meses del final, el club vendedor tiene poco poder: o vende barato o
 * lo pierde gratis. Es lo que convierte la gestion de contratos en una
 * decision y no en un dato de la ficha.
 */
export function contractMultiplier(monthsRemaining: number): number {
  if (monthsRemaining <= 0) return 0.05;
  if (monthsRemaining <= 6) return 0.4;
  if (monthsRemaining <= 12) return 0.7;
  if (monthsRemaining <= 24) return 0.92;
  return 1;
}

/** Puestos que el mercado paga por encima o por debajo de su nivel. */
const POSITION_PREMIUM: Readonly<Record<Position, number>> = {
  POR: 0.72,
  LD: 0.92,
  DFC: 0.95,
  LI: 0.92,
  MCD: 0.95,
  MC: 1.0,
  MCO: 1.12,
  ED: 1.08,
  EI: 1.08,
  SD: 1.1,
  DC: 1.2,
};

export type ValuationInput = {
  readonly player: Player;
  /** Meses que le quedan de contrato. */
  readonly contractMonths: number;
};

export type Valuation = {
  /** Valor de mercado en pesos. */
  readonly value: number;
  /** Salario mensual que pide, en pesos. */
  readonly wage: number;
  readonly overall: number;
  /** Como se compone, para poder explicarlo en pantalla. */
  readonly breakdown: {
    readonly quality: number;
    readonly potential: number;
    readonly ageMultiplier: number;
    readonly contractMultiplier: number;
    readonly positionPremium: number;
  };
};

/**
 * El valor de mercado REAL de un jugador.
 *
 * Es la verdad que el juego conoce. Lo que el club ve de un jugador ajeno es
 * `appraise`, que le mete el error del secretario tecnico.
 */
export function valuePlayer(input: ValuationInput): Valuation {
  const { player, contractMonths } = input;
  const overall = overallForPosition(player.attributes, player.position);

  const quality = qualityValue(overall);
  const potential = potentialBonus(overall, player.potential, player.age);
  const age = ageMultiplier(player.age);
  const contract = contractMultiplier(contractMonths);
  const premium = POSITION_PREMIUM[player.position];

  const value = Math.round(((quality + potential) * age * contract * premium) / 10_000) * 10_000;

  // El salario sigue al valor, pero mucho mas plano: un jugador que vale diez
  // veces mas no cobra diez veces mas.
  const wage =
    Math.round((450_000 + Math.pow(clamp(overall - 45, 0, 55) / 55, 1.9) * 7_600_000) / 10_000) *
    10_000;

  return {
    value: Math.max(80_000, value),
    wage,
    overall: Math.round(overall),
    breakdown: {
      quality: Math.round(quality),
      potential: Math.round(potential),
      ageMultiplier: age,
      contractMultiplier: contract,
      positionPremium: premium,
    },
  };
}

// ============================================================
// El informe del ojeador sobre un jugador ajeno
// ============================================================

/**
 * Lo que el club VE de un jugador de otro club.
 *
 * Del propio plantel se sabe todo: se entrena con el todos los dias. De uno
 * ajeno se sabe lo que informa el ojeador, y su margen de error sale del
 * efecto del rol (seccion 7). Mismo patron que las inferiores, y por el mismo
 * motivo: sin esto, el ojeador no tendria para que existir.
 */
export type PlayerAppraisal = {
  /** Overall informado, con el error del ojeador encima. */
  readonly overall: number;
  /** Margen del informe, en puntos. */
  readonly overallMargin: number;
  readonly overallLow: number;
  readonly overallHigh: number;
  /** Rango de potencial informado. */
  readonly potentialLow: number;
  readonly potentialHigh: number;
  /** Valor de mercado informado, con el error del secretario tecnico. */
  readonly value: number;
  /** Margen del valor, como fraccion (0,07 = 7%). */
  readonly valueMargin: number;
  readonly valueLow: number;
  readonly valueHigh: number;
  /** Salario que se estima que pide. */
  readonly wage: number;
  /** El club no tiene ojeador: el informe es de oido. */
  readonly blind: boolean;
};

export type AppraisalInput = {
  readonly player: Player;
  readonly contractMonths: number;
  /**
   * Margen del ojeador en puntos de overall (seccion 7).
   * Sale de `staffEffect('Ojeador', ...).actual`.
   */
  readonly scoutMargin: number;
  /**
   * Error del secretario tecnico sobre el valor, en porcentaje.
   * Sale de `staffEffect('Secretario técnico', ...).actual`.
   */
  readonly valuerError: number;
  readonly blind?: boolean;
};

/**
 * Tasa a un jugador ajeno con la precision que el club tiene.
 *
 * Igual que con los juveniles, el valor real SIEMPRE cae dentro del rango
 * informado, y el informado no esta en el centro: con un margen ancho, el
 * numero que se muestra no sirve para decidir solo.
 */
export function appraise(input: AppraisalInput): PlayerAppraisal {
  const truth = valuePlayer({ player: input.player, contractMonths: input.contractMonths });
  const rng = new Rng(`tasacion:${input.player.id}`);

  // --- Overall ---
  const overallMargin = Math.max(0, Math.round(input.scoutMargin));
  const overallOffset = overallMargin === 0 ? 0 : Math.round(rng.intBetween(-overallMargin, overallMargin) / 2);
  const reportedOverall = clamp(truth.overall + overallOffset, 1, 100);
  const overallLow = Math.min(Math.round(clamp(reportedOverall - overallMargin, 1, 100)), truth.overall);
  const overallHigh = Math.max(Math.round(clamp(reportedOverall + overallMargin, 1, 100)), truth.overall);

  // --- Potencial: se estima con el doble de margen que el overall ---
  //
  // Ver jugar a alguien dice cuanto rinde hoy; adivinar su techo es mucho mas
  // dificil, y por eso el rango es mas ancho.
  //
  // Pero hay un limite que el ojeador SI conoce: la edad. Un jugador de 33
  // anios no tiene techo 100, y la primera version informaba "78-100" para uno
  // de 33 porque el margen se aplicaba a ciegas. El techo informado no puede
  // pasarse de lo que la edad permite crecer.
  const ageCeiling = clamp(truth.overall + maxHeadroomForAge(input.player.age), 1, 100);
  const potentialMargin = Math.max(2, overallMargin * 2);
  const potentialOffset = Math.round(rng.intBetween(-potentialMargin, potentialMargin) / 2);
  const reportedPotential = clamp(input.player.potential + potentialOffset, 1, ageCeiling);

  // El limite de edad recorta el borde de arriba, pero el rango NO se angosta
  // por eso: la banda se CORRE hacia abajo en vez de recortarse. Recortarla
  // hacia que un pibe con el techo justo en el maximo de su edad pareciera
  // mejor medido que los demas, cuando la incertidumbre del ojeador es la
  // misma. Lo unico que cambia es hacia donde puede equivocarse.
  const overflow = Math.max(0, reportedPotential + potentialMargin - ageCeiling);
  const potentialLow = Math.min(
    Math.max(1, Math.round(reportedPotential - potentialMargin - overflow)),
    input.player.potential,
  );
  const potentialHigh = Math.max(
    Math.round(reportedPotential + potentialMargin - overflow),
    input.player.potential,
  );

  // --- Valor ---
  const valueMargin = Math.max(0, input.valuerError) / 100;
  const valueOffset = valueMargin === 0 ? 0 : (rng.next() - 0.5) * valueMargin;
  const reportedValue = Math.round((truth.value * (1 + valueOffset)) / 10_000) * 10_000;
  const valueLow = Math.min(Math.round(reportedValue * (1 - valueMargin)), truth.value);
  const valueHigh = Math.max(Math.round(reportedValue * (1 + valueMargin)), truth.value);

  return {
    overall: reportedOverall,
    overallMargin,
    overallLow,
    overallHigh,
    potentialLow,
    potentialHigh,
    value: reportedValue,
    valueMargin,
    valueLow,
    valueHigh,
    wage: truth.wage,
    blind: input.blind ?? false,
  };
}

// ============================================================
// Negociacion
// ============================================================

export type OfferVerdict = 'aceptada' | 'contraoferta' | 'rechazada';

export type NegotiationInput = {
  /** El jugador por el que se ofrece. */
  readonly player: Player;
  readonly contractMonths: number;
  readonly amount: number;
  /**
   * Cuanto lo necesita el club vendedor, 0..1.
   *
   * 1 = es su mejor jugador en un puesto sin recambio. 0 = le sobra. Lo
   * calcula `squadNeed`, no se declara a mano.
   */
  readonly need: number;
  /** El jugador esta en la lista de transferibles del club vendedor. */
  readonly listed?: boolean;
};

export type NegotiationResult = {
  readonly verdict: OfferVerdict;
  /** Lo que pide el club vendedor. Presente cuando contraoferta. */
  readonly counter: number | null;
  /** El precio por debajo del cual no escucha. */
  readonly minimum: number;
  /** Lo que aceptaria sin discutir. */
  readonly asking: number;
  /** Por que respondio asi, en palabras del club vendedor. */
  readonly reason: string;
};

/**
 * Que responde el club vendedor a una oferta.
 *
 * Es una cuenta. El precio que pide sale del valor del jugador multiplicado
 * por cuanto lo necesita: por un titular indiscutido pide bastante mas que su
 * valor, y por alguien que puso en la lista de transferibles acepta el valor o
 * menos.
 */
export function negotiate(input: NegotiationInput): NegotiationResult {
  const valuation = valuePlayer({ player: input.player, contractMonths: input.contractMonths });
  const listed = input.listed ?? false;

  // Cuanto pide por encima del valor. Un club no vende a su mejor jugador al
  // precio de mercado: pide una prima por el problema que le genera.
  const premium = listed ? 0.9 : 1 + input.need * 0.65;
  const asking = Math.round((valuation.value * premium) / 10_000) * 10_000;
  // Por debajo del minimo ni contesta con un numero: rechaza.
  const minimum = Math.round(asking * 0.82);

  if (input.amount >= asking) {
    return {
      verdict: 'aceptada',
      counter: null,
      minimum,
      asking,
      reason: listed
        ? 'Lo pusimos en la lista de transferibles: por ese número lo dejamos ir.'
        : input.need > 0.6
          ? 'Nos duele soltarlo, pero por ese número no podemos decir que no.'
          : 'Nos cierra. Trato hecho.',
    };
  }

  if (input.amount >= minimum) {
    return {
      verdict: 'contraoferta',
      counter: asking,
      minimum,
      asking,
      reason:
        input.need > 0.6
          ? `Es titular y no tenemos recambio en ese puesto. Por menos de ${formatShort(asking)} no lo movemos.`
          : `Está cerca. Cerramos en ${formatShort(asking)}.`,
    };
  }

  return {
    verdict: 'rechazada',
    counter: null,
    minimum,
    asking,
    reason:
      input.need > 0.6
        ? 'No está en venta. Es una pieza del equipo y esa oferta no se acerca.'
        : `Esa oferta está lejos: no lo soltamos por menos de ${formatShort(minimum)}.`,
  };
}

/** Plata en formato corto, para los mensajes del club vendedor. */
function formatShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1).replace('.', ',')} M`;
  return `$${Math.round(value / 1_000)} k`;
}

/**
 * Cuanto necesita un club a un jugador, 0..1.
 *
 * La pregunta correcta no es "es el mejor de su puesto" sino CUANTO PERDERIA
 * EL CLUB SI LO VENDE, y eso es la caida hasta su reemplazo. Un 9 de 85 con un
 * suplente de 83 es reemplazable; el mismo 9 con un suplente de 68 es
 * insustituible, aunque en los dos casos sea "el mejor de su puesto".
 *
 * La primera version miraba solo el orden —si era el mejor y cuantos habia— y
 * salia escalonada: el 36% del plantel de la liga caia en "necesidad absoluta"
 * y la lista de transferibles quedaba vacia. Con la caida al reemplazo, la
 * distribucion es continua y la lista se llena de los que de verdad sobran.
 *
 * No se declara a mano en ningun lado, asi que no puede contradecir al
 * plantel: vender al suplente cambia lo que el club pide por el titular.
 */
export function squadNeed(player: Player, squad: readonly Player[]): number {
  const alternatives = squad.filter(
    (other) =>
      other.id !== player.id &&
      (other.position === player.position ||
        other.secondaryPositions.includes(player.position)),
  );

  // Sin nadie mas para ese puesto, el club lo necesita del todo.
  if (alternatives.length === 0) return 1;

  const own = overallForPosition(player.attributes, player.position);
  const best = Math.max(
    ...alternatives.map((other) => overallForPosition(other.attributes, player.position)),
  );

  // La caida hasta el reemplazo, en puntos de overall. Diez puntos mejor que
  // su suplente es insustituible; diez peor, prescindible.
  const dropOff = own - best;
  const need = 0.5 + dropOff / 20;

  // Y tener mucho fondo en el puesto lo hace algo menos necesario, aunque sea
  // el mejor: el club puede rotar.
  const depth = Math.max(0, alternatives.length - 1) * 0.05;

  return clamp(need - depth, 0.05, 1);
}

/**
 * A quien pondria en la lista de transferibles un club de IA.
 *
 * A los que le sobran: los que tienen a dos o mas mejores en su puesto. Se
 * calcula, asi que la lista se mantiene coherente con el plantel sin que nadie
 * la escriba.
 */
export function autoTransferList(
  squad: readonly Player[],
  limit = MAX_LISTED_PER_CLUB,
): readonly Player[] {
  return squad
    .map((player) => ({ player, need: squadNeed(player, squad) }))
    .filter((entry) => entry.need <= TRANSFER_LIST_NEED)
    // De los que no extranaria, los que menos — y entre los que empatan, el
    // mejor. Un club que quiere hacer caja publica al suplente que alguien le
    // va a comprar, no al peor de todos.
    //
    // Sin este segundo criterio la lista salia entera de arqueros suplentes:
    // todos empatan en la necesidad minima y el desempate por id los ordenaba
    // siempre igual.
    .sort(
      (a, b) =>
        a.need - b.need ||
        overallForPosition(b.player.attributes, b.player.position) -
          overallForPosition(a.player.attributes, a.player.position) ||
        a.player.id.localeCompare(b.player.id),
    )
    .slice(0, limit)
    .map((entry) => entry.player);
}

/** Por debajo de esta necesidad, un club de IA escucharia ofertas. */
export const TRANSFER_LIST_NEED = 0.3;

/**
 * Cuantos publica cada club.
 *
 * Sin este tope, el 45% de los jugadores de la liga aparecia en la lista de
 * transferibles: con planteles de titulares y suplentes claramente peores, casi
 * todos los suplentes entran en "no lo extranaria". Realista en el sentido
 * estricto, inservible como pantalla.
 */
export const MAX_LISTED_PER_CLUB = 3;
