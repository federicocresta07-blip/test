import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel.tsx';
import { Badge, type BadgeTone } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Link } from '../../router/router.tsx';
import { useGameState } from '../../state/GameProvider.tsx';
import { clubById } from '../../data/clubs.ts';
import { moneyShort } from '../../lib/format.ts';
import type { TransferOffer, TransferOfferStatus } from '../../models/index.ts';

const STATUS_TONE: Record<TransferOfferStatus, BadgeTone> = {
  enviada: 'accent',
  vista: 'info',
  contraoferta: 'warn',
  aceptada: 'ok',
  rechazada: 'danger',
  vencida: 'neutral',
};

/**
 * MERCADO (seccion 5.5).
 *
 * Las negociaciones son operaciones abiertas, no compras instantaneas: el
 * widget muestra el estado y el vencimiento de cada una.
 */
export function MarketWidget(): ReactNode {
  const state = useGameState();
  const received = state.offersReceived;
  const sent = state.offersSent;

  return (
    <Panel
      title="Mercado"
      subtitle={`${received.length} recibidas · ${sent.length} enviadas`}
      actions={
        <Link to="/mercado/recibidas">
          <Button size="sm" variant="ghost">
            Ver mercado
          </Button>
        </Link>
      }
      padded={false}
    >
      {received.length === 0 && sent.length === 0 ? (
        <EmptyState title="Sin movimientos" detail="No hay ofertas abiertas." />
      ) : (
        <ul className="offerlist">
          {received.slice(0, 3).map((offer) => (
            <OfferRow key={offer.id} offer={offer} direction="recibida" />
          ))}
          {sent.slice(0, 2).map((offer) => (
            <OfferRow key={offer.id} offer={offer} direction="enviada" />
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Fila de oferta. La UI no necesita saber si responde un humano o la IA. */
function OfferRow({
  offer,
  direction,
}: {
  readonly offer: TransferOffer;
  readonly direction: 'recibida' | 'enviada';
}): ReactNode {
  const counterpartId = direction === 'recibida' ? offer.fromClubId : offer.toClubId;
  const counterpart = clubById(counterpartId);

  return (
    <li className="offerrow">
      <span className={`offerrow__dir offerrow__dir--${direction}`}>
        {direction === 'recibida' ? '↓' : '↑'}
      </span>
      <span className="col offerrow__main">
        <span className="offerrow__player truncate">{offer.playerName}</span>
        <span className="offerrow__club truncate secondary">
          {counterpart.name}
          <span className="muted"> · {offer.counterpartIsHuman ? 'manager humano' : 'club IA'}</span>
        </span>
      </span>
      <span className="offerrow__amount tnum">{moneyShort(offer.amount)}</span>
      <span className="offerrow__status">
        <Badge tone={STATUS_TONE[offer.status]}>{offer.status}</Badge>
        <span className="offerrow__expiry muted tnum">
          {offer.expiresInDays}
          {offer.expiresInDays === 1 ? ' día' : ' días'}
        </span>
      </span>
    </li>
  );
}
