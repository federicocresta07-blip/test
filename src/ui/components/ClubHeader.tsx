import type { ReactNode } from 'react';
import { ClubBadge } from './ClubBadge.tsx';
import { Button } from './ui/Button.tsx';
import { Link, useRouter } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { nextFixture } from '../lib/fixtures.ts';
import { squadAlerts } from '../lib/alerts.ts';
import { preparationStatus } from '../lib/preparation.ts';
import { longDate } from '../lib/format.ts';
import { pageTitle as titleOf } from '../router/navigation.ts';

/**
 * Segunda fila del shell (seccion 3.1).
 *
 * Mantiene visible el proximo partido y el estado de preparacion del equipo
 * en cualquier pantalla, con el acceso directo a resolverlo.
 */
export function ClubHeader(): ReactNode {
  const state = useGameState();
  const { path } = useRouter();
  const fixture = nextFixture(state);
  const preparation = preparationStatus(state);
  const criticalAlerts = squadAlerts(state).filter((alert) => alert.severity === 'danger').length;
  const pageTitle = titleOf(path);

  return (
    <div className="clubheader">
      <h1 className="clubheader__title">{pageTitle}</h1>

      {fixture && (
        <div className="clubheader__match">
          <span className="label">Próximo</span>
          <span className="clubheader__teams">
            <ClubBadge club={clubById(fixture.homeClubId)} size={18} />
            <span className="clubheader__vs">
              {clubById(fixture.homeClubId).shortName} — {clubById(fixture.awayClubId).shortName}
            </span>
            <ClubBadge club={clubById(fixture.awayClubId)} size={18} />
          </span>
          <span className="clubheader__meta secondary">
            {longDate(fixture.date)} · {fixture.homeClubId === state.club.id ? 'Local' : 'Visitante'} · Fecha{' '}
            {fixture.round}
          </span>
        </div>
      )}

      <div className="clubheader__right">
        {criticalAlerts > 0 && (
          <Link to="/equipo/plantel" className="clubheader__alert">
            {criticalAlerts} {criticalAlerts === 1 ? 'baja' : 'bajas'} en el plantel
          </Link>
        )}
        <span
          className={`clubheader__ready is-${preparation.level}`}
          title={preparation.issues.join(' · ') || 'Sin observaciones'}
        >
          {preparation.level === 'listo'
            ? 'Equipo listo'
            : preparation.level === 'atencion'
              ? 'Equipo con observaciones'
              : 'Alineación incompleta'}
        </span>
        <Link to="/equipo/alineacion">
          <Button variant="primary" size="sm">
            Preparar equipo
          </Button>
        </Link>
      </div>
    </div>
  );
}
