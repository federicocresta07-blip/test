import { useState, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { decimal } from '../lib/format.ts';
import type { MatchRecord } from '../models/index.ts';

/**
 * RESULTADOS (seccion 13) — fase 7 del plan.
 *
 * Fecha por fecha, con acceso a la ficha de cada partido. Cada fila trae los
 * goleadores y el xG: el marcador dice quien gano, el xG dice si lo merecio,
 * y las dos cosas juntas son la diferencia entre una lista de numeros y algo
 * que se puede leer.
 */
export function ResultsPage(): ReactNode {
  const state = useGameState();
  const lastPlayed = state.season.round - 1;
  // El selector trabaja con ids de texto: 'propios' o 'f7'. Guardar la fecha
  // como numero obligaria a un tipo mixto que no aporta nada.
  const [shown, setShown] = useState<string>(lastPlayed >= 1 ? `f${lastPlayed}` : 'propios');

  if (state.season.records.length === 0) {
    return (
      <div className="page page--narrow">
        <Panel title="Resultados">
          <EmptyState
            title="Todavía no se jugó ninguna fecha"
            detail="Cuando juegues la primera, acá van a estar todos los resultados del torneo con la ficha de cada partido."
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

  const rounds = Array.from({ length: lastPlayed }, (_, index) => lastPlayed - index);
  const shownRound = shown.startsWith('f') ? Number(shown.slice(1)) : null;
  const records =
    shownRound === null
      ? state.season.records
          .filter((record) => record.userMatch)
          .slice()
          .sort((a, b) => b.round - a.round)
      : state.season.records.filter((record) => record.round === shownRound);

  return (
    <div className="page">
      <Panel
        title="Resultados"
        subtitle={`${state.season.records.length} partidos jugados`}
        actions={
          <Tabs
            items={[
              { id: 'propios', label: 'Los tuyos', count: lastPlayed },
              ...rounds.slice(0, 8).map((round) => ({ id: `f${round}`, label: `F${round}` })),
            ]}
            active={shown}
            onChange={setShown}
            size="sm"
          />
        }
      >
        <div className="resultlist">
          {records.map((record) => (
            <ResultRow key={record.fixtureId} record={record} ownClubId={state.club.id} />
          ))}
        </div>

        {rounds.length > 8 && (
          <div className="roundpicker roundpicker--wide">
            {rounds.map((round) => (
              <button
                key={round}
                className={`roundpicker__btn ${round === shownRound ? 'is-active' : ''} is-played`}
                onClick={() => setShown(`f${round}`)}
              >
                {round}
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ResultRow({
  record,
  ownClubId,
}: {
  readonly record: MatchRecord;
  readonly ownClubId: string;
}): ReactNode {
  const home = clubById(record.homeClubId);
  const away = clubById(record.awayClubId);
  const isOwn = record.homeClubId === ownClubId || record.awayClubId === ownClubId;

  const scorers = record.lines
    .filter((line) => line.goals > 0)
    .map((line) => `${line.playerName}${line.goals > 1 ? ` (${line.goals})` : ''}`);

  return (
    <Link
      to={`/competicion/partido/${record.fixtureId}`}
      className={`resultcard ${isOwn ? 'is-own' : ''}`}
    >
      <div className="resultcard__top">
        <span className="resultcard__side">
          <ClubBadge club={home} size={22} />
          <span className="truncate">{home.name}</span>
        </span>
        <span className="resultcard__score tnum">
          {record.homeGoals} — {record.awayGoals}
        </span>
        <span className="resultcard__side resultcard__side--away">
          <span className="truncate">{away.name}</span>
          <ClubBadge club={away} size={22} />
        </span>
      </div>

      <div className="resultcard__bottom">
        <span className="resultcard__meta tnum" title="Goles esperados de cada equipo">
          xG {decimal(record.projection.xgHome, 1)} — {decimal(record.projection.xgAway, 1)}
        </span>
        <span className="resultcard__scorers truncate">
          {scorers.length > 0 ? scorers.join(', ') : 'Sin goles'}
        </span>
        <span className="resultcard__meta">Fecha {record.round}</span>
      </div>
    </Link>
  );
}
