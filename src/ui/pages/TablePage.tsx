import { useMemo, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { FormStrip } from '../components/dashboard/NextMatchCard.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { CLUBS } from '../data/clubs.ts';
import { seasonTable } from '../lib/season-bridge.ts';
import type { TableRow } from '../../competition/table.ts';

/**
 * TABLA DE POSICIONES (seccion 13) — fase 7 del plan.
 *
 * No hay ninguna fila escrita a mano: la tabla se calcula desde los partidos
 * que se jugaron. Por eso en la fecha 1 esta toda en cero, que es la verdad,
 * en lugar de mostrar un torneo a medio jugar que nunca ocurrio.
 *
 * La Primera Nacional aparece con lo que hay: los cuatro clubes existen en el
 * juego pero su torneo todavia no se simula, y la pantalla lo dice.
 */
export function TablePage(): ReactNode {
  const state = useGameState();
  const table = useMemo(() => seasonTable(state.season.records), [state.season.records]);
  const played = table[0]?.played ?? 0;

  const nacional = CLUBS.filter((club) => club.division === 'Primera Nacional');

  return (
    <div className="page">
      <Panel
        title="Primera División"
        subtitle={
          played === 0
            ? 'Todavía no se jugó ninguna fecha'
            : `${played} ${played === 1 ? 'fecha jugada' : 'fechas jugadas'} de ${state.season.totalRounds}`
        }
        actions={
          <Link to="/competicion/calendario">
            <Button size="sm" variant={played === 0 ? 'primary' : 'ghost'}>
              {played === 0 ? 'Jugar la primera fecha' : 'Ir al calendario'}
            </Button>
          </Link>
        }
        padded={false}
      >
        <DataTable>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>Club</th>
              <th style={{ width: 34, textAlign: 'right' }}>PJ</th>
              <th style={{ width: 30, textAlign: 'right' }}>G</th>
              <th style={{ width: 30, textAlign: 'right' }}>E</th>
              <th style={{ width: 30, textAlign: 'right' }}>P</th>
              <th style={{ width: 38, textAlign: 'right' }}>GF</th>
              <th style={{ width: 38, textAlign: 'right' }}>GC</th>
              <th style={{ width: 42, textAlign: 'right' }}>DG</th>
              <th style={{ width: 42, textAlign: 'right' }}>Pts</th>
              <th style={{ width: 96 }}>Forma</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <Row key={row.clubId} row={row} isOwn={row.clubId === state.club.id} />
            ))}
          </tbody>
        </DataTable>
      </Panel>

      <Panel
        title="Primera Nacional"
        subtitle="Los clubes existen en el juego; su torneo todavía no se simula"
      >
        <EmptyState
          title="Todavía no hay torneo de segunda"
          detail={`${nacional.map((club) => club.name).join(', ')} están en el juego para los ascensos y el mercado, pero su campeonato se simula más adelante. Preferimos decirlo antes que mostrar una tabla inventada.`}
        />
      </Panel>
    </div>
  );
}

function Row({ row, isOwn }: { readonly row: TableRow; readonly isOwn: boolean }): ReactNode {
  const club = clubById(row.clubId);
  return (
    <tr className={isOwn ? 'is-own' : ''}>
      <td className="tnum secondary">{row.position}</td>
      <td>
        <span className="tablerow__club">
          <ClubBadge club={club} size={20} />
          <Link to={`/informacion/rivales/${club.id}`} className="truncate">
            {club.name}
          </Link>
        </span>
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.played}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.won}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.drawn}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.lost}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.goalsFor}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{row.goalsAgainst}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>
        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
      </td>
      <td className="tnum tablerow__points" style={{ textAlign: 'right' }}>{row.points}</td>
      <td>
        <FormStrip form={row.form} />
      </td>
    </tr>
  );
}
