import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { Button } from '../ui/Button.tsx';
import { ClubBadge } from '../ClubBadge.tsx';
import { Link } from '../../router/router.tsx';
import { useGame, useGameState } from '../../state/GameProvider.tsx';
import { clubById } from '../../data/clubs.ts';
import { nextFixture, tablePosition, tableRow } from '../../lib/fixtures.ts';
import { preparationStatus } from '../../lib/preparation.ts';
import { longDate } from '../../lib/format.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import type { LeagueRow } from '../../models/index.ts';

/**
 * PROXIMO PARTIDO (seccion 5.2).
 *
 * Rival, condicion, competicion, fecha y hora; posicion y forma reciente de
 * los dos equipos; estado de preparacion; y el CTA principal del dashboard.
 */
export function NextMatchCard(): ReactNode {
  const state = useGameState();
  const { round, playRound, clearRound } = useGame();
  const fixture = nextFixture(state);

  if (!fixture) {
    return (
      <Panel title="Próximo partido">
        <EmptyState
          title={state.season.finished ? 'El torneo terminó' : 'No hay partidos programados'}
          detail={
            state.season.finished
              ? `Se jugaron las ${state.season.totalRounds} fechas. Desde el calendario podés empezar un torneo nuevo.`
              : 'No encontramos el próximo partido del club en el fixture.'
          }
          action={
            <Link to="/competicion/calendario">
              <Button variant="primary">Ir al calendario</Button>
            </Link>
          }
        />
      </Panel>
    );
  }

  const isHome = fixture.homeClubId === state.club.id;
  const rivalId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const preparation = preparationStatus(state);

  return (
    <Panel
      title="Próximo partido"
      subtitle={`${fixture.competition} · Fecha ${fixture.round}`}
      actions={
        <span className={`matchcard__venue matchcard__venue--${isHome ? 'home' : 'away'}`}>
          {isHome ? 'Local' : 'Visitante'}
        </span>
      }
    >
      <div className="matchcard">
        <div className="matchcard__teams">
          <TeamSide
            clubId={state.club.id}
            row={tableRow(state, state.club.id)}
            position={tablePosition(state, state.club.id)}
            align="right"
          />
          <div className="matchcard__center">
            <span className="matchcard__date">{longDate(fixture.date)}</span>
            <span className="matchcard__time tnum">{fixture.time}</span>
            <span className="matchcard__stadium truncate">
              {clubById(fixture.homeClubId).stadiumName}
            </span>
          </div>
          <TeamSide
            clubId={rivalId}
            row={tableRow(state, rivalId)}
            position={tablePosition(state, rivalId)}
            align="left"
          />
        </div>

        <div className={`matchcard__prep matchcard__prep--${preparation.level}`}>
          <div className="col">
            <span className="matchcard__prephead">{preparation.headline}</span>
            {preparation.issues.length > 0 && (
              <ul className="matchcard__issues">
                {preparation.issues.slice(0, 3).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="matchcard__ctas">
            <Link to="/equipo/alineacion">
              <Button variant="ghost" size="lg">
                Preparar equipo
              </Button>
            </Link>
            <Button
              variant="primary"
              size="lg"
              disabled={round.playing}
              onClick={() => void playRound()}
            >
              {round.playing ? 'Jugando…' : 'Jugar el partido'}
            </Button>
          </div>
        </div>

        {round.error && (
          <div className="investbanner investbanner--error" role="alert">
            <span className="investbanner__text">{round.error}</span>
            <Button size="sm" variant="ghost" onClick={clearRound}>
              Entendido
            </Button>
          </div>
        )}

        {round.report?.record && (
          <div className="roundreport" role="status">
            <div className="roundreport__head">
              <span className="roundreport__title">
                Se jugó la fecha {round.report.round}:{' '}
                {clubById(round.report.record.homeClubId).shortName} {round.report.record.homeGoals}
                {' - '}
                {round.report.record.awayGoals}{' '}
                {clubById(round.report.record.awayClubId).shortName}
              </span>
              <Link
                to={`/competicion/partido/${round.report.record.fixtureId}`}
                onNavigate={clearRound}
              >
                <Button size="sm" variant="primary">
                  Ver el partido
                </Button>
              </Link>
            </div>
          </div>
        )}

        <p className="matchcard__note muted">
          El partido se resuelve con el motor de simulación, sin representación 2D ni 3D: el
          resultado se explica con las estadísticas, el minuto a minuto y las notas. Al jugar la
          fecha también se resuelven los otros nueve partidos, IA contra IA, con el mismo motor.
        </p>
      </div>
    </Panel>
  );
}

function TeamSide({
  clubId,
  row,
  position,
  align,
}: {
  readonly clubId: string;
  readonly row: LeagueRow | undefined;
  readonly position: number;
  readonly align: 'left' | 'right';
}): ReactNode {
  const club = clubById(clubId);
  return (
    <div className={`matchcard__side matchcard__side--${align}`}>
      <ClubBadge club={club} size={40} />
      <div className="col">
        <span className="matchcard__name truncate">{club.name}</span>
        <span className="matchcard__pos secondary tnum">
          {position > 0 ? `${position}º` : '—'}
          {row ? ` · ${row.points} pts` : ''}
        </span>
        {row && <FormStrip form={row.form} />}
      </div>
    </div>
  );
}

/** Forma reciente: los ultimos cinco resultados. */
export function FormStrip({ form }: { readonly form: readonly ('V' | 'E' | 'D')[] }): ReactNode {
  return (
    <span className="formstrip" title="Últimos cinco partidos, del más reciente al más viejo">
      {form.map((result, index) => (
        <span key={`${result}-${index}`} className={`formstrip__dot is-${result}`}>
          {result}
        </span>
      ))}
    </span>
  );
}
