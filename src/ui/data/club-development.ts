/**
 * DATOS DE DEMOSTRACION — staff, instalaciones, finanzas y obras
 * (secciones 7, 8, 9, 12, 19).
 *
 * Acá va solo QUIÉN es cada profesional y EN QUÉ NIVEL está. El salario, el
 * efecto, el coste de mejora y el mantenimiento los calcula el modelo de
 * dominio: no se guardan, para que no puedan contradecirlo.
 *
 * El club arranca con dos puestos vacantes a propósito, así el flujo de
 * contratación tiene para qué existir.
 */

import type {
  ClubFacility,
  DevelopmentProject,
  Finances,
  StaffMember,
  StaffVacancy,
} from '../models/index.ts';

export const DEMO_STAFF: readonly StaffMember[] = [
  { id: 'st-1', name: 'Ariel Monzón', role: 'Entrenador de arqueros', level: 3, yearsAtClub: 4 },
  { id: 'st-2', name: 'Rubén Ayala', role: 'Entrenador defensivo', level: 4, yearsAtClub: 2 },
  { id: 'st-3', name: 'Nicolás Bruno', role: 'Entrenador de mediocampistas', level: 3, yearsAtClub: 3 },
  { id: 'st-4', name: 'Darío Villalba', role: 'Entrenador ofensivo', level: 2, yearsAtClub: 1 },
  { id: 'st-5', name: 'Esteban Roldán', role: 'Preparador físico', level: 4, yearsAtClub: 5 },
  { id: 'st-6', name: 'Marcelo Ibáñez', role: 'Ojeador', level: 3, yearsAtClub: 2 },
  { id: 'st-7', name: 'Cristian Vega', role: 'Entrenador juvenil', level: 3, yearsAtClub: 6 },
  { id: 'st-8', name: 'Dra. Carla Méndez', role: 'Médico', level: 4, yearsAtClub: 7 },
  { id: 'st-9', name: 'Leandro Pizarro', role: 'Fisioterapeuta', level: 3, yearsAtClub: 2 },
  { id: 'st-10', name: 'Hernán Costa', role: 'Analista de rivales', level: 3, yearsAtClub: 3 },
  { id: 'st-11', name: 'Gustavo Pereyra', role: 'Secretario técnico', level: 4, yearsAtClub: 8 },
];

/**
 * Puestos sin cubrir. El ojeador juvenil se fue al final de la temporada
 * pasada y el club nunca tuvo psicólogo deportivo.
 */
export const DEMO_VACANCIES: readonly StaffVacancy[] = [
  {
    role: 'Ojeador juvenil',
    candidates: [
      { id: 'cand-1', name: 'Fabián Cardozo', level: 2, background: 'Diez años en el interior, red de contactos en Santa Fe y Entre Ríos.' },
      { id: 'cand-2', name: 'Walter Sandoval', level: 3, background: 'Venía de un club de Primera Nacional; encontró dos juveniles que hoy juegan en Europa.' },
      { id: 'cand-3', name: 'Mariela Ferrán', level: 4, background: 'Coordinó el scouting juvenil de una selección juvenil sudamericana.' },
    ],
  },
  {
    role: 'Psicólogo deportivo',
    candidates: [
      { id: 'cand-4', name: 'Lic. Sofía Arrieta', level: 2, background: 'Primer trabajo en fútbol profesional; viene del handball de alto rendimiento.' },
      { id: 'cand-5', name: 'Lic. Diego Ferraro', level: 4, background: 'Ocho años en un club de Primera; trabajó con planteles en zona de descenso.' },
    ],
  },
];

export const DEMO_FACILITIES: readonly ClubFacility[] = [
  { id: 'entrenamiento', level: 4 },
  { id: 'academia', level: 2 },
  { id: 'medico', level: 3 },
  { id: 'scouting', level: 2 },
  { id: 'oficinas', level: 3 },
];

export const DEMO_FINANCES: Finances = {
  cash: 418_500_000,
  transferBudget: 140_000_000,
  wageBill: 96_300_000,
  monthlyIncome: 182_400_000,
  monthlyExpenses: 151_700_000,
};

/**
 * Obras en curso al empezar. La ampliación de la tribuna sur es del estadio,
 * que se gestiona en la fase 6: acá figura como información, no como algo
 * que se pueda tocar todavía.
 */
export const DEMO_PROJECTS: readonly DevelopmentProject[] = [
  {
    id: 'pr-estadio-sur',
    kind: 'estadio',
    label: 'Ampliación de la tribuna sur',
    targetId: null,
    fromLevel: null,
    toLevel: null,
    weeksTotal: 18,
    weeksLeft: 7,
    cost: 96_000_000,
  },
];
