/**
 * LOS COLORES DEL CLUB, LEIDOS.
 *
 * El juego ya guarda `primaryColor` y `secondaryColor` de los veinte clubes
 * (`data/clubs.ts`). Esto NO agrega datos: sólo responde las preguntas que la
 * camiseta necesita hacerle a un color.
 *
 * ============================================================
 * POR QUE HACE FALTA CALCULAR Y NO ELEGIR
 * ============================================================
 *
 * El dorsal va escrito sobre el color del club. Con blanco fijo, Belgrano
 * (#6cace4, celeste) queda con un número ilegible; con negro fijo, River
 * (#e2001a) también. Son veinte clubes y sus colores son dato, así que el
 * color del dorsal se DERIVA del fondo en lugar de decidirse a mano club por
 * club — que además habría que rehacer el día que se agregue un club.
 *
 * La cuenta es la de WCAG: luminancia relativa y razón de contraste. No es
 * rigor de más: un dorsal que no se lee rompe justo la señal que la camiseta
 * viene a dar.
 */

/** Un `#rrggbb` a sus tres canales 0..255. Devuelve `null` si no es un color. */
function channels(hex: string): readonly [number, number, number] | null {
  const value = hex.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (match === null) return null;
  const digits = match[1] ?? '';
  return [
    Number.parseInt(digits.slice(0, 2), 16),
    Number.parseInt(digits.slice(2, 4), 16),
    Number.parseInt(digits.slice(4, 6), 16),
  ];
}

/** Luminancia relativa (WCAG 2.1), 0 = negro, 1 = blanco. */
export function luminance(hex: string): number {
  const rgb = channels(hex);
  if (rgb === null) return 0;
  const linear = rgb.map((raw) => {
    const channel = raw / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Razón de contraste entre dos colores, de 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

/** Blanco o casi negro: el que se lea mejor sobre este fondo. */
export function readableOn(background: string): string {
  const white = '#ffffff';
  const ink = '#0b1220';
  return contrastRatio(white, background) >= contrastRatio(ink, background) ? white : ink;
}

/**
 * El color del contorno de la camiseta.
 *
 * Una camiseta blanca sobre el panel azul necesita un borde que la separe del
 * fondo; una oscura no, y con borde claro parecería recortada. Así que el
 * contorno se decide por lo claro que sea el color del club.
 */
export function outlineFor(primary: string): string {
  return luminance(primary) > 0.45 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.28)';
}
