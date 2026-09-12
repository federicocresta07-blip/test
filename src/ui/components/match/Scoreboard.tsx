import type { ReactNode } from 'react';
import type { MatchRecord } from '../../models/index.ts';
import { clubById } from '../../data/clubs.ts';
import { ClubBadge } from '../ClubBadge.tsx';
import { decimal } from '../../lib/format.ts';

/**
 * MARCADOR DEL PARTIDO (secciones 14, 50).
 *
 * El resultado, y debajo lo que el motor esperaba antes de jugarlo. Mostrar
 * las dos cosas juntas es lo que convierte un numero en informacion: 1-0 con
 * 2,4 de xG a favor es un robo, y 1-0 con 0,6 es un golpe de suerte.
 */
export function Scoreboard({
  record,
  size = 'lg',
}: {
  readonly record: MatchRecord;
  readonly size?: 'md' | 'lg';
}): ReactNode {
  const home = clubById(record.homeClubId);
  const away = clubById(record.awayClubId);

  return (
    <div className={`scoreboard scoreboard--${size}`}>
      <div className="scoreboard__side scoreboard__side--home">
        <ClubBadge club={home} size={size === 'lg' ? 44 : 30} />
        <span className="scoreboard__name truncate">{home.name}</span>
      </div>

      <div className="scoreboard__result">
        <span className="scoreboard__goals tnum">
          {record.homeGoals} <span className="scoreboard__dash">—</span> {record.awayGoals}
        </span>
        <span className="scoreboard__round">Fecha {record.round}</span>
      </div>

      <div className="scoreboard__side scoreboard__side--away">
        <ClubBadge club={away} size={size === 'lg' ? 44 : 30} />
        <span className="scoreboard__name truncate">{away.name}</span>
      </div>
    </div>
  );
}

/**
 * Lo que el motor esperaba y lo que paso.
 *
 * `xg` es la calidad de las ocasiones que se generaron; las probabilidades
 * son las de antes de que rodara la pelota. Juntas explican si el resultado
 * fue merecido o no, que es lo que pide la seccion 51.
 */
export function ProjectionStrip({ record }: { readonly record: MatchRecord }): ReactNode {
  const { projection } = record;
  const home = clubById(record.homeClubId);
  const away = clubById(record.awayClubId);
  const total = projection.homeWin + projection.draw + projection.awayWin;
  const pct = (value: number): number => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className="projection">
      <div className="projection__row">
        <span className="projection__label">Goles esperados (xG)</span>
        <span className="projection__value tnum">
          {decimal(projection.xgHome, 2)} — {decimal(projection.xgAway, 2)}
        </span>
      </div>

      <div className="projection__row">
        <span className="projection__label">Antes de jugarse, el motor daba</span>
        <span className="projection__value tnum">
          {Math.round(pct(projection.homeWin))}% / {Math.round(pct(projection.draw))}% /{' '}
          {Math.round(pct(projection.awayWin))}%
        </span>
      </div>

      <div
        className="projection__bar"
        title={`${home.shortName} ${Math.round(pct(projection.homeWin))}% · empate ${Math.round(pct(projection.draw))}% · ${away.shortName} ${Math.round(pct(projection.awayWin))}%`}
      >
        <span
          className="projection__seg projection__seg--home"
          style={{ width: `${pct(projection.homeWin)}%` }}
        />
        <span
          className="projection__seg projection__seg--draw"
          style={{ width: `${pct(projection.draw)}%` }}
        />
        <span
          className="projection__seg projection__seg--away"
          style={{ width: `${pct(projection.awayWin)}%` }}
        />
      </div>
      <div className="projection__legend">
        <span>{home.shortName}</span>
        <span>empate</span>
        <span>{away.shortName}</span>
      </div>
    </div>
  );
}
