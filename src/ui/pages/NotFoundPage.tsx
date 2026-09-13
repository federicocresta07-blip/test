import type { ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';

/**
 * RUTA QUE NO EXISTE.
 *
 * Antes este archivo tenia dos paginas: esta y `PlaceholderPage`, la de
 * "modulo pendiente", que decia en que fase se construia cada pantalla que
 * todavia no estaba. Con las nueve fases entregadas no queda ninguna, asi que
 * la pagina de pendiente solo podia mentir y se borro en lugar de quedar
 * inalcanzable esperando a que volviera a ser cierta.
 */
export function NotFoundPage(): ReactNode {
  return (
    <div className="page page--narrow">
      <Panel title="Ruta desconocida">
        <div className="placeholder">
          <h2 className="placeholder__title">No encontramos esta pantalla</h2>
          <p className="placeholder__note">
            El enlace no corresponde a ninguna sección del juego. Usá la navegación de la izquierda.
          </p>
        </div>
      </Panel>
    </div>
  );
}
