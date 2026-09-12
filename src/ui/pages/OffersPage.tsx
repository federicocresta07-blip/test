import { useState, type ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Badge, type BadgeTone } from '../components/ui/Badge.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { ClubBadge } from '../components/ClubBadge.tsx';
import { Link } from '../router/router.tsx';
import { useGame, useGameState } from '../state/GameProvider.tsx';
import { clubById } from '../data/clubs.ts';
import { money, moneyShort } from '../lib/format.ts';
import type { StoredOffer } from '../models/index.ts';

/**
 * OFERTAS ENVIADAS Y RECIBIDAS (seccion 11) — fase 5 del plan.
 *
 * Las dos usan la misma pantalla porque son la misma cosa vista de los dos
 * lados: una oferta, un monto y una respuesta. Lo que cambia es quien decide.
 *
 * En las recibidas, la respuesta es del manager: aceptar, rechazar o
 * contraofertar. Y la contraoferta tampoco se resuelve por sorteo — el club
 * comprador acepta hasta un 25% mas de lo que ofrecio, y por encima de eso se
 * baja.
 */
export function OffersPage({ side }: { readonly side: 'enviadas' | 'recibidas' }): ReactNode {
  const state = useGameState();
  const { market, respondToOffer, clearMarket } = useGame();
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState(0);

  const offers = state.market.offers
    .filter((offer) =>
      side === 'enviadas' ? offer.fromClubId === state.club.id : offer.toClubId === state.club.id,
    )
    .slice()
    .sort((a, b) => b.round - a.round || b.amount - a.amount);

  const open = offers.filter((offer) => offer.status === 'enviada' || offer.status === 'contraoferta');
  const closed = offers.filter((offer) => !open.includes(offer));

  if (offers.length === 0) {
    return (
      <div className="page page--narrow">
        <Panel title={side === 'enviadas' ? 'Mis ofertas' : 'Ofertas recibidas'}>
          <EmptyState
            title={side === 'enviadas' ? 'Todavía no ofertaste por nadie' : 'Nadie ofertó por tus jugadores'}
            detail={
              side === 'enviadas'
                ? 'Desde el buscador podés ofertar por cualquier jugador del torneo. El club vendedor responde en el acto.'
                : 'Los clubes ofertan cuando pasa una fecha y ven que uno de tus jugadores les mejora un puesto. Jugá una fecha y fijate.'
            }
            action={
              <Link to={side === 'enviadas' ? '/mercado/buscar' : '/competicion/calendario'}>
                <Button variant="primary">
                  {side === 'enviadas' ? 'Ir al buscador' : 'Ir al calendario'}
                </Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      {market.error && (
        <div className="investbanner investbanner--error" role="alert">
          <span className="investbanner__text">{market.error}</span>
          <Button size="sm" variant="ghost" onClick={clearMarket}>
            Entendido
          </Button>
        </div>
      )}

      {market.outcome && (
        <div className="investbanner investbanner--ok" role="status">
          <span className="investbanner__text">{market.outcome.reason}</span>
          <Button size="sm" variant="ghost" onClick={clearMarket}>
            Entendido
          </Button>
        </div>
      )}

      {open.length > 0 && (
        <Panel
          title={side === 'enviadas' ? 'Ofertas abiertas' : 'Esperando tu respuesta'}
          subtitle={
            side === 'recibidas'
              ? 'Aceptá, rechazá o pedí más. Si pedís más de un 25% por encima, se bajan'
              : 'Contraofertaron: podés volver a ofertar desde el buscador'
          }
        >
          <div className="offerlist">
            {open.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                side={side}
                ownClubId={state.club.id}
                pending={market.pending}
                counterOpen={counterFor === offer.id}
                counterAmount={counterAmount}
                onCounterAmount={setCounterAmount}
                onOpenCounter={() => {
                  setCounterFor(offer.id);
                  setCounterAmount(Math.round(offer.amount * 1.2));
                }}
                onCloseCounter={() => setCounterFor(null)}
                onRespond={(action, amount) => {
                  setCounterFor(null);
                  void respondToOffer(offer.id, action, amount);
                }}
              />
            ))}
          </div>
        </Panel>
      )}

      {closed.length > 0 && (
        <Panel title="Resueltas" padded={false}>
          <ul className="offerhistory">
            {closed.map((offer) => (
              <li className="offerhistory__row" key={offer.id}>
                <Badge tone={statusTone(offer.status)}>{offer.status}</Badge>
                <span className="truncate">{offer.playerName}</span>
                <span className="secondary truncate">
                  {side === 'enviadas'
                    ? clubById(offer.toClubId).shortName
                    : clubById(offer.fromClubId).shortName}
                </span>
                <span className="tnum">{moneyShort(offer.amount)}</span>
                <span className="muted">Fecha {offer.round}</span>
                <span className="offerhistory__reason truncate" title={offer.reason}>
                  {offer.reason}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function statusTone(status: StoredOffer['status']): BadgeTone {
  switch (status) {
    case 'aceptada':
      return 'ok';
    case 'rechazada':
      return 'danger';
    case 'contraoferta':
      return 'warn';
    case 'vencida':
      return 'neutral';
    default:
      return 'info';
  }
}

function OfferCard({
  offer,
  side,
  ownClubId,
  pending,
  counterOpen,
  counterAmount,
  onCounterAmount,
  onOpenCounter,
  onCloseCounter,
  onRespond,
}: {
  readonly offer: StoredOffer;
  readonly side: 'enviadas' | 'recibidas';
  readonly ownClubId: string;
  readonly pending: boolean;
  readonly counterOpen: boolean;
  readonly counterAmount: number;
  readonly onCounterAmount: (value: number) => void;
  readonly onOpenCounter: () => void;
  readonly onCloseCounter: () => void;
  readonly onRespond: (action: 'aceptar' | 'rechazar' | 'contraofertar', amount?: number) => void;
}): ReactNode {
  const counterpart = clubById(side === 'enviadas' ? offer.toClubId : offer.fromClubId);
  void ownClubId;

  return (
    <article className="offercard">
      <header className="offercard__head">
        <div className="offercard__who">
          <span className="offercard__player">{offer.playerName}</span>
          <span className="offercard__club">
            <ClubBadge club={counterpart} size={18} />
            {side === 'enviadas' ? `le ofreciste a ${counterpart.name}` : `${counterpart.name} ofrece`}
          </span>
        </div>
        <div className="offercard__amount">
          <span className="offercard__money tnum" title={money(offer.amount)}>
            {moneyShort(offer.amount)}
          </span>
          {offer.counter !== null && (
            <span className="offercard__counter tnum">piden {moneyShort(offer.counter)}</span>
          )}
        </div>
      </header>

      <p className="offercard__reason">“{offer.reason}”</p>

      {side === 'recibidas' && (
        <footer className="offercard__actions">
          {counterOpen ? (
            <>
              <input
                className="offerdialog__input tnum"
                type="number"
                min={offer.amount}
                step={100_000}
                value={counterAmount}
                onChange={(event) => onCounterAmount(Math.max(0, Number(event.target.value)))}
                aria-label={`Contraoferta por ${offer.playerName}`}
              />
              <span className="offercard__hint">
                {counterAmount <= offer.amount * 1.25
                  ? 'Es un número que probablemente acepten.'
                  : 'Más de un 25% por encima: se van a bajar.'}
              </span>
              <Button size="sm" variant="ghost" onClick={onCloseCounter} disabled={pending}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onRespond('contraofertar', counterAmount)}
                disabled={pending}
              >
                Pedir esto
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => onRespond('rechazar')} disabled={pending}>
                Rechazar
              </Button>
              <Button size="sm" variant="ghost" onClick={onOpenCounter} disabled={pending}>
                Contraofertar
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onRespond('aceptar')}
                disabled={pending}
              >
                Aceptar {moneyShort(offer.amount)}
              </Button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}
