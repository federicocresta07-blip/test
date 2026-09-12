import { useState, type ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { Button } from '../ui/Button.tsx';
import { Drawer } from '../ui/Drawer.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Link } from '../../router/router.tsx';
import { useGame, useGameState } from '../../state/GameProvider.tsx';
import { shortDate } from '../../lib/format.ts';
import type { InboxMessage } from '../../models/index.ts';

/**
 * BANDEJA DEL MANAGER (seccion 5.4).
 *
 * El staff le habla al manager. Cada mensaje viene de un rol concreto, dice
 * algo util y, cuando corresponde, lleva a la pantalla donde se actua.
 */
export function ManagerInbox(): ReactNode {
  const state = useGameState();
  const { markMessageRead } = useGame();
  const [open, setOpen] = useState<InboxMessage | null>(null);

  const unread = state.inbox.filter((message) => message.unread).length;

  const openMessage = (message: InboxMessage): void => {
    setOpen(message);
    if (message.unread) markMessageRead(message.id);
  };

  return (
    <>
      <Panel
        title="Bandeja del Manager"
        subtitle={unread > 0 ? `${unread} sin leer` : 'Todo leído'}
        actions={
          <Link to="/informacion/mensajes">
            <Button size="sm" variant="ghost">
              Ver todo
            </Button>
          </Link>
        }
        padded={false}
      >
        <ul className="inboxlist">
          {state.inbox.slice(0, 6).map((message) => (
            <li key={message.id}>
              <button
                className={`inboxrow ${message.unread ? 'is-unread' : ''}`}
                onClick={() => openMessage(message)}
              >
                <span className={`inboxrow__dot ${message.unread ? 'is-unread' : ''}`} />
                <span className="col inboxrow__main">
                  <span className="inboxrow__top">
                    <span className="inboxrow__author truncate">{message.author}</span>
                    <span className="inboxrow__date tnum">{shortDate(message.date)}</span>
                  </span>
                  <span className="inboxrow__subject truncate">{message.subject}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Drawer
        open={open !== null}
        title={open?.subject ?? ''}
        subtitle={open ? `${open.authorName} · ${open.author}` : undefined}
        onClose={() => setOpen(null)}
        footer={
          open?.action ? (
            <Link to={open.action.route} onNavigate={() => setOpen(null)}>
              <Button variant="primary">{open.action.label}</Button>
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cerrar
            </Button>
          )
        }
      >
        {open && (
          <div className="col" style={{ gap: 'var(--sp-5)' }}>
            <Badge tone="accent">{open.author}</Badge>
            <p className="messagebody">{open.body}</p>
            <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Recibido el {shortDate(open.date)}
            </p>
          </div>
        )}
      </Drawer>
    </>
  );
}
