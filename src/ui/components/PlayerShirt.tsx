import type { ReactNode } from 'react';
import { readableOn, outlineFor } from '../lib/club-colors.ts';

export type ShirtSize = 'xs' | 'sm' | 'md' | 'lg';

const PIXELS: Readonly<Record<ShirtSize, number>> = {
  xs: 20,
  sm: 26,
  md: 40,
  lg: 72,
};

/**
 * El cuerpo del dorsal, en unidades del viewBox.
 *
 * NO es el mismo para todos los tamaños, y por eso esta tabulado: el dibujo
 * mide 32 unidades y se escala al ancho pedido, asi que un cuerpo fijo de 12
 * se ve de 15px en la cancha y de 7,5px en la lista del plantel — ilegible
 * para un dorsal de dos cifras, que es la mitad del plantel. Se compensa al
 * reves: cuanto mas chica la camiseta, mas grande el numero respecto de ella.
 */
const NUMBER_SIZE: Readonly<Record<ShirtSize, number>> = {
  xs: 15,
  sm: 13.5,
  md: 12,
  lg: 11,
};

/**
 * LA CAMISETA: la firma visual de Mánager 6.0.
 *
 * Un jugador se reconoce por COLOR DEL CLUB + DORSAL + NOMBRE, sin foto. No es
 * sólo una decisión estética: las fotos de 462 jugadores serían 462 assets que
 * no existen, que habría que conseguir, que pesarían en un HTML autocontenido
 * de un mega y que no aportan nada que el dorsal no diga más rápido.
 *
 * ============================================================
 * NO AGREGA NI UN DATO AL MODELO
 * ============================================================
 *
 * Usa `primaryColor` y `secondaryColor`, que los veinte clubes ya tienen, y el
 * `shirtNumber` que ya viene del archivo del juego. Nada de esto es nuevo: lo
 * único nuevo es dibujarlo.
 *
 * Es SVG y no imagen: pesa menos que un PNG de un solo club, escala a
 * cualquier tamaño y se recolorea con los datos que ya están en memoria.
 *
 * ============================================================
 * EL DORSAL SE LEE SIEMPRE
 * ============================================================
 *
 * El color del número lo decide `readableOn`, que lo calcula contra el color
 * del club. Con blanco fijo, el dorsal de Belgrano (celeste) sería ilegible;
 * con negro fijo, el de River. Medido sobre los veinte clubes, el peor
 * contraste queda en 4,94:1 — arriba del mínimo de WCAG AA para texto.
 */
export function PlayerShirt({
  primary,
  secondary,
  number,
  size = 'md',
  clubName,
  className,
}: {
  readonly primary: string;
  readonly secondary: string;
  /** El dorsal. `null` cuando el jugador no tiene uno asignado. */
  readonly number?: number | null;
  readonly size?: ShirtSize;
  /** Para el nombre accesible: "Camiseta 9 de River Plate". */
  readonly clubName?: string;
  readonly className?: string;
}): ReactNode {
  const pixels = PIXELS[size];
  const ink = readableOn(primary);
  const outline = outlineFor(primary);
  const shown = number ?? null;

  const label =
    shown !== null
      ? `Camiseta ${shown}${clubName ? ` de ${clubName}` : ''}`
      : `Camiseta${clubName ? ` de ${clubName}` : ''}`;

  return (
    <svg
      className={['shirt', `shirt--${size}`, className ?? ''].filter(Boolean).join(' ')}
      width={pixels}
      height={pixels}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
    >
      {/* Mangas y cuello en el color secundario: es lo que distingue a dos
          clubes que comparten el principal (hay cinco rojos y seis azules). */}
      <path d="M11 4 L6 9 L9.5 12.5 L9.5 6.5 Z" fill={secondary} />
      <path d="M21 4 L26 9 L22.5 12.5 L22.5 6.5 Z" fill={secondary} />

      {/* El cuerpo. */}
      <path
        d="M11 4 H21 L26 9 L22.5 12.5 V29 H9.5 V12.5 L6 9 Z"
        fill={primary}
        stroke={outline}
        strokeWidth="0.75"
      />

      {/* El cuello, encima del cuerpo. */}
      <path d="M12.8 4 Q16 7.6 19.2 4 Z" fill={secondary} stroke={outline} strokeWidth="0.5" />

      {shown !== null && (
        <text
          x="16"
          y={size === 'xs' || size === 'sm' ? 24 : 23}
          textAnchor="middle"
          fill={ink}
          fontSize={NUMBER_SIZE[size]}
          fontWeight="700"
          // La tipografía es la del sistema, igual que en todo el resto: no se
          // carga ninguna fuente para esto.
          fontFamily="var(--font-sans)"
        >
          {shown}
        </text>
      )}
    </svg>
  );
}
