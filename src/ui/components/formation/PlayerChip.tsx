import type { ReactNode } from 'react';
import type { Position } from '../../../domain/positions.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { overallInSlot } from '../../lib/engine-bridge.ts';
import { ratingColor } from '../../lib/ratings.ts';
import { playerStatuses } from '../player/PlayerCells.tsx';
import { StatusBadge } from '../ui/Badge.tsx';

/**
 * FICHA DE JUGADOR EN LA CANCHA (seccion 6.3).
 *
 * Dorsal, apellido, puesto y overall. La lectura tiene que ser inmediata:
 *
 *    (9)
 *    ARRIAGA
 *    87
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
  const overall = overallInSlot(entry.player, assigned);
  const statuses = playerStatuses(entry).filter(
    (item) => item.status !== 'forma' && item.status !== 'baja-forma',
  );
  const surname = lastName(entry.player.name);

  return (
    <span className={`chip ${compact ? 'chip--compact' : ''} ${overall.isNatural ? '' : 'chip--outofposition'}`}>
      <span className="chip__top">
        <span className="chip__number tnum">{entry.shirtNumber}</span>
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
