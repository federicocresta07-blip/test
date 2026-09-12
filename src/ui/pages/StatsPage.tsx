import { useMemo, useState, type ReactNode } from 'react';
import {
  averageRating,
  bestRated,
  topAssists,
  topScorers,
  type PlayerSeasonTotals,
} from '../../competition/stats.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { DataTable } from '../components/ui/Table.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { decimal } from '../lib/format.ts';
import { ratingColor } from '../lib/ratings.ts';

/**
 * ESTADISTICAS DEL TORNEO (seccion 13) — fase 7 del plan.
 *
 * Goleadores, asistencias y notas, acumulados desde los partidos.
 *
 * Hay una limitacion que la pantalla declara en lugar de esconder: las notas
 * y los minutos solo se guardan de los partidos que dirige el manager. De un
 * partido entre dos clubes de IA sabemos quien convirtio, pero no cuantos
 * minutos jugo el resto. Por eso la columna de nota dice sobre cuantos
 * partidos se calcula, y la tabla de mejores notas pide un minimo.
 */

type Tab = 'goleadores' | 'asistencias' | 'notas';

export function StatsPage(): ReactNode {
  const state = useGameState();
  const [tab, setTab] = useState<Tab>('goleadores');

  const lists = useMemo(
    () => ({
      goleadores: topScorers(state.season.totals, 20),
      asistencias: topAssists(state.season.totals, 20),
      notas: bestRated(state.season.totals, 3, 20),
    }),
    [state.season.totals],
  );

  if (state.season.records.length === 0) {
    return (
      <div className="page page--narrow">
        <Panel title="Estadísticas del torneo">
          <EmptyState
            title="Todavía no hay estadísticas"
            detail="Los goleadores, las asistencias y las notas se acumulan partido a partido. Jugá la primera fecha y esto se empieza a llenar."
            action={
              <Link to="/competicion/calendario">
                <Button variant="primary">Ir al calendario</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const shown = lists[tab];

  return (
    <div className="page">
      <Panel
        title="Estadísticas del torneo"
        subtitle={`Acumulado de ${state.season.records.length} partidos`}
        actions={
          <Tabs
            items={[
              { id: 'goleadores', label: 'Goleadores', count: lists.goleadores.length },
              { id: 'asistencias', label: 'Asistencias', count: lists.asistencias.length },
              { id: 'notas', label: 'Mejores notas', count: lists.notas.length },
            ]}
            active={tab}
            onChange={setTab}
            size="sm"
          />
        }
        padded={false}
      >
        {shown.length === 0 ? (
          <div style={{ padding: 'var(--sp-6)' }}>
            <EmptyState
              title={
                tab === 'notas'
                  ? 'Todavía nadie llegó a tres partidos con nota'
                  : 'Todavía no hay nada para mostrar acá'
              }
              {...(tab === 'notas'
                ? {
                    detail:
                      'Pedimos un mínimo de tres partidos: con uno solo, el que sacó 8,5 una vez le ganaría al que promedia 7,4 en quince fechas, y eso no informa nada.',
                  }
                : {})}
            />
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Jugador</th>
                <th style={{ width: 120 }}>Club</th>
                <th style={{ width: 42, textAlign: 'right' }}>PJ</th>
                <th style={{ width: 42, textAlign: 'right' }}>Goles</th>
                <th style={{ width: 42, textAlign: 'right' }}>Asist.</th>
                <th style={{ width: 82, textAlign: 'right' }}>Nota media</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry, index) => (
                <StatRow
                  key={entry.playerId}
                  entry={entry}
                  position={index + 1}
                  isOwn={entry.clubId === state.club.id}
                />
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <Panel title="Sobre estos números">
        <div className="clubnotes">
          <p>
            Todo esto sale de los partidos: no hay ninguna lista cargada a mano. Los goles y las
            asistencias se cuentan de los veinte clubes, porque de cada partido guardamos a los
            jugadores que hicieron algo.
          </p>
          <p>
            Las <strong>notas y los minutos</strong>, en cambio, solo se guardan de los partidos que
            dirigís. De un partido entre dos clubes de IA sabemos quién convirtió, pero no cuántos
            minutos jugó el resto del plantel, y sumar cero minutos a alguien que jugó los noventa
            sería peor que no sumar nada. Por eso la columna de nota dice entre paréntesis sobre
            cuántos partidos se calcula, y un jugador ajeno va a tener una o dos: las veces que
            enfrentó a tu equipo.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function StatRow({
  entry,
  position,
  isOwn,
}: {
  readonly entry: PlayerSeasonTotals;
  readonly position: number;
  readonly isOwn: boolean;
}): ReactNode {
  const club = clubById(entry.clubId);
  const average = averageRating(entry);

  return (
    <tr className={isOwn ? 'is-own' : ''}>
      <td className="tnum secondary">{position}</td>
      <td className="truncate">{entry.playerName}</td>
      <td>
        <span className="tablerow__club">
          <ClubBadge club={club} size={18} />
          <span className="truncate secondary">{club.shortName}</span>
        </span>
      </td>
      <td className="tnum" style={{ textAlign: 'right' }}>{entry.appearances}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{entry.goals}</td>
      <td className="tnum" style={{ textAlign: 'right' }}>{entry.assists}</td>
      <td style={{ textAlign: 'right' }}>
        {average === null ? (
          <span className="muted" title="No guardamos notas de los partidos que no dirigís">
            —
          </span>
        ) : (
          <span
            className="tnum"
            style={{ color: ratingColor(average * 10) }}
            title={`Promedio de ${entry.ratedMatches} ${entry.ratedMatches === 1 ? 'partido' : 'partidos'} con nota guardada`}
          >
            {decimal(average, 2)}{' '}
            <span className="muted">({entry.ratedMatches})</span>
          </span>
        )}
      </td>
    </tr>
  );
}
