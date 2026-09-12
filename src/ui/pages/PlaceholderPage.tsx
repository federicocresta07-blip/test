import type { ReactNode } from 'react';
import { Panel } from '../components/ui/Panel.tsx';
import { findNavItem, pendingModuleCount } from '../router/navigation.ts';
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
            El plan de implementación es incremental y por fases. Están entregadas las fases 0
            (fundaciones y shell), 1 (Despacho del Manager), 2 (Plantel, Alineación y Táctica), 3
            (Staff, Instalaciones y Bandeja) y 7 (Competición: se juegan los partidos y de ahí
            salen la tabla, los goleadores y las noticias). Quedan {pendingModuleCount()} módulos,
            cada uno con su página como esta.
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
