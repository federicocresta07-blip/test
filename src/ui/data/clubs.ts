/**
 * LOS CLUBES DEL TORNEO — Apertura 1998.
 *
 * Ya no son datos de demostracion: los veinte clubes de Primera, sus nombres
 * largos, sus estadios y sus capacidades salen de `EQ003003.PKF`, el archivo
 * de equipos de PC Apertura 6.0, via `src/data/apertura98.ts`.
 *
 * Lo unico que NO sale del archivo son los colores institucionales y las
 * siglas del badge: el formato PKF no los guarda. Estan declarados en el
 * generador y son dato nuestro.
 *
 * Los cuatro clubes de la Primera Nacional son entradas de club sin plantel.
 * Existen para el mercado y los ascensos; su torneo no se simula, y la
 * pantalla de tabla lo dice.
 */

import type { Club } from '../models/index.ts';
import { APERTURA98_CLUBS } from '../../data/apertura98.ts';

/** Los veinte de Primera, derivados del archivo del juego. */
const PRIMERA: readonly Club[] = APERTURA98_CLUBS.map((club) => ({
  id: club.id,
  name: club.name,
  shortName: club.shortName,
  badge: club.badge,
  primaryColor: club.primaryColor,
  secondaryColor: club.secondaryColor,
  division: 'Primera División' as const,
  stadiumName: club.stadium ?? 'Estadio sin nombre en el archivo',
}));

/**
 * Cuatro clubes del ascenso. Estan en el PKF como equipos de liga nacional
 * —con plantel y todo— pero su torneo no se simula, asi que aca entran solo
 * como club. Los nombres y estadios tambien salen del archivo.
 */
const NACIONAL: readonly Club[] = [
  {
    id: 'tigre', name: 'Club Atlético Tigre', shortName: 'Tigre', badge: 'CAT',
    primaryColor: '#0b3c8d', secondaryColor: '#e2001a',
    division: 'Primera Nacional', stadiumName: 'José Dellagiovanna',
  },
  {
    id: 'quilmes', name: 'Quilmes Atlético Club', shortName: 'Quilmes', badge: 'QAC',
    primaryColor: '#0b3c8d', secondaryColor: '#ffffff',
    division: 'Primera Nacional', stadiumName: 'Centenario José Luis Meiszner',
  },
  {
    id: 'atlanta', name: 'Club Atlético Atlanta', shortName: 'Atlanta', badge: 'CAA',
    primaryColor: '#f2c500', secondaryColor: '#0b3c8d',
    division: 'Primera Nacional', stadiumName: 'Don León Kolbowski',
  },
  {
    id: 'sanmartin', name: 'Club Atlético San Martín de Tucumán', shortName: 'San Martín (Tuc)',
    badge: 'CASM', primaryColor: '#e2001a', secondaryColor: '#ffffff',
    division: 'Primera Nacional', stadiumName: 'La Ciudadela',
  },
];

export const CLUBS: readonly Club[] = [...PRIMERA, ...NACIONAL];

export const CLUBS_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));

export function clubById(id: string): Club {
  const found = CLUBS_BY_ID.get(id);
  if (!found) throw new Error(`Club desconocido: ${id}`);
  return found;
}
