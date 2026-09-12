/**
 * ESTADO DEL JUEGO (seccion 18).
 *
 * Unica fuente de verdad del estado del cliente. Los componentes no guardan
 * copias del plantel ni de la alineacion: leen de aca y despachan acciones.
 * La persistencia pasa siempre por la capa de servicios.
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
import type { GameState, LineupSelection } from '../models/index.ts';
import { gameService } from '../services/index.ts';

export type SaveState = 'limpio' | 'sin-guardar' | 'guardando' | 'guardado' | 'error';

export type GameContextValue = {
  readonly state: GameState | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly saveState: SaveState;
  /** Cambia la alineacion en memoria (no persiste: eso lo hace `saveLineup`). */
  readonly updateLineup: (next: LineupSelection) => void;
  readonly saveLineup: () => Promise<void>;
  readonly markMessageRead: (messageId: string) => void;
  readonly reload: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('limpio');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    gameService
      .loadGame()
      .then((loaded) => {
        if (cancelled) return;
        setState(loaded);
        setSaveState('limpio');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el club');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const updateLineup = useCallback((next: LineupSelection) => {
    setState((current) => (current ? { ...current, lineup: next } : current));
    setSaveState('sin-guardar');
  }, []);

  const saveLineup = useCallback(async () => {
    if (!state) return;
    setSaveState('guardando');
    try {
      await gameService.saveLineup(state.club.id, state.lineup);
      setSaveState('guardado');
      // La confirmacion es discreta y se va sola (seccion 6.12).
      window.setTimeout(() => {
        setSaveState((current) => (current === 'guardado' ? 'limpio' : current));
      }, 2600);
    } catch {
      setSaveState('error');
    }
  }, [state]);

  const markMessageRead = useCallback((messageId: string) => {
    setState((current) => {
      if (!current) return current;
      return {
        ...current,
        inbox: current.inbox.map((message) =>
          message.id === messageId ? { ...message, unread: false } : message,
        ),
      };
    });
    void gameService.markMessageRead(messageId);
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const value = useMemo<GameContextValue>(
    () => ({ state, loading, error, saveState, updateLineup, saveLineup, markMessageRead, reload }),
    [state, loading, error, saveState, updateLineup, saveLineup, markMessageRead, reload],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame tiene que usarse dentro de GameProvider');
  return context;
}

/** Atajo para las pantallas que ya saben que el estado esta cargado. */
export function useGameState(): GameState {
  const { state } = useGame();
  if (!state) throw new Error('El estado del juego todavía no está cargado');
  return state;
}
