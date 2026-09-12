/**
 * TORNEO CLAUSURA 1998 — CLUBES PARTICIPANTES
 *
 * Los veinte equipos de la Primera División argentina del Clausura 1998,
 * segundo torneo de la temporada 1997-98 (16 de febrero al 8 de junio,
 * 19 fechas a una sola ronda).
 *
 * Los nombres, ciudades y colores son datos institucionales.
 *
 * OJO CON LOS ESTADIOS: varios se renombraron después de 1998. Acá va el
 * nombre que tenían ENTONCES, no el actual. Los casos que suelen confundirse:
 *
 *   - Newell's jugaba en el Coloso del Parque; recibió el nombre de Marcelo
 *     Bielsa en 2009.
 *   - Argentinos Juniors jugaba en su estadio de La Paternal; pasó a llamarse
 *     Diego Armando Maradona en 2003.
 *   - Independiente jugaba en La Doble Visera de cemento; el estadio actual
 *     es posterior a 2009.
 *
 * Donde no tengo certeza del nombre de época, el campo queda vacío antes que
 * afirmar algo que no verifiqué.
 */

export type HistoricalClub = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  /** Iniciales para el escudo. No se usan escudos reales. */
  readonly badge: string;
  readonly city: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  /** Nombre del estadio en 1998. Vacío si no lo pude verificar. */
  readonly stadium: string | null;
};

function club(
  id: string,
  name: string,
  shortName: string,
  badge: string,
  city: string,
  primaryColor: string,
  secondaryColor: string,
  stadium: string | null,
): HistoricalClub {
  return { id, name, shortName, badge, city, primaryColor, secondaryColor, stadium };
}

/** Los veinte clubes, en el orden final de la tabla del Clausura 1998. */
export const CLAUSURA_1998_CLUBS: readonly HistoricalClub[] = [
  club('velez', 'Vélez Sarsfield', 'VEL', 'CAV', 'Buenos Aires', '#0b3c8d', '#ffffff', 'José Amalfitani'),
  club('lanus', 'Lanús', 'LAN', 'CAL', 'Lanús', '#7b2033', '#ffffff', 'Ciudad de Lanús'),
  club('gimnasia', 'Gimnasia y Esgrima La Plata', 'GLP', 'GELP', 'La Plata', '#0b3c8d', '#ffffff', 'Juan Carmelo Zerillo'),
  club('jujuy', 'Gimnasia y Esgrima de Jujuy', 'GEJ', 'GEJ', 'San Salvador de Jujuy', '#0b3c8d', '#ffffff', '23 de Agosto'),
  club('sanlorenzo', 'San Lorenzo', 'SLO', 'CASLA', 'Buenos Aires', '#0d2c6b', '#c8102e', 'Nuevo Gasómetro'),
  club('boca', 'Boca Juniors', 'BOC', 'CABJ', 'Buenos Aires', '#0a3c8c', '#f2c500', 'La Bombonera'),
  club('river', 'River Plate', 'RIV', 'CARP', 'Buenos Aires', '#e2001a', '#ffffff', 'Monumental'),
  club('argentinos', 'Argentinos Juniors', 'ARG', 'AAAJ', 'Buenos Aires', '#e2001a', '#ffffff', null),
  club('newells', "Newell's Old Boys", 'NOB', 'NOB', 'Rosario', '#e2001a', '#000000', 'Coloso del Parque'),
  club('independiente', 'Independiente', 'IND', 'CAI', 'Avellaneda', '#d9202a', '#ffffff', 'La Doble Visera'),
  club('ferro', 'Ferro Carril Oeste', 'FER', 'FCO', 'Buenos Aires', '#0b7a3b', '#ffffff', 'Ricardo Etcheverri'),
  club('estudiantes', 'Estudiantes de La Plata', 'EST', 'EDLP', 'La Plata', '#e2001a', '#ffffff', 'Jorge Luis Hirschi'),
  club('central', 'Rosario Central', 'CEN', 'CARC', 'Rosario', '#0b3c8d', '#f2c500', 'Gigante de Arroyito'),
  club('platense', 'Platense', 'PLA', 'CAP', 'Vicente López', '#8b1a1a', '#ffffff', 'Ciudad de Vicente López'),
  club('racing', 'Racing Club', 'RAC', 'RC', 'Avellaneda', '#6cace4', '#ffffff', 'Presidente Perón'),
  club('colon', 'Colón', 'COL', 'CAC', 'Santa Fe', '#e2001a', '#000000', 'Brigadier General Estanislao López'),
  club('gimnasiatiro', 'Gimnasia y Tiro de Salta', 'GYT', 'GYT', 'Salta', '#0b7a3b', '#ffffff', null),
  club('huracan', 'Huracán', 'HUR', 'CAH', 'Buenos Aires', '#e2001a', '#ffffff', 'Tomás Adolfo Ducó'),
  club('union', 'Unión', 'UNI', 'CAU', 'Santa Fe', '#e2001a', '#ffffff', '15 de Abril'),
  club('espanol', 'Deportivo Español', 'ESP', 'CDE', 'Buenos Aires', '#e2001a', '#ffffff', 'Nueva España'),
];

const BY_ID = new Map(CLAUSURA_1998_CLUBS.map((c) => [c.id, c]));

export function clausura1998Club(id: string): HistoricalClub {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Club desconocido en el Clausura 1998: ${id}`);
  return found;
}
