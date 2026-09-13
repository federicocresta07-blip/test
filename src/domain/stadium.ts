/**
 * EL ESTADIO Y LA RECAUDACION DE UN PARTIDO (seccion 9, fase 6).
 *
 * ============================================================
 * LA CAPACIDAD Y LOS SOCIOS SON DATO REAL
 * ============================================================
 *
 * No se inventan. `EQ003003.PKF` guarda por club el aforo del estadio y la
 * cantidad de socios, y estan en `data/apertura98.ts`: River con 76.687 de
 * capacidad y 63.000 socios, Platense con 12.657 y 7.500. Esa diferencia es
 * lo que hace que dos clubes de la misma division vivan economias distintas,
 * y es del archivo, no nuestra.
 *
 * Lo que SI es nuestro, y va declarado, es el modelo de cuanta gente va a la
 * cancha y cuanto se recauda. No hay ninguna fuente de asistencia partido por
 * partido del Apertura 98, asi que esto es un modelo, no un dato.
 *
 * ============================================================
 * COMO SE LLENA UNA CANCHA
 * ============================================================
 *
 * La asistencia arranca del PISO DE SOCIOS —el que paga la cuota va, y va
 * casi siempre— y encima suma publico que decide partido por partido. Ese
 * publico responde a cinco cosas, y todas son estado del juego, no azar:
 *
 * 1. EL RIVAL. Un clasico o un grande de visitante llena; un equipo chico un
 *    miercoles, no. Sale de la reputacion del rival, que a su vez sale de sus
 *    socios y su aforo.
 * 2. LA POSICION EN LA TABLA. El que pelea el campeonato mete gente; el que
 *    esta ultimo la pierde.
 * 3. EL PRECIO DE LA ENTRADA. Es la decision del manager, y tiene el filo que
 *    tiene que tener: subir el precio recauda mas por persona y menos en
 *    total si se pasa. La elasticidad esta en el config.
 * 4. LA IMPORTANCIA DEL PARTIDO. Una final mueve gente que no va nunca.
 * 5. EL MOMENTO DEL EQUIPO. Una racha de victorias se nota en la puerta.
 *
 * Y despues hay un techo que no se discute: LA CAPACIDAD. Un club con 12.657
 * de aforo no puede vender 20.000 entradas por mas que gane todo. Eso es lo
 * que hace que ampliar el estadio sea una decision y no un adorno.
 */

import { clamp } from '../core/math.ts';

/** El estadio de un club: los dos numeros que trae el archivo, mas el nombre. */
export type Stadium = {
  readonly name: string;
  /** Aforo. Es el techo duro de la asistencia. */
  readonly capacity: number;
  /** Socios del club: el piso de la asistencia y la cuota social. */
  readonly members: number;
};

/**
 * PRECIO DE UNA ENTRADA. El manager lo elige.
 *
 * ============================================================
 * LA ESCALA DE PLATA DEL JUEGO NO ES LA DE 1998
 * ============================================================
 *
 * Una entrada a la cancha en 1998 costaba entre 5 y 20 pesos, y la primera
 * version de este archivo usaba esos numeros. Estaba mal, y el error no era
 * de fidelidad historica: era de COHERENCIA INTERNA.
 *
 * El mercado (`domain/market.ts`, fase 5) ya valuaba a Aimar en 111 millones
 * con un sueldo de 4,6 millones por mes, y la masa salarial de River sale
 * 120 millones mensuales. Con entradas a 25 pesos, la recaudacion de un
 * partido daba 700 mil: el club quedaba fundido por un factor de treinta y el
 * presupuesto de fichajes era cero siempre.
 *
 * Eran DOS ESCALAS DE PLATA distintas en el mismo juego. Se eligio la del
 * mercado —que ya estaba, ya se mostraba y ya tenia tests— y los numeros de
 * este archivo se recalcularon contra ella: el objetivo es que los ingresos de
 * un club grande alcancen para pagar su plantel, que es lo que los hace
 * comparables.
 *
 * Si algun dia se cambia la escala del mercado, HAY QUE CAMBIAR ESTOS TAMBIEN.
 * El test `las dos escalas de plata del juego son la misma` lo verifica.
 */
export const MIN_TICKET_PRICE = 120;
export const MAX_TICKET_PRICE = 3_000;
/** El precio de referencia: a este precio la elasticidad no mueve nada. */
export const REFERENCE_TICKET_PRICE = 600;

