import { useState, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ProjectionStrip, Scoreboard } from '../components/match/Scoreboard.tsx';
import { MatchTimeline } from '../components/match/MatchTimeline.tsx';
import { MatchStats } from '../components/match/MatchStats.tsx';
import { MatchRatings } from '../components/match/MatchRatings.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { recordOfFixture } from '../lib/season-bridge.ts';
import { longDate } from '../lib/format.ts';

/**
 * FICHA DEL PARTIDO (seccion 14) — fase 7 del plan.
 *
 * Sin representacion 2D ni 3D, como pide la seccion 28 del motor. Lo que hay
 * es el resultado explicado: el marcador, lo que el motor esperaba, el minuto
 * a minuto, las quince estadisticas y las notas individuales.
 *
 * El relato del partido lo escribe el motor a partir de lo que de verdad
 * paso (seccion 51): no es un texto generico con el marcador insertado.
 */
export function MatchPage({ fixtureId }: { readonly fixtureId: string }): ReactNode {
  const state = useGameState();
  const record = recordOfFixture(state.season.records, fixtureId);
  const fixture = state.fixtures.find((entry) => entry.id === fixtureId);
  const [side, setSide] = useState<'home' | 'away'>('home');

  if (!record) {
    return (
      <div className="page page--narrow">
        <Panel title="Partido">
          <EmptyState
            title={fixture ? 'Este partido todavía no se jugó' : 'No encontramos ese partido'}
            detail={
              fixture
                ? `${clubById(fixture.homeClubId).name} — ${clubById(fixture.awayClubId).name}, fecha ${fixture.round}. Se juega desde el calendario.`
                : 'El enlace no corresponde a ningún partido del torneo.'
            }
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

  const home = clubById(record.homeClubId);
  const away = clubById(record.awayClubId);
  const shownClub = side === 'home' ? record.homeClubId : record.awayClubId;

  return (
    <div className="page">
      <Panel
        title={`${home.name} — ${away.name}`}
        subtitle={`Fecha ${record.round}${fixture ? ` · ${longDate(fixture.date)} · ${home.stadiumName}` : ''}`}
        actions={
          record.userMatch ? (
            <Badge tone="accent">Tu partido</Badge>
          ) : (
            <Badge tone="neutral">Otro partido de la fecha</Badge>
          )
        }
      >
        <div className="matchhead">
          <Scoreboard record={record} />
          <ProjectionStrip record={record} />
        </div>
      </Panel>

      {record.narrative && (
        <Panel title="Cómo se dio el partido">
          <p className="messagebody">{record.narrative}</p>
          {record.tacticalNotes.length > 0 && (
            <ul className="tacticalnotes">
              {record.tacticalNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <div className="matchgrid">
        <Panel title="Estadísticas">
          <MatchStats record={record} />
        </Panel>

        <Panel title="Minuto a minuto">
          <MatchTimeline record={record} />
        </Panel>
      </div>

      <Panel
        title="Notas individuales"
        subtitle={
          record.manOfTheMatchName
            ? `Mejor jugador del partido: ${record.manOfTheMatchName}`
            : undefined
        }
        actions={
          <Tabs
            items={[
              { id: 'home', label: home.shortName },
              { id: 'away', label: away.shortName },
            ]}
            active={side}
            onChange={setSide}
            size="sm"
          />
        }
      >
        <MatchRatings record={record} clubId={shownClub} />
      </Panel>
    </div>
  );
}
