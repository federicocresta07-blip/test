/**
 * LAS FINANZAS DEL CLUB (secciones 9 y 12, fase 6).
 *
 * ============================================================
 * NADA DECLARADO QUE SE PUEDA DERIVAR
 * ============================================================
 *
 * Antes de esta fase las finanzas eran cinco numeros escritos a mano:
 *
 *     cash: 418_500_000, transferBudget: 140_000_000,
 *     wageBill: 96_300_000, monthlyIncome: 182_400_000,
 *     monthlyExpenses: 151_700_000
 *
 * La masa salarial ya se habia arreglado en la fase 3 —es la suma de los
 * sueldos del plantel y del cuerpo tecnico— pero los otros cuatro seguian
 * siendo constantes. Y eso hace que el juego mienta en las dos direcciones:
 * se podia ampliar el estadio y el ingreso mensual no se movia, o vender a
 * medio plantel y el presupuesto de fichajes quedaba igual.
 *
 * Aca se calcula el ejercicio completo, linea por linea, y cada linea sale
 * de algo que el jugador puede cambiar:
 *
 * INGRESOS
 *   - cuota social       = socios x cuota            (el estadio es dato real)
 *   - recaudacion        = los partidos de local ya jugados
 *   - television         = escala con la reputacion del club
 *   - sponsor            = escala con la reputacion y con la posicion
 *
 * GASTOS
 *   - sueldos del plantel  = suma de los contratos
 *   - sueldos del staff    = suma de los contratos del cuerpo tecnico
 *   - mantenimiento        = instalaciones por nivel, mas el estadio
 *
 * El PRESUPUESTO DE FICHAJES no es un numero aparte: es lo que el club se
 * puede permitir, y eso es caja mas lo que va a generar en lo que queda de
 * temporada, menos un colchon. Por eso se mueve cuando el club gana partidos.
 */

import { clamp } from '../core/math.ts';
import type { Stadium } from './stadium.ts';

/** Una linea del balance, con su nombre listo para mostrar. */
export type LedgerLine = {
  readonly id: string;
  readonly label: string;
  /** Pesos por mes. Positivo es ingreso, negativo es gasto. */
  readonly monthly: number;
  /** De donde sale este numero. Va a la pantalla: nada sin explicacion. */
  readonly source: string;
};

export type FinanceConfig = {
  /** Cuota mensual del socio, en pesos. */
  readonly memberFee: number;
  /** Television al mes para un club de reputacion 100. */
  readonly televisionAtTop: number;
  /** Television minima: la reparticion no es proporcional, hay un piso. */
  readonly televisionFloor: number;
  /** Sponsor al mes para un club de reputacion 100 y puntero. */
  readonly sponsorAtTop: number;
  /** Cuanto del sponsor depende de la posicion y cuanto de la reputacion. */
  readonly sponsorPositionShare: number;
  /**
   * Colchon que no se toca para fichar, en meses de gastos.
   *
   * Empezo en 3 y estaba mal, y el error solo se vio jugando: tres meses de
   * gastos de River son 405 millones contra una caja de 419, asi que el
   * presupuesto de fichajes arrancaba en CERO y el mercado entero —que es la
   * fase 5— quedaba inutilizable el primer dia. Mes y medio deja margen real
   * y sigue impidiendo gastar la caja entera.
   */
  readonly reserveMonths: number;
  /**
   * Cuanto del superavit proyectado de lo que queda de temporada se puede
   * comprometer en fichajes. No el 100%: un club no gasta lo que todavia no
   * cobro.
   */
  readonly projectedIncomeShare: number;
};

/**
 * Los numeros estan en la ESCALA DEL MERCADO, no en pesos de 1998.
 *
 * Ver el comentario largo en `domain/stadium.ts`: el juego tiene una sola
 * escala de plata y es la que ya usaba `domain/market.ts`, donde un titular de
 * River cobra 4,6 millones por mes. Estos numeros se calcularon para que los
 * ingresos de un club grande alcancen a pagar su plantel.
 */
export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  memberFee: 450,
  televisionAtTop: 62_000_000,
  televisionFloor: 16_000_000,
  sponsorAtTop: 46_000_000,
  sponsorPositionShare: 0.35,
  reserveMonths: 1.5,
  projectedIncomeShare: 0.55,
};

