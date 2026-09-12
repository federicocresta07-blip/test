/**
 * Punto unico de acceso a servicios.
 * Cambiar el mock por un cliente HTTP es cambiar esta linea.
 */

import { createMockGameService } from './mockGameService.ts';
import type { GameService } from './types.ts';

export const gameService: GameService = createMockGameService();

export { DEMO_DATA_NOTICE } from './mockGameService.ts';
export type { GameService } from './types.ts';
