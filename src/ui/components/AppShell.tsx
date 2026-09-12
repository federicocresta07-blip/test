import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { ClubHeader } from './ClubHeader.tsx';

/**
 * GAME SHELL PERSISTENTE (seccion 3.1).
 *
 * No es una coleccion de paginas: es un unico marco desde el cual el manager
 * navega todo el club. La sidebar, la barra superior y la franja del proximo
 * partido no se van nunca.
 */
export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <TopBar />
        <ClubHeader />
        <main className="shell__content">{children}</main>
      </div>
    </div>
  );
}
