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
  'currentTeam',
  'chooseTeam',
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
   * YA NO LO DECIDE EL CLIENTE cuando el servidor pide login: la partida es la
   * del usuario de la sesión y el servidor ignora este valor. Se mantiene para
   * el modo sin login, que usan los tests que prueban el juego y no la
   * entrada.
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

    // EL `null` SE DEVUELVE COMO `null`, no como `undefined`.
    //
    // Acá había `payload?.result ?? undefined`, y `null ?? undefined` es
    // `undefined`. No molestaba mientras ningún método devolviera `null` como
    // respuesta con significado: los que devuelven algo devolvían objetos, y
    // los `void` daban `undefined` de todas formas.
    //
    // `currentTeam` rompió eso: su contrato es `string | null` y el `null`
    // quiere decir "todavía no eligió club". Convertido a `undefined`, la
    // interfaz leía "hay club" y mandaba al usuario a dirigir River sin
    // preguntarle. Se vio en el navegador, no en el compilador: los dos tipos
    // pasan por `unknown`.
    if (payload !== null && 'result' in payload) return payload.result;
    return undefined;
  };

  const built: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  for (const method of METHODS) {
    built[method] = (...args: unknown[]) => call(method, args);
  }
  return built as unknown as GameService;
}
