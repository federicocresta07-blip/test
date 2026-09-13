/**
 * EL SERVICIO CONTRA UN SERVIDOR (fase 8).
 *
 * La otra implementacion del contrato `GameService`. La interfaz no sabe cual
 * de las dos tiene detras: eso era la promesa de la fase 0 —"hoy detras hay
 * mocks, mañana una API, y ningun componente cambia"— y esta es la prueba de
 * que se cumplio. Ningun componente cambio.
 *
 * Se construye solo, sin escribir dieciseis funciones: el contrato tiene
 * dieciseis metodos y todos hacen lo mismo —mandar el nombre y los argumentos,
 * devolver el resultado— asi que escribirlos a mano seria dieciseis lugares
 * donde equivocarse en el nombre. Se generan sobre la lista de metodos, que
 * sale del contrato.
 *
 * LOS ERRORES DEL JUEGO SON ERRORES. El servidor responde 409 cuando la accion
 * no se puede hacer ("no hay caja suficiente para encarar la obra") y aca eso
 * vuelve a ser un `Error` con el mismo mensaje. La interfaz ya sabe mostrar
 * esos mensajes; lo que no tiene que hacer es distinguir si vinieron de un
 * mock o de la red.
 */

import type { GameService } from './types.ts';

/** Los metodos del contrato. Si se agrega uno al contrato, va aca. */
const METHODS = [
  'loadGame',
  'saveLineup',
  'markMessageRead',
  'upgradeStaff',
  'hireStaff',
  'upgradeFacility',
  'playRound',
  'resetSeason',
  'closeSeason',
  'setTicketPrice',
  'expandStadium',
  'saveTraining',
  'promoteYouth',
  'sendOffer',
  'respondToOffer',
  'setTransferListed',
] as const satisfies readonly (keyof GameService)[];

export type HttpServiceOptions = {
  /** Base de la API. Por defecto el mismo origen que sirvio la pagina. */
  readonly baseUrl?: string;
  /**
   * Nombre de la partida.
   *
   * Cuando no se pasa, el servidor la resuelve por cookie y crea una nueva la
   * primera vez. Pasarlo explicitamente sirve para abrir una partida concreta,
   * que es como dos personas juegan cada una la suya en el mismo servidor.
   */
  readonly gameId?: string;
};

export function createHttpGameService(options: HttpServiceOptions = {}): GameService {
  const endpoint = `${options.baseUrl ?? ''}/api/rpc`;

  const call = async (method: string, args: readonly unknown[]): Promise<unknown> => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (options.gameId !== undefined) headers['x-partida'] = options.gameId;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      // La cookie de partida viaja aca: sin esto, cada peticion seria una
      // partida nueva y el juego se reiniciaria solo en cada click.
      credentials: 'same-origin',
      body: JSON.stringify({ method, args }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { result?: unknown; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? `El servidor respondió ${response.status}`);
    }
    return payload?.result ?? undefined;
  };

  const built: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  for (const method of METHODS) {
    built[method] = (...args: unknown[]) => call(method, args);
  }
  return built as unknown as GameService;
}
