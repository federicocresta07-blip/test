import type { ReactNode } from 'react';
import type { TeamMatchStats } from '../../../engine/match-types.ts';
import type { MatchRecord } from '../../models/index.ts';
import { clubById } from '../../data/clubs.ts';
import { decimal } from '../../lib/format.ts';

/**
 * ESTADISTICAS DEL PARTIDO (seccion 50).
 *
 * Las quince que devuelve el motor, enfrentadas. La barra del medio no es
 * decoracion: hace visible de un vistazo quien domino cada aspecto, que es la
 * pregunta que uno le hace a esta tabla.
 */

type Row = {
  readonly label: string;
  readonly home: number;
  readonly away: number;
  /** Como se muestra el numero. */
  readonly format?: 'entero' | 'decimal' | 'porcentaje';
  readonly hint?: string;
};

function rowsOf(home: TeamMatchStats, away: TeamMatchStats): readonly Row[] {
  return [
    { label: 'Posesión', home: home.possession, away: away.possession, format: 'porcentaje' },
    { label: 'Remates', home: home.shots, away: away.shots },
    { label: 'Al arco', home: home.shotsOnTarget, away: away.shotsOnTarget },
    {
      label: 'Goles esperados (xG)',
      home: home.xg,
      away: away.xg,
      format: 'decimal',
      hint: 'Suma de la calidad de las ocasiones generadas',
    },
    {
      label: 'Ocasiones claras',
      home: home.bigChances,
      away: away.bigChances,
      hint: 'Ocasiones con más de 0,30 de xG',
    },
    {
      label: 'Claras erradas',
      home: home.bigChancesMissed,
      away: away.bigChancesMissed,
    },
    { label: 'Atajadas', home: home.saves, away: away.saves },
    { label: 'Córners', home: home.corners, away: away.corners },
    {
      label: 'Remates de pelota parada',
      home: home.setPieceShots,
      away: away.setPieceShots,
    },
    {
      label: 'Remates de contraataque',
      home: home.counterAttackShots,
      away: away.counterAttackShots,
    },
    { label: 'Penales', home: home.penalties, away: away.penalties },
    { label: 'Faltas', home: home.fouls, away: away.fouls },
    { label: 'Amarillas', home: home.yellowCards, away: away.yellowCards },
    { label: 'Rojas', home: home.redCards, away: away.redCards },
  ];
}

function show(value: number, format: Row['format']): string {
  if (format === 'porcentaje') return `${Math.round(value * 100)}%`;
  if (format === 'decimal') return decimal(value, 2);
  return String(Math.round(value));
}

/**
 * La posesion de los dos equipos, que tiene que sumar 100.
 *
 * Redondear los dos lados por separado da 52% y 49%: 0,515 y 0,485 redondean
 * los dos para arriba. Se redondea el local y el visitante es el resto.
 */
function possessionPair(home: number): readonly [string, string] {
  const local = Math.round(home * 100);
  return [`${local}%`, `${100 - local}%`];
}

export function MatchStats({ record }: { readonly record: MatchRecord }): ReactNode {
  const rows = rowsOf(record.homeStats, record.awayStats);

  return (
    <div className="matchstats">
      <header className="matchstats__head">
        <span className="matchstats__club truncate">{clubById(record.homeClubId).shortName}</span>
        <span />
        <span className="matchstats__club matchstats__club--away truncate">
          {clubById(record.awayClubId).shortName}
        </span>
      </header>

      {rows.map((row) => {
        const total = row.home + row.away;
        const share = total > 0 ? (row.home / total) * 100 : 50;
        const pair =
          row.format === 'porcentaje'
            ? possessionPair(row.home)
            : ([show(row.home, row.format), show(row.away, row.format)] as const);
        return (
          <div className="matchstats__row" key={row.label} title={row.hint}>
            <span className="matchstats__value tnum">{pair[0]}</span>
            <div className="matchstats__middle">
              <span className="matchstats__label">{row.label}</span>
              <div className="matchstats__bar">
                <span className="matchstats__fill" style={{ width: `${share}%` }} />
              </div>
            </div>
            <span className="matchstats__value matchstats__value--away tnum">{pair[1]}</span>
          </div>
        );
      })}
    </div>
  );
}
