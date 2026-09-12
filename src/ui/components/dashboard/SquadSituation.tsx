import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Icon } from '../Icon.tsx';
import { Link } from '../../router/router.tsx';
import { useGameState } from '../../state/GameProvider.tsx';
import { squadAlerts } from '../../lib/alerts.ts';

/**
 * SITUACION DEL PLANTEL (seccion 5.3).
 *
 * Alertas accionables: cada una lleva directamente a donde se resuelve.
 * No es una lista de metricas, es una lista de cosas para hacer.
 */
export function SquadSituation(): ReactNode {
  const state = useGameState();
  const alerts = squadAlerts(state);

  return (
    <Panel title="Situación del plantel" subtitle={`${state.squad.length} jugadores`}>
      {alerts.length === 0 ? (
        <EmptyState title="Sin alertas" detail="No hay lesionados, sancionados ni contratos por vencer." />
      ) : (
        <ul className="alertlist">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link to={alert.route} className={`alertrow alertrow--${alert.severity}`}>
                <Icon name="alert" size={13} className="alertrow__icon" />
                <span className="col">
                  <span className="alertrow__label">{alert.label}</span>
                  <span className="alertrow__detail truncate">{alert.detail}</span>
                </span>
                <span className="alertrow__action nowrap">{alert.actionLabel}</span>
                <Icon name="chevron" size={13} className="alertrow__chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
