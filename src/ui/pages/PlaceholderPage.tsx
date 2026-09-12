import type { ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { findNavItem } from '../router/navigation.ts';
import { useRouter } from '../router/router.tsx';

/**
 * Pagina de modulo pendiente (seccion 20, fase 0).
 *
 * Es deliberadamente honesta: dice que todavia no existe, en que fase del
 * plan se construye y que va a hacer. No tiene botones que finjan funcionar.
 */
export function PlaceholderPage(): ReactNode {
  const { path } = useRouter();
  const item = findNavItem(path);

  return (
    <div className="page page--narrow">
      <Panel title={item?.label ?? 'Módulo'}>
        <div className="placeholder">
          <span className="placeholder__phase">Fase {item?.phase ?? '—'} del plan</span>
          <h2 className="placeholder__title">Este módulo todavía no está construido</h2>
          {item?.summary && <p className="placeholder__summary">{item.summary}</p>}
          <p className="placeholder__note">
            El plan de implementación es incremental y por fases. Esta entrega cubre la fase 0
            (fundaciones y shell), la fase 1 (Despacho del Manager) y la estructura de la fase 2
            (Plantel y Alineación). El resto se construye después, en orden.
          </p>
        </div>
      </Panel>
    </div>
  );
}

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
