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

/**
 * LA CAJA CON LA QUE ARRANCA EL CLUB.
 *
 * Es el UNICO numero de finanzas que sigue escrito a mano, porque es el punto
 * de partida de la partida y no se puede calcular de nada.
 *
 * Acá había cinco:
 *
 *     cash, transferBudget, wageBill, monthlyIncome, monthlyExpenses
 *
 * La masa salarial se fue en la fase 3 (es la suma de los contratos) y los
 * otros tres en la fase 6: los calcula `domain/finances.ts` a partir de los
 * socios reales del club, de los partidos que se jugaron, de la reputación y
 * de los sueldos. Tenerlos acá hacía que el juego mintiera: se podía vender a
 * medio plantel y el presupuesto de fichajes quedaba igual.
 */
export const OPENING_CASH = 418_500_000;

/**
 * Obras en curso al empezar: NINGUNA.
 *
 * Acá había una ampliación de la tribuna sur escrita a mano, con 7 de 18
 * semanas cumplidas, que no se podía tocar y nunca terminaba: cada vez que se
 * cargaba la partida volvía a estar en la semana 7. Era decorado.
 *
 * Ahora las obras del estadio son reales (fase 6): las encara el manager desde
 * la pantalla de Estadio, las semanas bajan al jugar cada fecha y al terminar
 * los asientos entran a la capacidad. La lista de obras se deriva del estado,
 * así que este arreglo está vacío a propósito.
 */
export const DEMO_PROJECTS: readonly DevelopmentProject[] = [];