export type StadiumConfig = {
  /** Fraccion de los socios que va a un partido cualquiera. */
  readonly memberTurnout: number;
  /**
   * Publico no socio en el mejor de los casos, como fraccion del aforo libre
   * despues de ubicar a los socios.
   */
  readonly walkUpShare: number;
  /** Cuanto mueve la reputacion del rival, 0..1 sobre el publico no socio. */
  readonly opponentPull: number;
  /** Cuanto mueve la posicion en la tabla. */
  readonly tablePull: number;
  /** Cuanto mueve la racha del equipo. */
  readonly formPull: number;
  /** Cuanto mueve la importancia del partido. */
  readonly importancePull: number;
  /**
   * Elasticidad del precio: cuanto publico se pierde al duplicar la entrada
   * respecto del precio de referencia. 1 significa que al doble de precio va
   * la mitad de la gente que decide en la puerta.
   */
  readonly priceElasticity: number;
  /** Lo que paga el socio de cuota por mes, en pesos. */
  readonly memberFee: number;
  /**
   * Ingreso por hincha en el estadio que no es la entrada: choripan, camiseta,
   * programa. Se cobra por asistente, socio incluido.
   */
  readonly perHeadExtras: number;
  /** Fraccion de la recaudacion de entradas que se lleva el visitante. */
  readonly awayShare: number;
};

export const DEFAULT_STADIUM_CONFIG: StadiumConfig = {
  memberTurnout: 0.62,
  // El 85% del lugar libre: con todo a favor —un clasico, peleando arriba, en
  // racha y con la entrada barata— la cancha se tiene que poder LLENAR. Con
  // 0.72 el techo estructural de un club chico quedaba en el 82% y agotar
  // localidades era imposible, que es un techo que el juego no deberia tener.
  walkUpShare: 0.85,
  opponentPull: 0.3,
  tablePull: 0.22,
  formPull: 0.14,
  importancePull: 0.18,
  priceElasticity: 0.9,
  // En la escala del mercado (ver el comentario del precio de la entrada).
  memberFee: 450,
  perHeadExtras: 150,
  awayShare: 0.12,
};

export type AttendanceInput = {
  readonly stadium: Stadium;
  /** Precio de la entrada elegido por el manager. */
  readonly ticketPrice: number;
  /**
   * Reputacion del rival, 1..100. Sale de sus socios y su aforo, asi que es
   * dato derivado del archivo y no una etiqueta puesta a mano.
   */
  readonly opponentReputation: number;
  /** Posicion del club en la tabla, 1 es primero. */
  readonly position: number;
  readonly clubsInLeague: number;
  /** Momento del equipo, 0..1: 0 es cinco derrotas, 1 es cinco victorias. */
  readonly momentum: number;
  /** Importancia del partido, 0..1. */
  readonly importance: number;
};

/**
 * Cuanta gente va a la cancha.
 *
 * Es deterministico: mismas condiciones, misma asistencia. La variacion del
 * juego viene de que las condiciones cambian fecha a fecha (el rival, la
 * posicion, la racha), no de un `random`.
 */
export function expectedAttendance(
  input: AttendanceInput,
  config: StadiumConfig = DEFAULT_STADIUM_CONFIG,
): number {
  const { stadium } = input;
  if (stadium.capacity <= 0) return 0;

  // El piso: los socios que van.
  const memberBase = Math.min(stadium.capacity, stadium.members * config.memberTurnout);
  const freeSeats = Math.max(0, stadium.capacity - memberBase);

  // El publico que decide partido por partido, sobre el lugar que queda.
  const pull =
    normalize(input.opponentReputation, 1, 100) * config.opponentPull +
    tableAppeal(input.position, input.clubsInLeague) * config.tablePull +
    clamp(input.momentum, 0, 1) * config.formPull +
    clamp(input.importance, 0, 1) * config.importancePull;
  const pullTotal =
    config.opponentPull + config.tablePull + config.formPull + config.importancePull;
  const interest = pullTotal > 0 ? pull / pullTotal : 0;

  const walkUp = freeSeats * config.walkUpShare * interest * priceFactor(input.ticketPrice, config);

  return Math.round(clamp(memberBase + walkUp, 0, stadium.capacity));
}

/**
 * El efecto del precio sobre el publico que decide en la puerta.
 *
 * A precio de referencia vale 1. Mas caro espanta gente, mas barato la trae,
 * y nunca pasa de 1.35 ni baja de 0.1: regalar la entrada no llena una cancha
 * vacia y cobrar una fortuna no la deja literalmente sin nadie.
 */
export function priceFactor(price: number, config: StadiumConfig = DEFAULT_STADIUM_CONFIG): number {
  const clamped = clamp(price, MIN_TICKET_PRICE, MAX_TICKET_PRICE);
  const ratio = clamped / REFERENCE_TICKET_PRICE;
  return clamp(ratio ** -config.priceElasticity, 0.1, 1.35);
}

