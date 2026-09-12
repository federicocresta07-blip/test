import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { Button } from '../ui/Button.tsx';
import { ClubBadge } from '../ClubBadge.tsx';
import { Link } from '../../router/router.tsx';
import { useGameState } from '../../state/GameProvider.tsx';
import { clubById } from '../../data/clubs.ts';
import { DEMO_LAST_ROUND } from '../../data/competition.ts';
import { outcomeFor, recentFixtures, tablePosition } from '../../lib/fixtures.ts';
import { shortDate } from '../../lib/format.ts';
import type { LeagueRow } from '../../models/index.ts';

/**
 * COMPETICION (secciones 5.5, 13).
 *
 * Tabla resumida alrededor de la posicion del club y los ultimos resultados.
 * Los clubes son entidades clickeables: la navegacion a su perfil es fase 7.
 */
export function CompetitionWidget(): ReactNode {
  const state = useGameState();
  const position = tablePosition(state, state.club.id);
  const rows = windowAround(state.table, position - 1, 5);
  const own = recentFixtures(state, 3);

  return (
    <Panel
      title="Competición"
      subtitle={state.seasonLabel}
      actions={
        <Link to="/competicion/tabla">
          <Button size="sm" variant="ghost">
            Tabla completa
          </Button>
        </Link>
      }
    >
      <table className="minitable">
        <thead>
          <tr>
            <th style={{ width: 22 }}>#</th>
            <th>Club</th>
            <th style={{ width: 26, textAlign: 'right' }}>PJ</th>
            <th style={{ width: 30, textAlign: 'right' }}>DG</th>
            <th style={{ width: 30, textAlign: 'right' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, index }) => {
            const club = clubById(row.clubId);
            const isOwn = row.clubId === state.club.id;
            return (
              <tr key={row.clubId} className={isOwn ? 'is-own' : ''}>
                <td className="tnum muted">{index + 1}</td>
                <td>
                  <span className="row" style={{ gap: 'var(--sp-3)' }}>
                    <ClubBadge club={club} size={16} />
                    <span className="truncate">{club.shortName}</span>
                  </span>
                </td>
                <td className="tnum" style={{ textAlign: 'right' }}>
                  {row.played}
                </td>
                <td className="tnum" style={{ textAlign: 'right' }}>
                  {row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}
                  {row.goalsFor - row.goalsAgainst}
                </td>
                <td className="tnum" style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)' }}>
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="lastresults">
        <span className="label">Nuestros últimos partidos</span>
        <ul>
          {own.map((fixture) => {
            const result = outcomeFor(fixture, state.club.id);
            const rivalId =
              fixture.homeClubId === state.club.id ? fixture.awayClubId : fixture.homeClubId;
            return (
              <li key={fixture.id} className="resultrow">
                <span className={`resultrow__badge is-${result}`}>{result}</span>
                <span className="truncate">
                  {fixture.homeClubId === state.club.id ? 'vs' : 'en'} {clubById(rivalId).shortName}
                </span>
                <span className="tnum resultrow__score">
                  {fixture.score?.home}-{fixture.score?.away}
                </span>
                <span className="muted tnum">{shortDate(fixture.date)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="lastresults">
        <span className="label">Fecha {DEMO_LAST_ROUND[0]?.round ?? ''} en la división</span>
        <ul>
          {DEMO_LAST_ROUND.slice(1, 4).map((fixture) => (
            <li key={fixture.id} className="resultrow">
              <span className="truncate secondary">
                {clubById(fixture.homeClubId).shortName} — {clubById(fixture.awayClubId).shortName}
              </span>
              <span className="tnum resultrow__score">
                {fixture.score?.home}-{fixture.score?.away}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Ventana de la tabla centrada en la posicion del club. */
function windowAround(
  table: readonly LeagueRow[],
  index: number,
  size: number,
): readonly { row: LeagueRow; index: number }[] {
  const half = Math.floor(size / 2);
  let start = Math.max(0, index - half);
  if (start + size > table.length) start = Math.max(0, table.length - size);
  return table.slice(start, start + size).map((row, offset) => ({ row, index: start + offset }));
}
