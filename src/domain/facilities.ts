/**
 * INSTALACIONES DEL CLUB (seccion 8).
 *
 * La infraestructura va separada del staff, pero las dos interactuan: cada
 * profesional trabaja respaldado por una instalacion, y un entrenador de
 * cinco estrellas en instalaciones de dos no puede aprovechar todo su
 * beneficio. Eso es lo que obliga a elegir entre invertir en personas o en
 * infraestructura.
 *
 * Los numeros de esta tabla son datos de juego: se editan aca.
 */

export const FACILITY_IDS = [
  'entrenamiento',
  'academia',
  'medico',
  'scouting',
  'oficinas',
] as const;

export type FacilityId = (typeof FACILITY_IDS)[number];

/** Nivel de una instalacion, de 1 a 5 estrellas. */
export type FacilityLevel = 1 | 2 | 3 | 4 | 5;

export const MAX_FACILITY_LEVEL = 5;

export type FacilitySpec = {
  readonly id: FacilityId;
  readonly name: string;
  readonly description: string;
  /** Coste de subir de N a N+1 estrellas. El indice 0 es pasar de 1 a 2. */
  readonly upgradeCost: readonly [number, number, number, number];
  /** Semanas de obra para subir de N a N+1. */
  readonly upgradeWeeks: readonly [number, number, number, number];
  /** Gasto mensual de mantenimiento por nivel. */
  readonly upkeep: readonly [number, number, number, number, number];
};

export const FACILITY_SPECS: Readonly<Record<FacilityId, FacilitySpec>> = {
  entrenamiento: {
    id: 'entrenamiento',
    name: 'Centro de entrenamiento',
    description:
      'Canchas, gimnasio y espacios de recuperación del plantel profesional. Es donde trabajan los ' +
      'entrenadores y el preparador físico.',
    upgradeCost: [14_000_000, 26_000_000, 42_000_000, 68_000_000],
    upgradeWeeks: [10, 14, 18, 26],
    upkeep: [2_200_000, 3_400_000, 4_900_000, 6_800_000, 9_200_000],
  },
  academia: {
    id: 'academia',
    name: 'Academia juvenil',
    description:
      'Infraestructura de inferiores y pensión para los juveniles del interior. Condiciona el trabajo ' +
      'del entrenador y el ojeador juvenil.',
    upgradeCost: [9_000_000, 17_000_000, 28_000_000, 46_000_000],
    upgradeWeeks: [8, 11, 14, 20],
    upkeep: [1_400_000, 2_200_000, 3_200_000, 4_500_000, 6_100_000],
  },
  medico: {
    id: 'medico',
    name: 'Centro médico',
    description:
      'Diagnóstico, kinesiología y seguimiento de lesiones. Define cuánto pueden hacer el médico y el ' +
      'fisioterapeuta.',
    upgradeCost: [7_000_000, 12_000_000, 19_000_000, 31_000_000],
    upgradeWeeks: [6, 8, 10, 14],
    upkeep: [1_100_000, 1_700_000, 2_500_000, 3_500_000, 4_800_000],
  },
  scouting: {
    id: 'scouting',
    name: 'Departamento de scouting',
    description:
      'Red de contactos, base de datos y video análisis. Sin esto, el ojeador trabaja a ciegas.',
    upgradeCost: [5_000_000, 9_000_000, 15_000_000, 24_000_000],
    upgradeWeeks: [5, 7, 9, 12],
    upkeep: [800_000, 1_300_000, 1_900_000, 2_700_000, 3_700_000],
  },
  oficinas: {
    id: 'oficinas',
    name: 'Oficinas del club',
    description:
      'Administración, análisis y gestión institucional. Es el lugar de trabajo del analista, el ' +
      'secretario técnico y el psicólogo.',
    upgradeCost: [4_000_000, 7_000_000, 12_000_000, 20_000_000],
    upgradeWeeks: [4, 6, 8, 11],
    upkeep: [700_000, 1_100_000, 1_600_000, 2_300_000, 3_100_000],
  },
};

/** Coste de subir la instalacion un nivel. `null` si ya esta al maximo. */
export function facilityUpgradeCost(id: FacilityId, level: FacilityLevel): number | null {
  if (level >= MAX_FACILITY_LEVEL) return null;
  return FACILITY_SPECS[id].upgradeCost[level - 1] ?? null;
}

/** Semanas de obra para subir un nivel. `null` si ya esta al maximo. */
export function facilityUpgradeWeeks(id: FacilityId, level: FacilityLevel): number | null {
  if (level >= MAX_FACILITY_LEVEL) return null;
  return FACILITY_SPECS[id].upgradeWeeks[level - 1] ?? null;
}

/** Mantenimiento mensual de la instalacion en su nivel actual. */
export function facilityUpkeep(id: FacilityId, level: FacilityLevel): number {
  return FACILITY_SPECS[id].upkeep[level - 1] ?? 0;
}

export function facilitySpec(id: FacilityId): FacilitySpec {
  return FACILITY_SPECS[id];
}
