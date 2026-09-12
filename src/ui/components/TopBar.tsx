import { useState, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { ClubBadge } from './ClubBadge.tsx';
import { Badge } from './ui/Badge.tsx';
import { Tooltip } from './ui/Tooltip.tsx';
import { Link } from '../router/router.tsx';
import { useGameState } from '../state/GameProvider.tsx';
import { DATA_SOURCE_LABEL, DATA_SOURCE_NOTICE } from '../services/index.ts';
import { moneyShort, shortDate } from '../lib/format.ts';
import { squadAlerts } from '../lib/alerts.ts';

/**
 * Barra superior del Game Shell (secciones 3.1, 5.1).
 *
 * Esta en todas las pantallas porque el manager tiene que saber SIEMPRE que
 * club maneja, en que fecha esta, como va en la tabla, cuanta plata tiene y
 * que le falta resolver.
 */
export function TopBar(): ReactNode {
  const state = useGameState();
  const [openNotifications, setOpenNotifications] = useState(false);

  const position = state.table.findIndex((row) => row.clubId === state.club.id) + 1;
  const unread = state.inbox.filter((message) => message.unread).length;
  const pendingOffers = state.offersReceived.filter(
    (offer) => offer.status === 'enviada' || offer.status === 'contraoferta',
  ).length;
  const alerts = squadAlerts(state);
  const critical = alerts.filter((alert) => alert.severity === 'danger').length;

  return (
    <header className="topbar">
      <Link to="/" className="topbar__club">
        <ClubBadge club={state.club} size={30} />
        <span className="col">
          <span className="topbar__clubname">{state.club.name}</span>
          <span className="topbar__division">{state.club.division}</span>
        </span>
      </Link>

      <div className="topbar__context">
        <Metric label="Fecha" value={`${state.currentRound}ª`} hint={state.seasonLabel} />
        <Metric
          label="Posición"
          value={position > 0 ? `${position}º` : '—'}
          hint={`${state.table.length} equipos en la división`}
        />
        <Metric label="Caja" value={moneyShort(state.finances.cash)} hint="Dinero disponible" />
        <Metric
          label="Fichajes"
          value={moneyShort(state.finances.transferBudget)}
          hint="Presupuesto de transferencias"
        />
        <Metric label="Hoy" value={shortDate(state.today)} hint="Fecha del universo del juego" />
      </div>

      <div className="topbar__right">
        <Tooltip content={DATA_SOURCE_NOTICE} side="bottom">
          <Badge tone="accent">{DATA_SOURCE_LABEL}</Badge>
        </Tooltip>

        <button
          className={`topbar__icon ${unread + pendingOffers + critical > 0 ? 'has-badge' : ''}`}
          onClick={() => setOpenNotifications((open) => !open)}
          aria-expanded={openNotifications}
          title="Notificaciones"
        >
          <Icon name="bell" size={17} />
          {unread + pendingOffers + critical > 0 && (
            <span className="topbar__count tnum">{unread + pendingOffers + critical}</span>
          )}
        </button>

        {openNotifications && (
          <div className="notifpop">
            <p className="label">Pendientes</p>
            <ul className="notifpop__list">
              <NotificationItem
                count={unread}
                label="mensajes sin leer del cuerpo técnico"
                route="/"
                onNavigate={() => setOpenNotifications(false)}
              />
              <NotificationItem
                count={pendingOffers}
                label="ofertas de mercado por responder"
                route="/mercado/recibidas"
                onNavigate={() => setOpenNotifications(false)}
              />
              <NotificationItem
                count={critical}
                label="alertas críticas del plantel"
                route="/equipo/plantel"
                onNavigate={() => setOpenNotifications(false)}
              />
            </ul>
          </div>
        )}

        <div className="topbar__manager" title="Manager del club">
          <Icon name="user" size={15} />
          <span className="truncate">{state.manager.name}</span>
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
}): ReactNode {
  return (
    <div className="topbar__metric" title={hint}>
      <span className="topbar__metriclabel">{label}</span>
      <span className="topbar__metricvalue tnum">{value}</span>
    </div>
  );
}

/** Item de notificacion: si no hay nada, lo dice en lugar de desaparecer. */
function NotificationItem({
  count,
  label,
  route,
  onNavigate,
}: {
  readonly count: number;
  readonly label: string;
  readonly route: string;
  readonly onNavigate: () => void;
}): ReactNode {
  if (count === 0) {
    return (
      <li className="notifpop__item is-empty">
        <span className="notifpop__dot" />
        <span>Sin {label}</span>
      </li>
    );
  }
  return (
    <li className="notifpop__item">
      <Link to={route} className="notifpop__link" onNavigate={onNavigate}>
        <span className="notifpop__badge tnum">{count}</span>
        <span>{label}</span>
        <Icon name="chevron" size={13} className="notifpop__chevron" />
      </Link>
    </li>
  );
}
