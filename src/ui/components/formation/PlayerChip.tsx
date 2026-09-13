import type { ReactNode } from 'react';
import type { Position } from '../../../domain/positions.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { overallInSlot } from '../../lib/engine-bridge.ts';
import { ratingColor } from '../../lib/ratings.ts';
import { playerStatuses } from '../player/PlayerCells.tsx';
import { StatusBadge } from '../ui/Badge.tsx';
import { PlayerShirt } from '../PlayerShirt.tsx';
import { useGame } from '../../state/GameProvider.tsx';

/**
 * FICHA DE JUGADOR EN LA CANCHA (seccion 6.3) — MANAGER 6.0.
 *
 * CAMISETA, apellido y overall. La lectura tiene que ser inmediata:
 *
 *    [camiseta con el 9]
 *    ARRIAGA
 *    87
 *
 * ============================================================
 * ANTES ERA UNA TARJETA, Y ESO COMPETIA CON LA CANCHA
 * ============================================================
 *
 * La ficha tenia fondo opaco, borde y sombra: once tarjetas oscuras encima del
 * cesped, todas iguales, sin decir de que equipo eran. El dorsal era un numero
 * gris de nueve pixeles arriba del apellido.
 *
 * Ahora el objeto es la CAMISETA y no hay tarjeta: el color del club y el
 * dorsal hacen el trabajo que hacia el borde, y el cesped se ve entre los
 * jugadores. El apellido va sobre una banda minima —lo justo para que se lea
 * sobre el verde— y el overall es una pastilla chica.
 *
 * Si juega fuera de su puesto, el overall que se muestra es el EFECTIVO y la
 * ficha lo marca. El numero lo calcula el motor (seccion 6.5).
 */
export function PlayerChip({
  entry,
  assigned,
  compact = false,
}: {
  readonly entry: ClubPlayer;
  readonly assigned: Position;
  readonly compact?: boolean;
}): ReactNode {
  const { state } = useGame();
  const overall = overallInSlot(entry.player, assigned);
  const statuses = playerStatuses(entry).filter(
    (item) => item.status !== 'forma' && item.status !== 'baja-forma',
  );
  const surname = lastName(entry.player.name);

  // Los colores son los del club que se dirige, que ya estan en el estado. Si
  // el estado todavia no cargo —no pasa en la cancha, pero el tipo lo
  // permite— la camiseta sale en los colores del producto en lugar de romper.
  const primary = state?.club.primaryColor ?? 'var(--surface-3)';
  const secondary = state?.club.secondaryColor ?? 'var(--border-strong)';

  return (
    <span className={`chip ${compact ? 'chip--compact' : ''} ${overall.isNatural ? '' : 'chip--outofposition'}`}>
      <span className="chip__kit">
        <PlayerShirt
          primary={primary}
          secondary={secondary}
          number={entry.shirtNumber}
          size={compact ? 'sm' : 'md'}
          {...(state ? { clubName: state.club.shortName } : {})}
        />
        {!overall.isNatural && (
          <span className="chip__natural" title={`Puesto natural: ${entry.player.position}`}>
            {entry.player.position}
          </span>
        )}
      </span>
      <span className="chip__name truncate">{surname}</span>
      <span className="chip__bottom">
        <span className="chip__ovr tnum" style={{ color: ratingColor(overall.effective) }}>
          {overall.effective}
        </span>
        {!overall.isNatural && (
          <span className="chip__delta tnum" title={`Overall natural ${overall.natural}`}>
            {overall.effective - overall.natural}
          </span>
        )}
        {statuses.length > 0 && (
          <span className="chip__statuses">
            {statuses.slice(0, 2).map((item) => (
              <StatusBadge key={item.status} status={item.status} detail={item.detail} />
            ))}
          </span>
        )}
      </span>
    </span>
  );
}

/** Apellido para la ficha: es lo que se lee de un vistazo. */
export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0]) ?? fullName;
}
