import type { ReactNode } from 'react';
import type { Club } from '../models/index.ts';

/**
 * Escudo del club. No usamos escudos reales: se dibuja con las iniciales y
 * los colores institucionales, que es suficiente para identificarlo y evita
 * usar assets propietarios (seccion 15).
 */
export function ClubBadge({
  club,
  size = 26,
}: {
  readonly club: Club;
  readonly size?: number;
}): ReactNode {
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
