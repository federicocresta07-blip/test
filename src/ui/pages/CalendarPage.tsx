import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { Link, useRouter } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { preparationStatus } from '../lib/preparation.ts';
import { restDaysBefore } from '../lib/season-bridge.ts';
import { longDate } from '../lib/format.ts';
import type { Fixture } from '../models/index.ts';

/**
 * CALENDARIO (seccion 13) — fase 7 del plan.
 *
 * El fixture completo del torneo, fecha por fecha, y el boton que hace que
 * todo lo demas exista: JUGAR LA FECHA. Los diez partidos se resuelven con el
 * mismo motor —el propio con la alineacion elegida, los otros nueve IA contra
 * IA (seccion 49)—, y de ahi salen la tabla, los goleadores, la forma, la
 * fatiga y las lesiones.
 */
export function CalendarPage(): ReactNode {
  const state = useGameState();
  const { round, playRound, clearRound, resetSeason } = useGame();
  const { navigate } = useRouter();
  const [shownRound, setShownRound] = useState<number | null>(null);

  const current = Math.min(state.season.round, state.season.totalRounds);
  const visible = shownRound ?? current;
  const preparation = preparationStatus(state);

  const ofRound = useMemo(
    () => state.fixtures.filter((fixture) => fixture.round === visible),
    [state.fixtures, visible],
  );
  const ownFixture = ofRound.find(
    (fixture) => fixture.homeClubId === state.club.id || fixture.awayClubId === state.club.id,
  );

  const isPending = visible >= state.season.round;
  const restDays = restDaysBefore(visible + 1);

  return (
    <div className="page">
      {/* --- Jugar la fecha --- */}
      {state.season.finished ? (
        <Panel title="El torneo terminó">
          <div className="matchday matchday--done">
            <p className="clubnotes">
              Se jugaron las {state.season.totalRounds} fechas. La tabla final está en{' '}
              <Link to="/competicion/tabla">Competición · Tabla</Link>, y los goleadores en{' '}
              <Link to="/competicion/estadisticas">Estadísticas</Link>.
            </p>
            <Button variant="primary" onClick={() => void resetSeason()} disabled={round.playing}>
              Empezar un torneo nuevo
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel
          title={`Fecha ${state.season.round} de ${state.season.totalRounds}`}
          subtitle={
            ownFixture && visible === state.season.round
              ? `${ownFixture.homeClubId === state.club.id ? 'Local' : 'Visitante'} · ${longDate(ownFixture.date)} · ${ownFixture.time}`
              : 'Tu próximo partido'
          }
        >
          <div className="matchday">
            <div className="matchday__main">
              <p className={`matchday__prep is-${preparation.level}`}>{preparation.headline}</p>
              {preparation.issues.length > 0 && (
                <ul className="matchday__issues">
                  {preparation.issues.slice(0, 4).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <p className="matchday__rest">
                Hasta la fecha siguiente hay <strong>{restDays} días</strong>.{' '}
                {restDays <= 4
                  ? 'Con tan poco descanso, el plantel no llega entero: conviene repartir minutos.'
                  : 'Una semana completa alcanza para que el plantel se recupere del todo.'}
              </p>
            </div>

            <div className="matchday__actions">
              <Link to="/equipo/alineacion">
                <Button size="lg" variant="ghost">
                  Preparar equipo
                </Button>
              </Link>
              <Button
                size="lg"
                variant="primary"
                disabled={round.playing}
                onClick={() => void playRound()}
              >
                {round.playing ? 'Jugando la fecha…' : 'Jugar la fecha'}
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

          {round.report && (
            <div className="roundreport" role="status">
              <div className="roundreport__head">
                <span className="roundreport__title">
                  {round.report.record ? (
                    <>
                      Fecha {round.report.round}:{' '}
                      {clubById(round.report.record.homeClubId).shortName}{' '}
                      {round.report.record.homeGoals} — {round.report.record.awayGoals}{' '}
                      {clubById(round.report.record.awayClubId).shortName}
                    </>
                  ) : (
                    `Se jugó la fecha ${round.report.round}`
                  )}
                </span>
                {round.report.record && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const id = round.report?.record?.fixtureId;
                      clearRound();
                      if (id) navigate(`/competicion/partido/${id}`);
                    }}
                  >
                    Ver el partido
                  </Button>
                )}
              </div>
              {round.report.injuries.length > 0 && (
                <p className="roundreport__line is-bad">
                  Lesiones:{' '}
                  {round.report.injuries
                    .map((injury) => `${injury.playerName} (${injury.severity}, ${injury.daysOut} días)`)
                    .join('; ')}
                </p>
              )}
              {round.report.suspensions.length > 0 && (
                <p className="roundreport__line is-bad">
                  Suspendidos:{' '}
                  {round.report.suspensions
                    .map((entry) => `${entry.playerName} (${entry.matches} fecha/s)`)
                    .join('; ')}
                </p>
              )}
              {round.report.skipped.length > 0 && (
                <p className="roundreport__line is-bad">
                  Partidos sin jugar: {round.report.skipped.join('; ')}
                </p>
              )}
              {round.report.saveWarning && (
                <p className="roundreport__line is-bad">{round.report.saveWarning}</p>
              )}
            </div>
          )}
        </Panel>
      )}

      {/* --- El fixture, fecha por fecha --- */}
      <Panel
        title="Fixture del torneo"
        subtitle="Una sola vuelta: todos contra todos"
        actions={
          <div className="roundpicker">
            {Array.from({ length: state.season.totalRounds }, (_, index) => index + 1).map(
              (number) => (
                <button
                  key={number}
                  className={`roundpicker__btn ${number === visible ? 'is-active' : ''} ${
                    number < state.season.round ? 'is-played' : ''
                  }`}
                  onClick={() => setShownRound(number)}
                  title={`Fecha ${number}`}
                >
                  {number}
                </button>
              ),
            )}
          </div>
        }
      >
        <div className="fixturelist">
          {ofRound.map((fixture) => (
            <FixtureRow
              key={fixture.id}
              fixture={fixture}
              ownClubId={state.club.id}
              pending={isPending}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function FixtureRow({
  fixture,
  ownClubId,
  pending,
}: {
  readonly fixture: Fixture;
  readonly ownClubId: string;
  readonly pending: boolean;
}): ReactNode {
  const home = clubById(fixture.homeClubId);
  const away = clubById(fixture.awayClubId);
  const isOwn = fixture.homeClubId === ownClubId || fixture.awayClubId === ownClubId;

  const body = (
    <>
      <span className="fixturerow__date tnum">
        {longDate(fixture.date)} · {fixture.time}
      </span>
      <span className="fixturerow__side fixturerow__side--home">
        <span className="truncate">{home.name}</span>
        <ClubBadge club={home} size={20} />
      </span>
      <span className="fixturerow__score tnum">
        {fixture.score ? `${fixture.score.home} — ${fixture.score.away}` : 'vs'}
      </span>
      <span className="fixturerow__side fixturerow__side--away">
        <ClubBadge club={away} size={20} />
        <span className="truncate">{away.name}</span>
      </span>
      <span className="fixturerow__tag">
        {isOwn && <Badge tone="accent">Tuyo</Badge>}
        {!pending && fixture.score && <span className="fixturerow__link">ficha →</span>}
      </span>
    </>
  );

  if (fixture.score) {
    return (
      <Link to={`/competicion/partido/${fixture.id}`} className={`fixturerow ${isOwn ? 'is-own' : ''}`}>
        {body}
      </Link>
    );
  }

  return <div className={`fixturerow is-pending ${isOwn ? 'is-own' : ''}`}>{body}</div>;
}
