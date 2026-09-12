import type { ReactNode } from 'react';
import type { Club } from '../models/index.ts';
import { crestUrl } from '../data/crests.ts';

/**
 * Escudo del club.
 *
 * Cuando el club tiene escudo real disponible se usa ese; si no, se dibuja con
 * las iniciales y los colores institucionales, que es lo que hacia siempre
 * antes de la ingesta.
 *
 * El fallback no es decorativo: los cuatro clubes de la Primera Nacional no
 * estan en el repo de origen, y un `<img>` roto se ve peor que un escudo
 * dibujado. `crestUrl` devuelve null para esos y no se pide el archivo.
 *
 * Los escudos son SVG servidos como archivos estaticos desde `public/crests/`,
 * no van embebidos en el bundle: son 143 kB entre los veinte y el navegador
 * los cachea por separado del codigo.
 */
export function ClubBadge({
  club,
  size = 26,
}: {
  readonly club: Club;
  readonly size?: number;
}): ReactNode {
  const crest = crestUrl(club.id);

  if (crest) {
    return (
      <img
        className="clubbadge clubbadge--crest"
        src={crest}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        title={club.name}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className="clubbadge"
      style={{
        width: size,
        height: size,
        background: club.primaryColor,
        color: club.secondaryColor,
        fontSize: Math.max(7, Math.round(size * 0.3)),
        borderColor: club.secondaryColor,
      }}
      title={club.name}
      aria-hidden="true"
    >
      {club.badge}
    </span>
  );
}
