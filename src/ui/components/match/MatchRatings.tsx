import type { ReactNode } from 'react';
import type { MatchPlayerLine } from '../../../competition/season.ts';
import type { MatchRecord } from '../../models/index.ts';
import { clubById } from '../../data/clubs.ts';
import { DataTable } from '../ui/Table.tsx';
import { decimal } from '../../lib/format.ts';
import { ratingColor } from '../../lib/ratings.ts';

/**
 * NOTAS INDIVIDUALES (seccion 50).
 *
 * La nota la pone el motor a partir de lo que hizo el jugador: goles,
 * asistencias, ocasiones creadas, atajadas, goles recibidos, tarjetas y
 * rendimiento efectivo. Aca solo se muestra.
 *
 * La escala va de 3,0 a 10,0 y se colorea con la misma paleta que el overall,
 * para que un 8 se lea igual en toda la aplicacion.
 */
export function MatchRatings({
  record,
  clubId,
}: {
  readonly record: MatchRecord;
  readonly clubId: string;
}): ReactNode {
  const lines = record.lines
    .filter((line) => line.clubId === clubId)
    .slice()
    .sort((a, b) => Number(b.wasStarter) - Number(a.wasStarter) || b.minutes - a.minutes);

  if (lines.length === 0) {
    return (
      <p className="muted">
        De este partido no guardamos las notas individuales de {clubById(clubId).name}: solo se
        guardan las de los partidos que dirigís.
      </p>
    );
  }

  return (
    <>
      <DataTable>
        <thead>
          <tr>
            <th>Jugador</th>
            <th style={{ width: 44 }}>Pos</th>
            <th style={{ width: 46, textAlign: 'right' }}>Min</th>
            <th style={{ width: 34, textAlign: 'right' }} title="Goles">
              G
            </th>
            <th style={{ width: 34, textAlign: 'right' }} title="Asistencias">
              A
            </th>
            <th style={{ width: 46, textAlign: 'center' }}>Tarj.</th>
            <th style={{ width: 52, textAlign: 'right' }}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <RatingRow key={line.playerId} line={line} />
          ))}
        </tbody>
      </DataTable>
      {!record.linesComplete && (
        <p className="ratings__note">
          Solo los jugadores que hicieron algo: de los partidos ajenos no guardamos el plantel
          completo.
        </p>
      )}
    </>
  );
}

function RatingRow({ line }: { readonly line: MatchPlayerLine }): ReactNode {
  return (
    <tr className={line.wasStarter ? '' : 'is-sub'}>
      <td className="truncate">
        {line.playerName}
        {!line.wasStarter && <span className="ratings__sub"> · ingresó</span>}
        {line.injured && (
          <span className="ratings__flag is-injury" title="Salió lesionado">
            {' '}
            ✚
          </span>
        )}
      </td>
      <td className="secondary">{line.position}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {line.minutes}
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {line.goals > 0 ? line.goals : <span className="muted">—</span>}
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {line.assists > 0 ? line.assists : <span className="muted">—</span>}
      </td>
      <td style={{ textAlign: 'center' }}>
        {line.redCard ? (
          <span className="ratings__card is-red" title="Expulsado">
            ⊘
          </span>
        ) : line.yellowCards > 0 ? (
          <span className="ratings__card is-yellow" title={`${line.yellowCards} amarilla(s)`}>
            {'▣'.repeat(line.yellowCards)}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <span
          className="ratings__rating tnum"
          style={{ color: ratingColor(line.rating * 10) }}
          title="Nota del partido, de 3,0 a 10,0"
        >
          {decimal(line.rating, 1)}
        </span>
      </td>
    </tr>
  );
}
