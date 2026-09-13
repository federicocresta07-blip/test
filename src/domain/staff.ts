/**
 * STAFF Y DESARROLLO (secciones 7, 8).
 *
 * Cada profesional tiene un nivel de 1 a 5 estrellas y produce un efecto
 * concreto y medible. Tres reglas ordenan todo el modulo:
 *
 * 1. NADA DE EFECTOS EN PROSA. El efecto es un numero con su unidad, no un
 *    texto. Se calcula acá y la interfaz solo lo muestra. Así no puede haber
 *    boosts mágicos ni ambiguos (criterio de la fase 3).
 *
 * 2. LAS INSTALACIONES LIMITAN AL STAFF. Un entrenador de cinco estrellas en
 *    instalaciones de dos no rinde cinco estrellas. El efecto real es el
 *    nominal por el aprovechamiento, y las dos cosas se muestran por
 *    separado para que se entienda de dónde sale la diferencia.
 *
 * 3. CADA EFECTO DICE QUIÉN LO CONSUME. Algunos ya los aplica el juego
 *    (`consumer: 'implementado'`); otros esperan un módulo que todavía no
 *    existe y lo declaran (`consumer: { pendiente, fase }`). Un efecto no
 *    puede afirmar que hace algo que el juego todavía no hace.
 *
 * Los números son datos de juego: se editan en este archivo.
 */

import { clamp } from '../core/math.ts';
import type { FacilityId, FacilityLevel } from './facilities.ts';

