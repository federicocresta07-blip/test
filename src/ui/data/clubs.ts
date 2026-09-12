/**
 * DATOS DE DEMOSTRACION — clubes (seccion 19).
 *
 * Los nombres de los clubes son reales porque son instituciones publicas y
 * sirven para que el prototipo se sienta creible. Todo lo demas (planteles,
 * finanzas, tabla) es INVENTADO y esta marcado como demo en la interfaz.
 */

import type { Club } from '../models/index.ts';

function club(
  id: string,
  name: string,
  shortName: string,
  badge: string,
  primaryColor: string,
  secondaryColor: string,
  stadiumName: string,
  division: Club['division'] = 'Primera División',
): Club {
  return { id, name, shortName, badge, primaryColor, secondaryColor, division, stadiumName };
}

export const CLUBS: readonly Club[] = [
  club('river', 'River Plate', 'RIV', 'CARP', '#e2001a', '#ffffff', 'Estadio Más Monumental'),
  club('boca', 'Boca Juniors', 'BOC', 'CABJ', '#0a3c8c', '#f2c500', 'La Bombonera'),
  club('racing', 'Racing Club', 'RAC', 'RC', '#6cace4', '#ffffff', 'El Cilindro'),
  club('independiente', 'Independiente', 'IND', 'CAI', '#d9202a', '#ffffff', 'Libertadores de América'),
  club('sanlorenzo', 'San Lorenzo', 'SLO', 'CASLA', '#0d2c6b', '#c8102e', 'Nuevo Gasómetro'),
  club('velez', 'Vélez Sarsfield', 'VEL', 'CAV', '#0b3c8d', '#ffffff', 'José Amalfitani'),
  club('estudiantes', 'Estudiantes', 'EST', 'EDLP', '#e2001a', '#ffffff', 'Jorge Luis Hirschi'),
  club('huracan', 'Huracán', 'HUR', 'CAH', '#e2001a', '#ffffff', 'Tomás Adolfo Ducó'),
  club('lanus', 'Lanús', 'LAN', 'CAL', '#7b2033', '#ffffff', 'La Fortaleza'),
  club('argentinos', 'Argentinos Juniors', 'ARG', 'AAAJ', '#e2001a', '#ffffff', 'Diego Maradona'),
  club('talleres', 'Talleres', 'TAL', 'CAT', '#0b3c8d', '#ffffff', 'Mario Alberto Kempes'),
  club('belgrano', 'Belgrano', 'BEL', 'CAB', '#6cace4', '#ffffff', 'Julio César Villagra'),
  club('newells', "Newell's Old Boys", 'NOB', 'NOB', '#e2001a', '#000000', 'Marcelo Bielsa'),
  club('rosario', 'Rosario Central', 'CEN', 'CARC', '#0b3c8d', '#f2c500', 'Gigante de Arroyito'),
  club('godoycruz', 'Godoy Cruz', 'GOD', 'GCAT', '#0b3c8d', '#ffffff', 'Feliciano Gambarte'),
  club('defensa', 'Defensa y Justicia', 'DYJ', 'DYJ', '#f2c500', '#0b7a3b', 'Norberto Tomaghello'),
  club('platense', 'Platense', 'PLA', 'CAP', '#8b1a1a', '#ffffff', 'Ciudad de Vicente López'),
  club('tigre', 'Tigre', 'TIG', 'CAT', '#0b3c8d', '#e2001a', 'José Dellagiovanna'),
  club('banfield', 'Banfield', 'BAN', 'CAB', '#0b7a3b', '#ffffff', 'Florencio Sola'),
  club('gimnasia', 'Gimnasia y Esgrima', 'GIM', 'GELP', '#0b3c8d', '#ffffff', 'Juan Carmelo Zerillo'),

  club('sanmartin', 'San Martín de Tucumán', 'SMT', 'CASM', '#e2001a', '#ffffff', 'La Ciudadela', 'Primera Nacional'),
  club('ferro', 'Ferro Carril Oeste', 'FER', 'FCO', '#0b7a3b', '#ffffff', 'Ricardo Etcheverri', 'Primera Nacional'),
  club('atlanta', 'Atlanta', 'ATL', 'CAA', '#f2c500', '#0b3c8d', 'Don León Kolbowski', 'Primera Nacional'),
  club('quilmes', 'Quilmes', 'QUI', 'QAC', '#0b3c8d', '#ffffff', 'Centenario', 'Primera Nacional'),
];

export const CLUBS_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));

export function clubById(id: string): Club {
  const found = CLUBS_BY_ID.get(id);
  if (!found) throw new Error(`Club desconocido: ${id}`);
  return found;
}
