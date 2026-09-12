/**
 * OFERTAS DEL MERCADO — ya no hay datos de demostracion aca.
 *
 * Habia cinco ofertas escritas a mano, con jugadores inventados. Dejaron de
 * tener sentido por dos motivos a la vez: la fase 5 genera ofertas reales de
 * los clubes reales por los jugadores del plantel, y desde que el plantel sale
 * de `EQ003003.PKF` esos cinco jugadores inventados ya no existen, asi que las
 * ofertas apuntaban al vacio.
 *
 * Las listas quedan vacias a proposito. La barra superior, el widget del
 * despacho y las alertas ahora leen las ofertas de verdad, que las deriva
 * `offersFromMarket` desde el estado del mercado.
 */

import type { TransferOffer } from '../models/index.ts';
import type { StoredOffer } from '../services/season-store.ts';

export const DEMO_OFFERS_RECEIVED: readonly TransferOffer[] = [];
export const DEMO_OFFERS_SENT: readonly TransferOffer[] = [];

/**
 * Las ofertas del mercado partidas en recibidas y enviadas.
 *
 * Los campos `offersReceived` y `offersSent` del estado son de la fase 1 y los
 * siguen leyendo tres componentes. En lugar de mantener dos fuentes de verdad,
 * se derivan de `market.offers`, que es la unica lista real.
 */
export function offersFromMarket(
  offers: readonly StoredOffer[],
  clubId: string,
): { readonly received: readonly TransferOffer[]; readonly sent: readonly TransferOffer[] } {
  const received: TransferOffer[] = [];
  const sent: TransferOffer[] = [];

  for (const offer of offers) {
    const entry: TransferOffer = {
      id: offer.id,
      playerId: offer.playerId,
      playerName: offer.playerName,
      fromClubId: offer.fromClubId,
      toClubId: offer.toClubId,
      amount: offer.amount,
      status: offer.status,
      // El mercado cuenta en fechas del torneo, no en dias. La barra superior
      // y el widget muestran "dias", asi que se pasa a los dias que faltan
      // hasta la fecha siguiente.
      expiresInDays: 7,
      counterpartIsHuman: false,
    };
    (offer.toClubId === clubId ? received : sent).push(entry);
  }

  return { received, sent };
}