export type FinanceInput = {
  readonly stadium: Stadium;
  /** Reputacion del club, 1..100. Derivada del estadio. */
  readonly reputation: number;
  /** Posicion en la tabla, 1 es primero. */
  readonly position: number;
  readonly clubsInLeague: number;
  /** Suma de los sueldos mensuales del plantel. */
  readonly playerWages: number;
  /** Suma de los sueldos mensuales del cuerpo tecnico. */
  readonly staffWages: number;
  /** Mantenimiento mensual de las instalaciones. */
  readonly facilityUpkeep: number;
  /** Mantenimiento mensual del estadio ampliado. */
  readonly stadiumUpkeep: number;
  /**
   * Recaudacion de los partidos de local ya jugados y cuantos fueron. El
   * promedio mensual se estima con `MATCHES_PER_MONTH` partidos de local.
   */
  readonly gateTotal: number;
  readonly homeMatchesPlayed: number;
  /** Caja inicial del club. */
  readonly openingCash: number;
  /** Gastos y ventas ya ejecutados: obras pagadas, fichajes, traspasos. */
  readonly capitalSpent: number;
  readonly capitalReceived: number;
  /** Fechas de local que quedan por jugar en la temporada. */
  readonly homeMatchesLeft: number;
};

/** Partidos de local por mes en un torneo de una fecha por semana. */
export const MATCHES_PER_MONTH = 2;

export type FinanceReport = {
  readonly income: readonly LedgerLine[];
  readonly expenses: readonly LedgerLine[];
  readonly monthlyIncome: number;
  readonly monthlyExpenses: number;
  readonly balance: number;
  readonly cash: number;
  readonly transferBudget: number;
  readonly wageBill: number;
  /**
   * Que fraccion de LO QUE EL CLUB GANA se va en sueldos.
   *
   * Se mide contra los ingresos y no contra los gastos a proposito. Contra los
   * gastos daba 89% para cualquier club, porque en este juego el
   * mantenimiento de las instalaciones es chico al lado de la masa salarial:
   * la alerta estaba siempre encendida y no informaba nada. Contra los
   * ingresos si dice algo — "los sueldos se comen el 95% de lo que entra" es
   * el problema real de un club que todavia no lleno la cancha.
   */
  readonly wageShare: number;
  /** Recaudacion promedio por partido de local jugado. */
  readonly averageGate: number;
};

/**
 * El ejercicio del club.
 *
 * Todo derivado. El unico numero declarado que entra es la caja inicial, que
 * es el punto de partida de la partida y no se puede calcular de nada.
 */
export function financeReport(
  input: FinanceInput,
  config: FinanceConfig = DEFAULT_FINANCE_CONFIG,
): FinanceReport {
  const membership = input.stadium.members * config.memberFee;
  const averageGate =
    input.homeMatchesPlayed > 0 ? input.gateTotal / input.homeMatchesPlayed : 0;
  const gateMonthly = averageGate * MATCHES_PER_MONTH;
  const television = televisionIncome(input.reputation, config);
  const sponsor = sponsorIncome(input.reputation, input.position, input.clubsInLeague, config);

  const income: LedgerLine[] = [
    {
      id: 'cuota',
      label: 'Cuota social',
      monthly: membership,
      source: `${formatCount(input.stadium.members)} socios x $${config.memberFee}`,
    },
    {
      id: 'recaudacion',
      label: 'Recaudación de partidos',
      monthly: gateMonthly,
      source:
        input.homeMatchesPlayed > 0
          ? `promedio de ${input.homeMatchesPlayed} ${plural(input.homeMatchesPlayed, 'partido', 'partidos')} de local x ${MATCHES_PER_MONTH} por mes`
          : 'todavía no se jugó de local',
    },
    {
      id: 'television',
      label: 'Televisión',
      monthly: television,
      source: `reparto por reputación (${input.reputation})`,
    },
    {
      id: 'sponsor',
      label: 'Sponsor',
      monthly: sponsor,
      source: `reputación (${input.reputation}) y posición (${input.position || '—'}º)`,
    },
  ];

  const expenses: LedgerLine[] = [
    {
      id: 'sueldos-plantel',
      label: 'Sueldos del plantel',
      monthly: outflow(input.playerWages),
      source: 'suma de los contratos del plantel',
    },
    {
      id: 'sueldos-staff',
      label: 'Sueldos del cuerpo técnico',
      monthly: outflow(input.staffWages),
      source: 'suma de los contratos del cuerpo técnico',
    },
    {
      id: 'instalaciones',
      label: 'Mantenimiento de instalaciones',
      monthly: outflow(input.facilityUpkeep),
      source: 'según el nivel de cada instalación',
    },
    {
      id: 'estadio',
      label: 'Mantenimiento del estadio',
      monthly: outflow(input.stadiumUpkeep),
      source:
        input.stadiumUpkeep > 0
          ? 'por los asientos construidos en la ampliación'
          : 'sin ampliaciones todavía',
    },
  ];

  const monthlyIncome = income.reduce((total, line) => total + line.monthly, 0);
  const monthlyExpenses = -expenses.reduce((total, line) => total + line.monthly, 0);
  const balance = monthlyIncome - monthlyExpenses;

  // La caja: lo que habia, mas lo que entro de recaudacion y de ventas, menos
  // lo que se gasto en obras y fichajes.
  const cash = Math.max(
    0,
    input.openingCash + input.gateTotal + input.capitalReceived - input.capitalSpent,
  );

  const wageBill = input.playerWages + input.staffWages;

  return {
    income,
    expenses,
    monthlyIncome,
    monthlyExpenses,
    balance,
    cash,
    transferBudget: transferBudget(cash, balance, monthlyExpenses, input.homeMatchesLeft, config),
    wageBill,
    wageShare: monthlyIncome > 0 ? wageBill / monthlyIncome : 1,
    averageGate,
  };
}

