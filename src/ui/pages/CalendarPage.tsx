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
import { longDate, moneyShort, percent } from '../lib/format.ts';
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
  const { round, playRound, clearRound, resetSeason, closeSeason, seasonClose, dismissSeasonClose } =
    useGame();
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
      {/*
        EL INFORME DEL CIERRE VA EN SU PROPIO PANEL, no adentro del bloque de
        "el torneo terminó". Ahí estaba al principio, y era un bug que solo
        aparecía jugando: cerrar la temporada hace que el torneo YA NO esté
        terminado —empieza la fecha 1 de la siguiente— así que el bloque
        desaparecía y con él el informe. El manager cerraba la temporada y no
        veía nunca quién se había retirado.
      */}
      {seasonClose.report && (
        <Panel title={`Empieza la temporada ${seasonClose.report.seasonNumber}`}>
          <div className="seasonclose">
            <p>Todos cumplieron un año. Esto es lo que dejó el cierre:</p>
            <div className="seasonclose__lists">
              <div>
                <span className="seasonclose__listlabel">
                  Se retiraron ({seasonClose.report.retired.length})
                </span>
                <ul className="seasonclose__list">
                  {seasonClose.report.retired.length === 0 ? (
                    <li className="muted">Nadie colgó los botines</li>
                  ) : (
                    seasonClose.report.retired.map((entry) => (
                      <li key={entry.name}>
                        <span>{entry.name}</span>
                        <span className="muted tnum">{entry.age} años</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <span className="seasonclose__listlabel">
                  Dejaron las inferiores ({seasonClose.report.released.length})
                </span>
                <ul className="seasonclose__list">
                  {seasonClose.report.released.length === 0 ? (
                    <li className="muted">A nadie se le terminó el tiempo</li>
                  ) : (
                    seasonClose.report.released.map((entry) => (
                      <li key={entry.name}>
                        <span>{entry.name}</span>
                        <span className="muted tnum">{entry.age} años</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <span className="seasonclose__listlabel">Camada nueva</span>
                <ul className="seasonclose__list">
                  <li>
                    <span>
                      {seasonClose.report.intake}{' '}
                      {seasonClose.report.intake === 1 ? 'juvenil' : 'juveniles'} de la academia
                    </span>
                    <Link to="/club/inferiores">
                      <Button size="sm" variant="ghost">
                        Verlos
                      </Button>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={dismissSeasonClose}>
              Entendido
            </Button>
          </div>
        </Panel>
      )}

      {state.season.finished ? (
        <Panel title="El torneo terminó">
          <div className="seasonclose">
            <p>
              Se jugaron las {state.season.totalRounds} fechas. La tabla final está en{' '}
              <Link to="/competicion/tabla">Competición · Tabla</Link>, y los goleadores en{' '}
              <Link to="/competicion/estadisticas">Estadísticas</Link>.
            </p>
            <p className="muted">
              <strong>Cerrar la temporada</strong> hace pasar un año: todos cumplen años, los
              veteranos se retiran, a los juveniles pasados de edad se les termina el tiempo y
              entra una camada nueva de la academia. Es irreversible.{' '}
              <strong>Reiniciar</strong>, en cambio, vuelve a jugar el mismo torneo desde la fecha
              1 sin que pase el tiempo.
            </p>
            {seasonClose.error && (
              <div className="investbanner investbanner--error" role="alert">
                <span className="investbanner__text">{seasonClose.error}</span>
                <Button size="sm" variant="ghost" onClick={dismissSeasonClose}>
                  Entendido
                </Button>
              </div>
            )}
            <div className="matchday__actions">
              <Button
                variant="primary"
                onClick={() => void closeSeason()}
                disabled={seasonClose.pending || round.playing}
              >
                {seasonClose.pending ? 'Cerrando…' : 'Cerrar la temporada'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void resetSeason()}
                disabled={seasonClose.pending || round.playing}
              >
                Reiniciar el mismo torneo
              </Button>
            </div>
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
              {round.report.gate && (
                <p className="roundreport__line">
                  Recaudación: <strong>{moneyShort(round.report.gate.total)}</strong> con{' '}
                  {round.report.gate.attendance.toLocaleString('es-AR')} personas (
                  {percent(round.report.gate.occupancy)} del estadio).{' '}
                  <Link to="/club/estadio">Ver el estadio</Link>
                </p>
              )}
              {round.report.workFinished && (
                <p className="roundreport__line is-good">
                  Terminó la ampliación: {round.report.workFinished.seats.toLocaleString('es-AR')}{' '}
                  asientos nuevos. El estadio pasa a{' '}
                  {round.report.workFinished.capacity.toLocaleString('es-AR')} de capacidad.
                </p>
              )}
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