/** Lo atractivo de la posicion en la tabla, 0..1. Pelear arriba mete gente. */
function tableAppeal(position: number, clubs: number): number {
  if (clubs <= 1 || position <= 0) return 0.5;
  // Invertida: primero vale 1, ultimo vale 0.
  return clamp(1 - (position - 1) / (clubs - 1), 0, 1);
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export type MatchRevenue = {
  readonly attendance: number;
  /** Ocupacion del estadio, 0..1. Derivada, no guardada. */
  readonly occupancy: number;
  /** Entradas vendidas: los socios ya pagaron la cuota y no pagan entrada. */
  readonly ticketsSold: number;
  readonly ticketIncome: number;
  /** Consumo en el estadio, por asistente. */
  readonly extrasIncome: number;
  /** Lo que se lleva el visitante de la recaudacion de entradas. */
  readonly awayCut: number;
  /** Lo que queda para el local. */
  readonly total: number;
};

/**
 * La recaudacion de un partido de local.
 *
 * El socio NO paga entrada: paga la cuota todos los meses y por eso entra. Es
 * la diferencia que hace que un club con muchos socios tenga ingreso estable
 * y uno con pocos dependa de llenar la cancha, que es exactamente como
 * funcionaba.
 */
export function matchRevenue(
  input: AttendanceInput,
  config: StadiumConfig = DEFAULT_STADIUM_CONFIG,
): MatchRevenue {
  const attendance = expectedAttendance(input, config);
  const membersPresent = Math.min(
    attendance,
    Math.round(input.stadium.members * config.memberTurnout),
  );
  const ticketsSold = Math.max(0, attendance - membersPresent);
  const price = clamp(input.ticketPrice, MIN_TICKET_PRICE, MAX_TICKET_PRICE);

  const ticketIncome = ticketsSold * price;
  const extrasIncome = attendance * config.perHeadExtras;
  const awayCut = ticketIncome * config.awayShare;

  return {
    attendance,
    occupancy: input.stadium.capacity > 0 ? attendance / input.stadium.capacity : 0,
    ticketsSold,
    ticketIncome,
    extrasIncome,
    awayCut,
    total: ticketIncome - awayCut + extrasIncome,
  };
}

/**
 * La reputacion de un club a partir de su estadio.
 *
 * Sale de los socios y del aforo, los dos del archivo. Se usa para dos cosas:
 * cuanta gente arrastra de visitante y cuanto pesa el club en el mercado.
 *
 * La escala se ancla en River, que es el techo del torneo con 63.000 socios y
 * 76.687 de aforo. No es una constante elegida a dedo: es el maximo real del
 * dataset, y por eso `REPUTATION_ANCHOR` esta declarado como lo que es.
 */
export const REPUTATION_ANCHOR = { members: 63_000, capacity: 76_687 } as const;

export function reputationFromStadium(stadium: Stadium): number {
  const memberScore = Math.sqrt(clamp(stadium.members, 0, 1e9) / REPUTATION_ANCHOR.members);
  const capacityScore = Math.sqrt(clamp(stadium.capacity, 0, 1e9) / REPUTATION_ANCHOR.capacity);
  // Los socios pesan mas que el aforo: una cancha grande y vacia no es un
  // club grande. Huracan tenia 48.314 de aforo y 9.800 socios.
  const score = memberScore * 0.65 + capacityScore * 0.35;
  return Math.round(clamp(25 + score * 70, 1, 100));
}

// ============================================================
// La ampliacion del estadio
// ============================================================

/**
 * Ampliar la cancha.
 *
 * Es la inversion mas grande y mas lenta del juego, y a proposito: sube el
 * techo de todo lo demas, pero tarda mas que una temporada y el dinero no
 * vuelve hasta que la gente entra. El coste por asiento crece con el tamanio
 * porque ampliar un estadio grande es obra mayor, no una tribuna mas.
 */
export const EXPANSION_STEPS = [2_000, 5_000, 10_000] as const;
export type ExpansionStep = (typeof EXPANSION_STEPS)[number];

/**
 * En la escala del mercado, y CALIBRADO CONTRA LA CAJA DEL CLUB.
 *
 * La primera version puso 1,4 millones por asiento, que dejaba la ampliacion
 * mas chica en casi tres mil millones contra una caja de 419: ninguna de las
 * tres opciones se podia pagar nunca y la pantalla era decorado. Ahora la de
 * 2.000 asientos sale unos 240 millones —dos jugadores buenos— y se puede
 * encarar en la primera temporada; la de 10.000 pasa los mil millones y es un
 * proyecto de varias.
 */
export const EXPANSION_COST_PER_SEAT = 120_000;
export const EXPANSION_WEEKS_PER_THOUSAND = 3.5;
/** Mantenimiento mensual por asiento construido. */
export const EXPANSION_UPKEEP_PER_SEAT = 2_500;

export function expansionCost(seats: number, currentCapacity: number): number {
  // El recargo por tamanio: +1% por cada 10.000 de aforo que ya tiene.
  const sizeSurcharge = 1 + currentCapacity / 1_000_000;
  return Math.round(seats * EXPANSION_COST_PER_SEAT * sizeSurcharge);
}

export function expansionWeeks(seats: number): number {
  return Math.max(4, Math.round((seats / 1000) * EXPANSION_WEEKS_PER_THOUSAND));
}

export function expansionUpkeep(seats: number): number {
  return seats * EXPANSION_UPKEEP_PER_SEAT;
}
