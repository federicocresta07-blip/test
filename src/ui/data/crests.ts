/**
 * QUE CLUBES TIENEN ESCUDO REAL.
 *
 * Generado por `node scripts/crests.mjs`. No editar a mano.
 *
 * Los escudos son los oficiales de cada club, en vectorial, tomados de FCLOGO
 * (https://github.com/FCLOGO/fclogo.top, MIT) y optimizados. Viven en
 * `public/crests/<id>.svg` y se sirven como archivos estaticos: no van
 * embebidos en el bundle.
 *
 * Los escudos de los clubes son marcas registradas de cada club. Se usan para
 * identificarlo, que es para lo que existen; no hay vinculo ni aval de los
 * clubes con este proyecto.
 */

/** Ids de club con escudo real disponible. */
export const CLUBS_WITH_CREST: ReadonlySet<string> = new Set([
  'boca',
  'river',
  'argentinos',
  'belgrano',
  'colon',
  'estudiantes',
  'gimnasia',
  'huracan',
  'independiente',
  'lanus',
  'newells',
  'platense',
  'racing',
  'central',
  'sanlorenzo',
  'talleres',
  'union',
  'velez',
  'tigre',
]);

/**
 * Los que a proposito no tienen, con el motivo. Que el hueco este declarado
 * es lo que permite que un test verifique que no falta ninguno por descuido.
 */
export const CRESTS_MISSING: Readonly<Record<string, string>> = {
  ferro: 'Ferro Carril Oeste no está en la carpeta de AFA del repo de origen',
  jujuy: 'Gimnasia y Esgrima de Jujuy no está en el repo de origen',
  quilmes: 'no está en la carpeta de AFA del repo de origen',
  atlanta: 'no está en la carpeta de AFA del repo de origen',
  sanmartin: 'el repo de origen tiene el San Martín de San Juan, no el de Tucumán',
};

export function crestUrl(clubId: string): string | null {
  return CLUBS_WITH_CREST.has(clubId) ? `crests/${clubId}.svg` : null;
}
