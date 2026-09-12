/** DATOS DE DEMOSTRACION — mercado (secciones 11, 19). */

import type { TransferOffer } from '../models/index.ts';

export const DEMO_OFFERS_RECEIVED: readonly TransferOffer[] = [
  {
    id: 'of-1', playerId: 'riv-11', playerName: 'Iván Mendoza',
    fromClubId: 'talleres', toClubId: 'river', amount: 8_400_000,
    status: 'enviada', expiresInDays: 2, counterpartIsHuman: true,
  },
  {
    id: 'of-2', playerId: 'riv-19', playerName: 'Hernán Ledesma',
    fromClubId: 'platense', toClubId: 'river', amount: 1_200_000,
    status: 'contraoferta', expiresInDays: 4, counterpartIsHuman: false,
  },
  {
    id: 'of-3', playerId: 'riv-14', playerName: 'Bruno Aguirre',
    fromClubId: 'boca', toClubId: 'river', amount: 6_900_000,
    status: 'vista', expiresInDays: 1, counterpartIsHuman: true,
  },
];

export const DEMO_OFFERS_SENT: readonly TransferOffer[] = [
  {
    id: 'of-4', playerId: 'ext-1', playerName: 'Matías Roldán (Belgrano)',
    fromClubId: 'river', toClubId: 'belgrano', amount: 5_500_000,
    status: 'contraoferta', expiresInDays: 3, counterpartIsHuman: false,
  },
  {
    id: 'of-5', playerId: 'ext-2', playerName: 'Nahuel Ferrari (Tigre)',
    fromClubId: 'river', toClubId: 'tigre', amount: 3_100_000,
    status: 'enviada', expiresInDays: 5, counterpartIsHuman: true,
  },
];
