import { useMemo, useState, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { longDate } from '../lib/format.ts';
import type { InboxMessage } from '../models/index.ts';

/**
 * BANDEJA COMPLETA (seccion 5.4) — fase 3 del plan.
 *
 * El widget del despacho muestra los seis ultimos; aca esta el historial
 * entero, con el mensaje abierto al costado en lugar de en un panel lateral,
 * que es lo que corresponde cuando la pantalla es la bandeja misma.
 *
 * Parte de estos mensajes no son datos fijos: se calculan desde el cuerpo
 * tecnico y las instalaciones que hay ahora (`lib/staff-messages.ts`). Si
 * mejoras la instalacion que frena a alguien, su mensaje deja de aparecer.
 */
export function MessagesPage(): ReactNode {
  const state = useGameState();
  const { markMessageRead } = useGame();
  const [filter, setFilter] = useState<'todos' | 'sin-leer'>('todos');
  const [openId, setOpenId] = useState<string | null>(state.inbox[0]?.id ?? null);

  const unread = state.inbox.filter((message) => message.unread).length;
  const shown = useMemo(
    () => (filter === 'sin-leer' ? state.inbox.filter((message) => message.unread) : state.inbox),
    [state.inbox, filter],
  );

  const open = state.inbox.find((message) => message.id === openId) ?? null;

  const select = (message: InboxMessage): void => {
    setOpenId(message.id);
    if (message.unread) markMessageRead(message.id);
  };

  return (
    <div className="page">
      <Panel
        title="Bandeja del Manager"
        subtitle={unread > 0 ? `${unread} sin leer de ${state.inbox.length}` : 'Todo leído'}
        actions={
          <Tabs
            items={[
              { id: 'todos', label: 'Todos', count: state.inbox.length },
              { id: 'sin-leer', label: 'Sin leer', count: unread },
            ]}
            active={filter}
            onChange={setFilter}
            size="sm"
          />
        }
        padded={false}
      >
        <div className="mailbox">
          <ul className="mailbox__list">
            {shown.length === 0 && (
              <li className="mailbox__emptyrow">
                <EmptyState title="No hay mensajes sin leer" />
              </li>
            )}
            {shown.map((message) => (
              <li key={message.id}>
                <button
                  className={`mailrow ${message.unread ? 'is-unread' : ''} ${
                    message.id === openId ? 'is-open' : ''
                  }`}
                  onClick={() => select(message)}
                  aria-current={message.id === openId}
                >
                  <span className={`mailrow__dot ${message.unread ? 'is-unread' : ''}`} />
                  <span className="mailrow__main">
                    <span className="mailrow__top">
                      <span className="mailrow__author truncate">{message.author}</span>
                      <span className="mailrow__date tnum">{longDate(message.date)}</span>
                    </span>
                    <span className="mailrow__subject truncate">{message.subject}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mailbox__reader">
            {open ? (
              <article className="mailread">
                <header className="mailread__head">
                  <Badge tone="accent">{open.author}</Badge>
                  <h2 className="mailread__subject">{open.subject}</h2>
                  <p className="mailread__meta">
                    {open.authorName} · {longDate(open.date)}
                  </p>
                </header>
                <p className="messagebody">{open.body}</p>
                {open.action && (
                  <footer className="mailread__foot">
                    <Link to={open.action.route}>
                      <Button variant="primary">{open.action.label}</Button>
                    </Link>
                  </footer>
                )}
              </article>
            ) : (
              <EmptyState
                title="Elegí un mensaje"
                detail="La lista de la izquierda tiene el historial completo."
              />
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
