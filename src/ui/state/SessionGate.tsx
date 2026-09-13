import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from '../components/ui/EmptyState.tsx';
import { Button } from '../components/ui/Button.tsx';
import { LoginPage } from '../pages/LoginPage.tsx';
import { TeamPickerPage } from '../pages/TeamPickerPage.tsx';
import {
  connectToServer,
  gameService,
  serviceKind,
  sessionState,
  type Session,
} from '../services/index.ts';

/**
 * QUIEN ESTA JUGANDO Y CON QUE CLUB, antes de cargar nada.
 *
 * Este componente decide qué se ve, y son tres cosas y en este orden:
 *
 *   1. LA ENTRADA, si hay servidor y no hay sesión.
 *   2. EL ELECTOR DE EQUIPO, si no hay club elegido en esta partida.
 *   3. EL JUEGO.
 *
 * ============================================================
 * POR QUE ESTA SEPARADO DE `GameProvider`
 * ============================================================
 *
 * Porque `GameProvider` carga el estado del club, y no se puede cargar el
 * estado de un club que todavía no se eligió. `loadGame` de una partida sin
 * club devolvería River —el default— y el usuario se encontraría dirigiendo un
 * equipo que no eligió. Así que la elección va ANTES de montar el proveedor, y
 * el proveedor no se enteró de que existe el login.
 *
 * ============================================================
 * SIN SERVIDOR NO HAY LOGIN, Y ESO NO ES UN AGUJERO
 * ============================================================
 *
 * El HTML autocontenido no tiene servidor donde verificar una contraseña, y la
 * partida es del navegador: quien abre el archivo ya tiene acceso a todo.
 * Pedirle una contraseña sería teatro. Lo que SI hace en ese modo es elegir
 * equipo, que no necesita servidor.
 */
export function SessionGate({ children }: { readonly children: ReactNode }): ReactNode {
  const [phase, setPhase] = useState<'buscando' | 'entrar' | 'elegir' | 'jugar'>('buscando');
  const [who, setWho] = useState<Session | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /** Con sesión resuelta (o sin login), decide si falta elegir club. */
  const decide = useCallback(async (current: Session | null): Promise<void> => {
    setWho(current);
    try {
      // `?? null` para que un `undefined` de cualquier implementación cuente
      // como "no eligió": las dos cosas significan lo mismo acá, y tratarlas
      // distinto fue exactamente el bug que mandaba al usuario a dirigir
      // River sin preguntarle.
      const team = (await gameService.currentTeam()) ?? null;
      setPhase(team === null ? 'elegir' : 'jugar');
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'No se pudo leer la partida');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // El sondeo del servidor pasa primero, igual que antes: decide si la
    // partida vive en el servidor o en el navegador.
    connectToServer()
      .then(async () => {
        if (cancelled) return;
        if (serviceKind() !== 'servidor') {
          // Sin servidor: no hay a quién preguntarle la contraseña.
          await decide(null);
          return;
        }
        const state = await sessionState();
        if (cancelled) return;

        // Hay servidor, pero puede no pedir login. Solo se manda a entrar
        // cuando el servidor dice que hace falta Y no hay sesión.
        if (state.required && state.session === null) {
          setPhase('entrar');
          return;
        }
        await decide(state.session);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setFailure(cause instanceof Error ? cause.message : 'No se pudo arrancar');
      });

    return () => {
      cancelled = true;
    };
  }, [decide]);

  if (failure !== null) {
    return (
      <div className="bootstate">
        <div className="bootstate__box">
          <p className="bootstate__title">No pudimos arrancar</p>
          <p className="bootstate__detail">{failure}</p>
          <Button variant="primary" onClick={() => globalThis.location?.reload()}>
            Volver a intentar
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'buscando') {
    return (
      <div className="bootstate">
        <div className="bootstate__box">
          <p className="bootstate__title">Buscando la partida…</p>
          <Skeleton height={8} width={220} />
        </div>
      </div>
    );
  }

  if (phase === 'entrar') {
    return <LoginPage onEntered={(current) => void decide(current)} />;
  }

  if (phase === 'elegir') {
    return (
      <TeamPickerPage
        nombre={who?.nombre ?? null}
        onChosen={() => {
          setPhase('jugar');
        }}
      />
    );
  }

  return <>{children}</>;
}