export const STAFF_ROLES = [
  'Entrenador de arqueros',
  'Entrenador defensivo',
  'Entrenador de mediocampistas',
  'Entrenador ofensivo',
  'Preparador físico',
  'Ojeador',
  'Ojeador juvenil',
  'Entrenador juvenil',
  'Médico',
  'Fisioterapeuta',
  'Psicólogo deportivo',
  'Analista de rivales',
  'Secretario técnico',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/** Nivel del profesional, de 1 a 5 estrellas. */
export type StaffLevel = 1 | 2 | 3 | 4 | 5;

export const MAX_STAFF_LEVEL = 5;

/** Area de trabajo, para agrupar en la interfaz. */
export type StaffArea = 'entrenamiento' | 'médico' | 'scouting' | 'gestión';

/** Unidad en la que se expresa el efecto. */
export type EffectUnit =
  /** Porcentaje de mejora o de reducción. */
  | 'porcentaje'
  /** Puntos de la escala 1-100 (por ejemplo, el margen de error de un informe). */
  | 'puntos'
  /** Nivel de detalle, de 1 a 5. */
  | 'nivel';

/**
 * Quién aplica el efecto.
 *
 * `implementado` significa que el juego ya lo usa de verdad hoy.
 * `pendiente` nombra el módulo que va a consumirlo y en qué fase se
 * construye. Es información que la interfaz muestra tal cual: preferimos
 * decir "esto todavía no se aplica" antes que insinuar que sí.
 */
export type EffectConsumer =
  | { readonly kind: 'implementado'; readonly where: string }
  | { readonly kind: 'pendiente'; readonly module: string; readonly phase: number };

export type StaffRoleSpec = {
  readonly role: StaffRole;
  readonly area: StaffArea;
  /** Instalación que respalda el trabajo de este rol. */
  readonly facility: FacilityId;
  /** Qué mejora, en palabras del usuario. */
  readonly effect: string;
  readonly unit: EffectUnit;
  /**
   * Cómo se LEE el efecto en pantalla: `mejora` se muestra con signo más
   * ("+21%"), `reduce` con signo menos ("−32% de tiempo de recuperación").
   *
   * Ojo: esto no dice para dónde se mueve el número cuando el profesional
   * sube de nivel. Son dos cosas distintas y confundirlas fue un error que ya
   * cometimos una vez. El médico reduce el tiempo de lesión y su número SUBE
   * con el nivel (reduce más: 8% → 32%); el margen de error del ojeador BAJA
   * (9 pts → 3 pts). Los dos se leen como algo que baja, pero sus tablas van
   * en direcciones opuestas. Para eso está `higherIsBetter`, que se deriva de
   * la tabla en lugar de declararse.
   */
  readonly direction: 'mejora' | 'reduce';
  /** Valor del efecto en cada nivel, de 1 a 5 estrellas. */
  readonly effectByLevel: readonly [number, number, number, number, number];
  /** Salario mensual en cada nivel. */
  readonly salaryByLevel: readonly [number, number, number, number, number];
  /** Coste de subir de N a N+1. El índice 0 es pasar de 1 a 2. */
  readonly upgradeCost: readonly [number, number, number, number];
  /** Semanas que lleva la mejora (formación, renegociación de contrato). */
  readonly upgradeWeeks: readonly [number, number, number, number];
  /** Coste de contratar a alguien de nivel N, si el puesto está vacante. */
  readonly hireCost: readonly [number, number, number, number, number];
  readonly consumer: EffectConsumer;
};

const IMPLEMENTED_PROGRESSION: EffectConsumer = {
  kind: 'implementado',
  where: 'evolución del plantel entre partidos',
};

/** Los cuatro entrenadores por linea y el juvenil: desarrollo de atributos. */
const IMPLEMENTED_DEVELOPMENT: EffectConsumer = {
  kind: 'implementado',
  where: 'desarrollo de los atributos de sus jugadores, fecha a fecha',
};

/**
 * Los cuatro entrenadores por linea.
 *
 * Su efecto acelera el desarrollo de los atributos de los jugadores de SUS
 * puestos: `domain/training.ts` mapea cada puesto a su entrenador y
 * `progression/development.ts` aplica el porcentaje. Por eso mejorar al
 * entrenador de arqueros no le hace nada al 9, que es como tiene que ser.
 *
 * Hasta la fase 4 esto decia "todavia no se aplica": el motor no sabia hacer
 * crecer los atributos de un jugador con el tiempo.
 */
function trainingRole(role: StaffRole, effect: string): StaffRoleSpec {
  return {
    role,
    area: 'entrenamiento',
    facility: 'entrenamiento',
    effect,
    unit: 'porcentaje',
    direction: 'mejora',
    effectByLevel: [6, 9, 13, 17, 21],
    salaryByLevel: [700_000, 1_100_000, 1_700_000, 2_500_000, 3_600_000],
    upgradeCost: [900_000, 1_600_000, 2_600_000, 4_200_000],
    upgradeWeeks: [3, 4, 6, 8],
    hireCost: [400_000, 900_000, 1_800_000, 3_200_000, 5_600_000],
    consumer: IMPLEMENTED_DEVELOPMENT,
  };
}

export const STAFF_SPECS: Readonly<Record<StaffRole, StaffRoleSpec>> = {
  'Entrenador de arqueros': trainingRole(
    'Entrenador de arqueros',
    'Velocidad de desarrollo de los atributos de arquero',
  ),
  'Entrenador defensivo': trainingRole(
    'Entrenador defensivo',
    'Velocidad de desarrollo de defensores',
  ),
  'Entrenador de mediocampistas': trainingRole(
    'Entrenador de mediocampistas',
    'Velocidad de desarrollo de mediocampistas',
  ),
  'Entrenador ofensivo': trainingRole(
    'Entrenador ofensivo',
    'Velocidad de desarrollo de delanteros y extremos',
  ),

  'Preparador físico': {
    role: 'Preparador físico',
    area: 'entrenamiento',
    facility: 'entrenamiento',
    effect: 'Recuperación física del plantel entre partidos',
    unit: 'porcentaje',
    direction: 'mejora',
    effectByLevel: [6, 10, 15, 20, 26],
    salaryByLevel: [800_000, 1_300_000, 1_900_000, 2_800_000, 4_000_000],
    upgradeCost: [1_000_000, 1_800_000, 2_900_000, 4_600_000],
    upgradeWeeks: [3, 4, 6, 8],
    hireCost: [450_000, 1_000_000, 2_000_000, 3_500_000, 6_200_000],
    consumer: IMPLEMENTED_PROGRESSION,
  },

  Ojeador: {
    role: 'Ojeador',
    area: 'scouting',
    facility: 'scouting',
    effect: 'Margen de error del informe sobre un jugador externo',
    unit: 'puntos',
    direction: 'reduce',
    effectByLevel: [9, 7, 5, 4, 3],
    salaryByLevel: [600_000, 950_000, 1_450_000, 2_100_000, 3_000_000],
    upgradeCost: [800_000, 1_400_000, 2_300_000, 3_700_000],
    upgradeWeeks: [3, 4, 5, 7],
    hireCost: [350_000, 800_000, 1_600_000, 2_800_000, 4_900_000],
    // Decide con cuanto margen se ve el nivel y el techo de un jugador de otro
    // club. Lo consume `domain/market.ts` en `appraise`: sin ojeador, el
    // margen es de catorce puntos y se puede pagar por un 80 y recibir un 68.
    consumer: {
      kind: 'implementado',
      where: 'margen del informe sobre el nivel de un jugador del mercado',
    },
  },

  'Ojeador juvenil': {
    role: 'Ojeador juvenil',
    area: 'scouting',
    facility: 'academia',
    effect: 'Amplitud del rango de potencial estimado de un juvenil',
    unit: 'puntos',
    direction: 'reduce',
    effectByLevel: [15, 11, 8, 6, 4],
    salaryByLevel: [500_000, 800_000, 1_250_000, 1_800_000, 2_600_000],
    upgradeCost: [700_000, 1_200_000, 2_000_000, 3_200_000],
    upgradeWeeks: [3, 4, 5, 7],
    hireCost: [300_000, 700_000, 1_400_000, 2_500_000, 4_300_000],
    // El margen de error del informe sobre un juvenil: `domain/youth.ts` lo
    // consume en `scoutPotential`, y es lo que decide el ancho del rango de
    // potencial que muestra la pantalla de inferiores.
    consumer: {
      kind: 'implementado',
      where: 'ancho del rango de potencial que informa de cada juvenil',
    },
  },

  'Entrenador juvenil': {
    role: 'Entrenador juvenil',
    area: 'entrenamiento',
    facility: 'academia',
    effect: 'Velocidad de desarrollo de los juveniles',
    unit: 'porcentaje',
    direction: 'mejora',
    effectByLevel: [7, 11, 15, 19, 24],
    salaryByLevel: [550_000, 900_000, 1_400_000, 2_000_000, 2_900_000],
    upgradeCost: [750_000, 1_300_000, 2_100_000, 3_400_000],
    upgradeWeeks: [3, 4, 6, 8],
    hireCost: [320_000, 750_000, 1_500_000, 2_700_000, 4_700_000],
    consumer: IMPLEMENTED_DEVELOPMENT,
  },

  Médico: {
    role: 'Médico',
    area: 'médico',
    facility: 'medico',
    effect: 'Reducción del tiempo de recuperación de una lesión',
    unit: 'porcentaje',
    direction: 'reduce',
    effectByLevel: [8, 13, 19, 25, 32],
    salaryByLevel: [900_000, 1_450_000, 2_200_000, 3_100_000, 4_400_000],
    upgradeCost: [1_100_000, 1_900_000, 3_100_000, 5_000_000],
    upgradeWeeks: [4, 5, 7, 9],
    hireCost: [500_000, 1_100_000, 2_200_000, 3_900_000, 6_800_000],
    consumer: IMPLEMENTED_PROGRESSION,
  },

  Fisioterapeuta: {
    role: 'Fisioterapeuta',
    area: 'médico',
    facility: 'medico',
    effect: 'Reducción del riesgo de lesión durante el partido',
    unit: 'porcentaje',
    direction: 'reduce',
    effectByLevel: [5, 8, 12, 16, 20],
    salaryByLevel: [650_000, 1_000_000, 1_550_000, 2_200_000, 3_100_000],
    upgradeCost: [850_000, 1_500_000, 2_400_000, 3_900_000],
    upgradeWeeks: [3, 4, 6, 8],
    hireCost: [380_000, 850_000, 1_700_000, 3_000_000, 5_200_000],
    consumer: {
      kind: 'implementado',
      where: 'las lesiones que sortea el partido, via `team.injuryPrevention`',
    },
  },

  'Psicólogo deportivo': {
    role: 'Psicólogo deportivo',
    area: 'gestión',
    facility: 'oficinas',
    effect: 'Recuperación de la moral del plantel',
    unit: 'porcentaje',
    direction: 'mejora',
    effectByLevel: [6, 9, 13, 17, 22],
    salaryByLevel: [520_000, 850_000, 1_300_000, 1_900_000, 2_700_000],
    upgradeCost: [700_000, 1_250_000, 2_000_000, 3_300_000],
    upgradeWeeks: [3, 4, 5, 7],
    hireCost: [300_000, 700_000, 1_400_000, 2_500_000, 4_400_000],
    consumer: IMPLEMENTED_PROGRESSION,
  },

  'Analista de rivales': {
    role: 'Analista de rivales',
    area: 'gestión',
    facility: 'oficinas',
    effect: 'Nivel de detalle del informe del próximo rival',
    unit: 'nivel',
    direction: 'mejora',
    effectByLevel: [1, 2, 3, 4, 5],
    salaryByLevel: [700_000, 1_100_000, 1_650_000, 2_400_000, 3_400_000],
    upgradeCost: [900_000, 1_550_000, 2_500_000, 4_000_000],
    upgradeWeeks: [3, 4, 5, 7],
    hireCost: [400_000, 900_000, 1_800_000, 3_100_000, 5_400_000],
    // Decide CUANTO se ve del perfil de un rival: con un analista flojo la
    // pantalla muestra su fuerza general y poco mas; con uno de cinco
    // estrellas, las nueve dimensiones y el plantel probable. Lo consume
    // `ui/lib/scouting.ts`.
    consumer: {
      kind: 'implementado',
      where: 'nivel de detalle del perfil de cada rival',
    },
  },

  'Secretario técnico': {
    role: 'Secretario técnico',
    area: 'gestión',
    facility: 'oficinas',
    effect: 'Error en la valoración de mercado de un jugador',
    unit: 'porcentaje',
    direction: 'reduce',
    effectByLevel: [13, 10, 7, 5, 3],
    salaryByLevel: [1_000_000, 1_600_000, 2_400_000, 3_400_000, 4_800_000],
    upgradeCost: [1_200_000, 2_100_000, 3_400_000, 5_400_000],
    upgradeWeeks: [4, 5, 7, 9],
    hireCost: [550_000, 1_200_000, 2_400_000, 4_200_000, 7_300_000],
    // Decide con cuanto error se tasa a un jugador del mercado. Lo consume
    // `appraise`: sin secretario tecnico el error es del 30% y no se sabe si
    // se esta pagando de mas.
    consumer: {
      kind: 'implementado',
      where: 'error de la tasación de un jugador del mercado',
    },
  },
};

/**
 * Si para este rol un número más alto es mejor.
 *
 * NO se declara en la tabla: se deriva de ella, así que no puede
 * contradecirla. Un rol cuyo valor mide el TAMAÑO de la mejora (el médico
 * reduce un 32%) crece con el nivel; uno cuyo valor mide lo que QUEDA (el
 * ojeador se equivoca por 3 puntos) decrece.
 */
export function higherIsBetter(role: StaffRole): boolean {
  const table = STAFF_SPECS[role].effectByLevel;
  return (table[MAX_STAFF_LEVEL - 1] as number) > (table[0] as number);
}

/** De dos valores del mismo rol, cuál es el mejor. */
export function betterEffect(role: StaffRole, a: number, b: number): number {
  return higherIsBetter(role) ? Math.max(a, b) : Math.min(a, b);
}

/**
 * Cuánto del beneficio nominal se aprovecha, según la instalación que
 * respalda al rol (seccion 8).
 *
 * Un profesional nunca rinde MÁS de lo que su nivel permite: una instalación
 * mejor de lo necesario no lo potencia, solo deja de limitarlo. Al revés sí:
 * una instalación por debajo de su nivel le recorta el rendimiento.
 *
 *   staff ★★★★★ con instalación ★★☆☆☆  ->  73% de aprovechamiento
 *   staff ★★★☆☆ con instalación ★★★☆☆  ->  100%
 *   staff ★★☆☆☆ con instalación ★★★★★  ->  100% (no lo potencia)
 */
export const STAFF_UTILISATION_FLOOR = 0.55;

export function utilisation(staffLevel: StaffLevel, facilityLevel: FacilityLevel): number {
  const ratio = facilityLevel / staffLevel;
  return clamp(STAFF_UTILISATION_FLOOR + (1 - STAFF_UTILISATION_FLOOR) * ratio, 0, 1);
}

/** El efecto de un profesional, con y sin el límite de las instalaciones. */
export type StaffEffect = {
  readonly role: StaffRole;
  readonly spec: StaffRoleSpec;
  readonly level: StaffLevel;
  readonly facility: FacilityId;
  readonly facilityLevel: FacilityLevel;
  /** Lo que daría con instalaciones a la altura. */
  readonly nominal: number;
  /** Fracción del nominal que realmente se aprovecha, 0..1. */
  readonly utilisation: number;
  /** Lo que efectivamente entrega hoy. */
  readonly actual: number;
  /** Las instalaciones lo están limitando. */
  readonly limited: boolean;
  /** Lo que daría con un nivel más, ya descontado el límite actual. */
  readonly nextActual: number | null;
  /** Si un número más alto es mejor para este rol. Derivado de su tabla. */
  readonly higherIsBetter: boolean;
  readonly unit: EffectUnit;
  readonly direction: 'mejora' | 'reduce';
  readonly consumer: EffectConsumer;
};

/** Calcula el efecto real de un profesional en su contexto. */
export function staffEffect(
  role: StaffRole,
  level: StaffLevel,
  facilityLevel: FacilityLevel,
): StaffEffect {
  const spec = STAFF_SPECS[role];
  const nominal = spec.effectByLevel[level - 1] ?? 0;
  const factor = utilisation(level, facilityLevel);

  // Cuando el efecto se lee como una reducción, el aprovechamiento se aplica
  // sobre lo que el profesional AGREGA respecto de un nivel 1, no sobre el
  // número crudo: aprovechar a medias significa avanzar a medias desde el
  // piso del rol. Así el resultado siempre queda entre el valor de nivel 1 y
  // el nominal, cualquiera sea el sentido en el que va la tabla.
  const base = spec.effectByLevel[0] ?? 0;
  const actual =
    spec.direction === 'mejora'
      ? nominal * factor
      : base - (base - nominal) * factor;

  const nextLevel = level < MAX_STAFF_LEVEL ? ((level + 1) as StaffLevel) : null;
  let nextActual: number | null = null;
  if (nextLevel !== null) {
    const nextNominal = spec.effectByLevel[nextLevel - 1] ?? 0;
    const nextFactor = utilisation(nextLevel, facilityLevel);
    nextActual =
      spec.direction === 'mejora'
        ? nextNominal * nextFactor
        : base - (base - nextNominal) * nextFactor;
  }

  return {
    role,
    spec,
    level,
    facility: spec.facility,
    facilityLevel,
    nominal,
    utilisation: factor,
    actual,
    limited: factor < 0.999,
    nextActual,
    higherIsBetter: higherIsBetter(role),
    unit: spec.unit,
    direction: spec.direction,
    consumer: spec.consumer,
  };
}

/** Coste de subir un nivel. `null` si ya está al máximo. */
export function staffUpgradeCost(role: StaffRole, level: StaffLevel): number | null {
  if (level >= MAX_STAFF_LEVEL) return null;
  return STAFF_SPECS[role].upgradeCost[level - 1] ?? null;
}

export function staffUpgradeWeeks(role: StaffRole, level: StaffLevel): number | null {
  if (level >= MAX_STAFF_LEVEL) return null;
  return STAFF_SPECS[role].upgradeWeeks[level - 1] ?? null;
}

/** Salario mensual en un nivel dado. */
export function staffSalary(role: StaffRole, level: StaffLevel): number {
  return STAFF_SPECS[role].salaryByLevel[level - 1] ?? 0;
}

/** Coste de contratar a alguien de un nivel dado para un puesto vacante. */
export function staffHireCost(role: StaffRole, level: StaffLevel): number {
  return STAFF_SPECS[role].hireCost[level - 1] ?? 0;
}

/** Roles que respalda una instalación. Sirve para explicarlo de los dos lados. */
export function rolesSupportedBy(facility: FacilityId): readonly StaffRole[] {
  return STAFF_ROLES.filter((role) => STAFF_SPECS[role].facility === facility);
}

export function staffSpec(role: StaffRole): StaffRoleSpec {
  return STAFF_SPECS[role];
}

// ============================================================
// EFECTOS QUE EL JUEGO YA APLICA
// ============================================================

/** Un profesional del club, con el nivel de su instalación de respaldo. */
export type StaffAssignment = {
  readonly role: StaffRole;
  readonly level: StaffLevel;
  readonly facilityLevel: FacilityLevel;
};

/**
 * Los efectos del staff que consume la evolución del plantel entre partidos.
 *
 * Son los tres que hoy tienen contraparte real en el juego. El resto de los
 * roles declara en su `consumer` qué módulo los va a usar y en qué fase: no
 * se aplican todavía y la interfaz lo dice.
 */
export type ProgressionStaffEffects = {
  /** Porcentaje de mejora en la recuperación física. Preparador físico. */
  readonly recovery: number;
  /** Porcentaje de reducción del tiempo de lesión. Médico. */
  readonly injuryRecovery: number;
  /** Porcentaje de mejora en la recuperación de la moral. Psicólogo. */
  readonly morale: number;
};

export const NO_STAFF_EFFECTS: ProgressionStaffEffects = {
  recovery: 0,
  injuryRecovery: 0,
  morale: 0,
};

/**
 * Traduce el cuerpo técnico a los efectos que aplica la progresión.
 * Un puesto vacante simplemente no aporta nada: no hay penalización oculta.
 */
/**
 * El trabajo preventivo del club, para `team.injuryPrevention`.
 *
 * Sale del fisioterapeuta, ya descontado el limite de las instalaciones: un
 * fisioterapeuta de cinco estrellas en un centro medico de dos no puede
 * aprovechar todo su efecto, igual que el resto del cuerpo tecnico.
 *
 * Sin fisioterapeuta devuelve CERO, que es lo correcto: el riesgo base del
 * motor es el de un equipo sin trabajo preventivo.
 */
export function injuryPreventionOf(assignments: readonly StaffAssignment[]): number {
  const assignment = assignments.find((entry) => entry.role === 'Fisioterapeuta');
  if (!assignment) return 0;
  return staffEffect('Fisioterapeuta', assignment.level, assignment.facilityLevel).actual;
}

export function progressionEffects(
  assignments: readonly StaffAssignment[],
): ProgressionStaffEffects {
  const effectOf = (role: StaffRole): number => {
    const assignment = assignments.find((entry) => entry.role === role);
    if (!assignment) return 0;
    // Tanto para los roles que mejoran como para los que reducen, lo que
    // aporta al juego es su efecto real ya descontado el límite de las
    // instalaciones.
    return staffEffect(role, assignment.level, assignment.facilityLevel).actual;
  };

  return {
    recovery: effectOf('Preparador físico'),
    injuryRecovery: effectOf('Médico'),
    morale: effectOf('Psicólogo deportivo'),
  };
}
