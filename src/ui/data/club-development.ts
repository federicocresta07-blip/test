/**
 * DATOS DE DEMOSTRACION — staff, instalaciones, finanzas y obras
 * (secciones 7, 8, 9, 12, 19). Todos los numeros son inventados y
 * configurables: la interfaz no los calcula.
 */

import type {
  DevelopmentProject,
  Facility,
  Finances,
  StaffMember,
  StaffRole,
} from '../models/index.ts';

function staff(
  id: string,
  name: string,
  role: StaffRole,
  stars: number,
  salary: number,
  yearsAtClub: number,
  currentEffect: string,
  nextEffect: string,
  upgradeCost: number,
): StaffMember {
  return { id, name, role, stars, salary, yearsAtClub, currentEffect, nextEffect, upgradeCost };
}

export const DEMO_STAFF: readonly StaffMember[] = [
  staff('st-1', 'Ariel Monzón', 'Entrenador de arqueros', 3, 1_800_000, 4, '+12% velocidad de entrenamiento de arqueros', '+16%', 2_200_000),
  staff('st-2', 'Rubén Ayala', 'Entrenador defensivo', 4, 2_400_000, 2, '+15% desarrollo defensivo', '+19%', 3_100_000),
  staff('st-3', 'Nicolás Bruno', 'Entrenador de mediocampistas', 3, 2_100_000, 3, '+11% atributos técnicos del medio', '+15%', 2_600_000),
  staff('st-4', 'Darío Villalba', 'Entrenador ofensivo', 2, 1_500_000, 1, '+8% desarrollo de delanteros', '+12%', 1_900_000),
  staff('st-5', 'Esteban Roldán', 'Preparador físico', 4, 2_200_000, 5, '-14% fatiga acumulada por partido', '-18%', 2_900_000),
  staff('st-6', 'Marcelo Ibáñez', 'Ojeador', 3, 1_600_000, 2, 'Informes con margen ±6 de overall', '±4', 2_400_000),
  staff('st-7', 'Fabián Cardozo', 'Ojeador juvenil', 2, 1_200_000, 3, 'Potencial juvenil estimado ±12', '±8', 1_700_000),
  staff('st-8', 'Cristian Vega', 'Entrenador juvenil', 3, 1_400_000, 6, '+10% desarrollo de inferiores', '+14%', 2_000_000),
  staff('st-9', 'Dra. Carla Méndez', 'Médico', 4, 2_600_000, 7, '-18% tiempo de recuperación', '-23%', 3_400_000),
  staff('st-10', 'Leandro Pizarro', 'Fisioterapeuta', 3, 1_700_000, 2, '-9% riesgo de lesión', '-13%', 2_300_000),
  staff('st-11', 'Lic. Sofía Arrieta', 'Psicólogo deportivo', 2, 1_300_000, 1, '+6% recuperación de moral', '+10%', 1_800_000),
  staff('st-12', 'Hernán Costa', 'Analista de rivales', 3, 1_900_000, 3, 'Informe táctico del próximo rival', 'Informe + patrones de balón parado', 2_500_000),
  staff('st-13', 'Gustavo Pereyra', 'Secretario técnico', 4, 2_800_000, 8, 'Valoraciones de mercado con ±8% de error', '±5%', 3_600_000),
];

export const DEMO_FACILITIES: readonly Facility[] = [
  { id: 'fac-1', name: 'Centro de entrenamiento', stars: 4, description: 'Canchas, gimnasio y espacios de recuperación del plantel profesional.', upgradeCost: 42_000_000, upgradeWeeks: 18, progress: null },
  { id: 'fac-2', name: 'Academia juvenil', stars: 3, description: 'Infraestructura de inferiores y pensión para juveniles del interior.', upgradeCost: 28_000_000, upgradeWeeks: 14, progress: 0.35 },
  { id: 'fac-3', name: 'Centro médico', stars: 3, description: 'Diagnóstico, kinesiología y seguimiento de lesiones.', upgradeCost: 19_000_000, upgradeWeeks: 10, progress: null },
  { id: 'fac-4', name: 'Departamento de scouting', stars: 2, description: 'Red de ojeadores, base de datos y video análisis.', upgradeCost: 15_000_000, upgradeWeeks: 8, progress: null },
  { id: 'fac-5', name: 'Oficinas del club', stars: 3, description: 'Administración, marketing y gestión institucional.', upgradeCost: 12_000_000, upgradeWeeks: 6, progress: null },
];

export const DEMO_FINANCES: Finances = {
  cash: 418_500_000,
  transferBudget: 140_000_000,
  wageBill: 96_300_000,
  monthlyIncome: 182_400_000,
  monthlyExpenses: 151_700_000,
};

export const DEMO_PROJECTS: readonly DevelopmentProject[] = [
  { id: 'pr-1', name: 'Academia juvenil → ★★★★☆', kind: 'instalación', progress: 0.35, weeksLeft: 9 },
  { id: 'pr-2', name: 'Ampliación tribuna sur', kind: 'estadio', progress: 0.62, weeksLeft: 7 },
  { id: 'pr-3', name: 'Entrenador ofensivo → ★★★☆☆', kind: 'staff', progress: 0.8, weeksLeft: 2 },
];
