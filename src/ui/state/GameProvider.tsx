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
import type { FacilityId } from '../../domain/facilities.ts';
import type { StaffRole } from '../../domain/staff.ts';
import type { GameState, LineupSelection, TrainingPlan } from '../models/index.ts';
import { gameService } from '../services/index.ts';
import type { OfferOutcome, PlayRoundReport } from '../services/types.ts';

export type SaveState = 'limpio' | 'sin-guardar' | 'guardando' | 'guardado' | 'error';

/**
 * Resultado de una inversion (mejora o contratacion).
 * Cuando falla, `error` explica por que en palabras del usuario.
 */
export type InvestmentState = {
  readonly pending: boolean;
  readonly error: string | null;
  /** Lo ultimo que se hizo bien, para confirmarlo en pantalla. */
  readonly done: string | null;
};

/**
 * Estado de la fecha que se esta jugando.
 *
 * `report` queda disponible despues de jugar para que la pantalla de partido
 * pueda mostrar lo que paso sin volver a pedirlo. Se limpia con `clearRound`.
 */
export type RoundState = {
  readonly playing: boolean;
  readonly error: string | null;
  readonly report: PlayRoundReport | null;
};

/** Estado de la ultima operacion del mercado. */
export type MarketState = {
  readonly pending: boolean;
  readonly error: string | null;
  /** Lo que respondio el otro club. */
  readonly outcome: OfferOutcome | null;
};

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

  /** Desarrollo del club (secciones 7, 8). */
  readonly investment: InvestmentState;
  readonly upgradeStaff: (staffId: string, label: string) => Promise<void>;
  readonly hireStaff: (role: StaffRole, candidateId: string, label: string) => Promise<void>;
  readonly upgradeFacility: (facilityId: FacilityId, label: string) => Promise<void>;
  readonly dismissInvestment: () => void;

  /** Desarrollo del plantel (seccion 7, fase 4). */
  readonly saveTraining: (plan: TrainingPlan) => Promise<void>;
  readonly promoteYouth: (youthId: string, label: string) => Promise<void>;

  /** Mercado (secciones 10, 11 — fase 5). */
  readonly market: MarketState;
  readonly sendOffer: (playerId: string, amount: number) => Promise<OfferOutcome | null>;
  readonly respondToOffer: (
    offerId: string,
    action: 'aceptar' | 'rechazar' | 'contraofertar',
    counter?: number,
  ) => Promise<OfferOutcome | null>;
  readonly setTransferListed: (playerId: string, listed: boolean) => Promise<void>;
  readonly clearMarket: () => void;

  /** Competicion (seccion 13). */
  readonly round: RoundState;
  readonly playRound: () => Promise<void>;
  readonly clearRound: () => void;
  readonly resetSeason: () => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('limpio');
  const [reloadToken, setReloadToken] = useState(0);
  const [investment, setInvestment] = useState<InvestmentState>({
    pending: false,
    error: null,
    done: null,
  });
  const [round, setRound] = useState<RoundState>({ playing: false, error: null, report: null });
  const [market, setMarket] = useState<MarketState>({
    pending: false,
    error: null,
    outcome: null,
  });

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

  /**
   * Ejecuta una inversion y recarga el estado.
   *
   * La recarga es a proposito: el servicio recompone salarios, efectos y
   * finanzas desde el modelo de dominio, asi que despues de invertir la
   * pantalla muestra numeros recalculados y no una copia parcheada a mano.
   */
  const invest = useCallback(
    async (action: () => Promise<void>, label: string) => {
      setInvestment({ pending: true, error: null, done: null });
      try {
        await action();
        const refreshed = await gameService.loadGame();
        setState(refreshed);
        setInvestment({ pending: false, error: null, done: label });
        window.setTimeout(() => {
          setInvestment((current) => (current.done === label ? { ...current, done: null } : current));
        }, 3200);
      } catch (cause: unknown) {
        setInvestment({
          pending: false,
          error: cause instanceof Error ? cause.message : 'No se pudo completar la operación',
          done: null,
        });
      }
    },
    [],
  );

  const upgradeStaff = useCallback(
    async (staffId: string, label: string) => {
      if (!state) return;
      await invest(() => gameService.upgradeStaff(state.club.id, staffId), label);
    },
    [invest, state],
  );

  const hireStaff = useCallback(
    async (role: StaffRole, candidateId: string, label: string) => {
      if (!state) return;
      await invest(() => gameService.hireStaff(state.club.id, role, candidateId), label);
    },
    [invest, state],
  );

  const upgradeFacility = useCallback(
    async (facilityId: FacilityId, label: string) => {
      if (!state) return;
      await invest(() => gameService.upgradeFacility(state.club.id, facilityId), label);
    },
    [invest, state],
  );

  const dismissInvestment = useCallback(
    () => setInvestment({ pending: false, error: null, done: null }),
    [],
  );

  /**
   * Juega la fecha.
   *
   * Guarda primero la alineacion: el partido se juega con el once que quedo
   * confirmado, no con uno a medio editar. Despues recarga el estado, porque
   * la fecha cambia casi todo —tabla, calendario, forma, moral, fatiga,
   * lesiones, suspensiones, cohesion— y recomponerlo a mano seria pedir que
   * se desincronice.
   */
  const playRound = useCallback(async () => {
    if (!state) return;
    setRound({ playing: true, error: null, report: null });
    try {
      await gameService.saveLineup(state.club.id, state.lineup);
      const report = await gameService.playRound(state.club.id, state.lineup);
      const refreshed = await gameService.loadGame();
      setState(refreshed);
      setSaveState('limpio');
      setRound({ playing: false, error: null, report });
    } catch (cause: unknown) {
      setRound({
        playing: false,
        error: cause instanceof Error ? cause.message : 'No se pudo jugar la fecha',
        report: null,
      });
    }
  }, [state]);

  const clearRound = useCallback(
    () => setRound({ playing: false, error: null, report: null }),
    [],
  );

  /**
   * Guarda el plan de entrenamiento y recarga.
   *
   * Recarga a proposito: el plan cambia lo que cada jugador entrena, y la
   * pantalla muestra ese reparto. Parchearlo a mano seria pedir que se
   * desincronice.
   */
  const saveTraining = useCallback(
    async (plan: TrainingPlan) => {
      if (!state) return;
      setState((current) => (current ? { ...current, training: plan } : current));
      try {
        await gameService.saveTraining(state.club.id, plan);
      } catch {
        setSaveState('error');
      }
    },
    [state],
  );

  const promoteYouth = useCallback(
    async (youthId: string, label: string) => {
      if (!state) return;
      await invest(() => gameService.promoteYouth(state.club.id, youthId), label);
    },
    [invest, state],
  );

  /**
   * Corre una operacion del mercado y recarga el estado.
   *
   * Recarga siempre, tambien cuando la oferta se rechaza: la oferta queda
   * anotada en el historial y la pantalla la tiene que mostrar.
   */
  const runMarket = useCallback(
    async (action: () => Promise<OfferOutcome>): Promise<OfferOutcome | null> => {
      if (!state) return null;
      setMarket({ pending: true, error: null, outcome: null });
      try {
        const outcome = await action();
        const refreshed = await gameService.loadGame();
        setState(refreshed);
        setMarket({ pending: false, error: null, outcome });
        return outcome;
      } catch (cause: unknown) {
        setMarket({
          pending: false,
          error: cause instanceof Error ? cause.message : 'No se pudo completar la operación',
          outcome: null,
        });
        return null;
      }
    },
    [state],
  );

  const sendOffer = useCallback(
    async (playerId: string, amount: number) => {
      if (!state) return null;
      return runMarket(() => gameService.sendOffer(state.club.id, playerId, amount));
    },
    [runMarket, state],
  );

  const respondToOffer = useCallback(
    async (offerId: string, action: 'aceptar' | 'rechazar' | 'contraofertar', counter?: number) => {
      if (!state) return null;
      return runMarket(() =>
        gameService.respondToOffer(state.club.id, offerId, action, counter),
      );
    },
    [runMarket, state],
  );

  const setTransferListed = useCallback(
    async (playerId: string, listed: boolean) => {
      if (!state) return;
      await gameService.setTransferListed(state.club.id, playerId, listed);
      const refreshed = await gameService.loadGame();
      setState(refreshed);
    },
    [state],
  );

  const clearMarket = useCallback(
    () => setMarket({ pending: false, error: null, outcome: null }),
    [],
  );

  const resetSeason = useCallback(async () => {
    if (!state) return;
    setRound({ playing: true, error: null, report: null });
    try {
      await gameService.resetSeason(state.club.id);
      const refreshed = await gameService.loadGame();
      setState(refreshed);
      setRound({ playing: false, error: null, report: null });
    } catch (cause: unknown) {
      setRound({
        playing: false,
        error: cause instanceof Error ? cause.message : 'No se pudo reiniciar el torneo',
        report: null,
      });
    }
  }, [state]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      loading,
      error,
      saveState,
      updateLineup,
      saveLineup,
      markMessageRead,
      reload,
      investment,
      upgradeStaff,
      hireStaff,
      upgradeFacility,
      dismissInvestment,
      saveTraining,
      promoteYouth,
      market,
      sendOffer,
      respondToOffer,
      setTransferListed,
      clearMarket,
      round,
      playRound,
      clearRound,
      resetSeason,
    }),
    [
      state,
      loading,
      error,
      saveState,
      updateLineup,
      saveLineup,
      markMessageRead,
      reload,
      investment,
      upgradeStaff,
      hireStaff,
      upgradeFacility,
      dismissInvestment,
      saveTraining,
      promoteYouth,
      market,
      sendOffer,
      respondToOffer,
      setTransferListed,
      clearMarket,
      round,
      playRound,
      clearRound,
      resetSeason,
    ],
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
