import type { ReactNode } from 'react';
import type { MatchEventLine } from '../../../competition/season.ts';
import type { MatchRecord } from '../../models/index.ts';
import { clubById } from '../../data/clubs.ts';

/**
 * MINUTO A MINUTO (seccion 14).
 *
 * No hay simulacion visual ni 2D: lo que hay es lo que paso, en orden, con el
 * minuto y el protagonista. De los partidos que no jugo el manager se guardan
 * solo los goles y las expulsiones, y la pantalla lo dice en lugar de mostrar
 * una lista corta como si fuera completa.
 */

const ICON: Record<string, string> = {
  gol: '⚽',
  amarilla: '▣',
  roja: '⊘',
  lesion: '✚',
  cambio: '⇄',
  'penal errado': '✕',
  ocasion: '○',
  atajada: '✋',
  instruccion: '≡',
};

export function MatchTimeline({ record }: { readonly record: MatchRecord }): ReactNode {
  if (record.events.length === 0) {
    return <p className="muted">Sin incidencias registradas.</p>;
  }

  const ordered = [...record.events].sort((a, b) => a.minute - b.minute);

  return (
    <>
      <ol className="timeline">
        {ordered.map((event, index) => (
          <TimelineRow
            key={`${event.minute}-${event.type}-${index}`}
            event={event}
            isHome={event.clubId === record.homeClubId}
          />
        ))}
      </ol>
      {!record.linesComplete && (
        <p className="timeline__note">
          De los partidos que no dirigís guardamos los goles y las expulsiones. El minuto a minuto
          completo —cambios, amarillas, lesiones— se guarda solo de los tuyos.
        </p>
      )}
    </>
  );
}

function TimelineRow({
  event,
  isHome,
}: {
  readonly event: MatchEventLine;
  readonly isHome: boolean;
}): ReactNode {
  return (
    <li className={`timeline__row ${isHome ? 'is-home' : 'is-away'} is-${event.type.replace(' ', '-')}`}>
      <span className="timeline__minute tnum">{event.minute}'</span>
      <span className="timeline__icon" aria-hidden="true">
        {ICON[event.type] ?? '·'}
      </span>
      <span className="timeline__body">
        <span className="timeline__who">{event.playerName || clubById(event.clubId).shortName}</span>
        <span className="timeline__detail">{event.detail}</span>
      </span>
    </li>
  );
}