/**
 * La television.
 *
 * No es proporcional a la reputacion: hay un piso que cobran todos y encima
 * un reparto que premia al que mueve audiencia. Por eso a un club chico la
 * television le representa una parte mucho mayor de sus ingresos.
 */
export function televisionIncome(
  reputation: number,
  config: FinanceConfig = DEFAULT_FINANCE_CONFIG,
): number {
  const share = clamp(reputation, 1, 100) / 100;
  return Math.round(
    config.televisionFloor + (config.televisionAtTop - config.televisionFloor) * share ** 1.4,
  );
}

/** El sponsor: parte reputacion, parte como va el equipo. */
export function sponsorIncome(
  reputation: number,
  position: number,
  clubsInLeague: number,
  config: FinanceConfig = DEFAULT_FINANCE_CONFIG,
): number {
  const repShare = clamp(reputation, 1, 100) / 100;
  const posShare =
    clubsInLeague > 1 && position > 0
      ? clamp(1 - (position - 1) / (clubsInLeague - 1), 0, 1)
      : 0.5;
  const mix =
    repShare * (1 - config.sponsorPositionShare) + posShare * config.sponsorPositionShare;
  return Math.round(config.sponsorAtTop * mix);
}

/**
 * El presupuesto de fichajes.
 *
 * NO es un numero aparte: es lo que el club se puede permitir. Caja, menos el
 * colchon de tres meses de gastos, mas una parte del superavit que va a
 * generar en las fechas de local que quedan.
 *
 * Si el club pierde plata cada mes, el proyectado RESTA: un club en rojo
 * tiene menos margen para fichar del que dice su caja, y eso es lo que hace
 * que la masa salarial sea una decision con consecuencia.
 */
export function transferBudget(
  cash: number,
  monthlyBalance: number,
  monthlyExpenses: number,
  homeMatchesLeft: number,
  config: FinanceConfig = DEFAULT_FINANCE_CONFIG,
): number {
  const reserve = monthlyExpenses * config.reserveMonths;
  const monthsLeft = homeMatchesLeft / MATCHES_PER_MONTH;
  const projected = monthlyBalance * monthsLeft * config.projectedIncomeShare;
  return Math.max(0, Math.round(cash - reserve + projected));
}

/**
 * El gasto como linea del balance: negativo, pero nunca `-0`.
 *
 * Parece un detalle y no lo es: `-0` se muestra como "-0" en la pantalla, y
 * una linea de mantenimiento en cero apareceria como si el club debiera algo.
 * Lo encontro un test que comparaba con `0` y fallaba por `Object.is`.
 */
function outflow(value: number): number {
  return value === 0 ? 0 : -value;
}

function formatCount(value: number): string {
  return value.toLocaleString('es-AR');
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
