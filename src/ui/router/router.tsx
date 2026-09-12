/**
 * Router minimo basado en hash.
 *
 * Las rutas del juego son planas y no necesitan carga diferida, rutas
 * anidadas ni loaders, asi que no justifica una libreria (regla de la
 * seccion 21: no agregar dependencias sin razon concreta). El hash evita
 * tener que configurar rewrites en el servidor para el build.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type RouteState = {
  /** Ruta actual, siempre empezando con "/". */
  readonly path: string;
  readonly navigate: (to: string) => void;
};

const RouterContext = createContext<RouteState | null>(null);

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.length > 0 ? raw : '/';
}

export function RouterProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = (): void => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to: string) => {
    if (currentPath() === to) return;
    window.location.hash = to;
  }, []);

  const value = useMemo<RouteState>(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouteState {
  const context = useContext(RouterContext);
  if (!context) throw new Error('useRouter tiene que usarse dentro de RouterProvider');
  return context;
}

/** Enlace interno. Se comporta como un `<a>` de verdad (ctrl+click, etc). */
export function Link({
  to,
  className,
  children,
  title,
  onNavigate,
}: {
  readonly to: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
  readonly title?: string | undefined;
  readonly onNavigate?: (() => void) | undefined;
}): ReactNode {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      className={className}
      title={title}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

/** La ruta activa incluye a sus hijas: /equipo marca /equipo/plantel. */
export function isRouteActive(current: string, target: string): boolean {
  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}
