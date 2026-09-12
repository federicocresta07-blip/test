/**
 * EDITOR DE ALINEACION (secciones 6.4, 6.6, 6.7, 6.12).
 *
 * Concentra TODA la logica de mutacion de la alineacion: mover jugadores
 * entre plantel, cancha y banco, cambiar de formacion, autoseleccionar y
 * guardar. Los componentes visuales no tocan el estado por su cuenta, asi que
 * no hay dos fuentes de verdad (seccion 18).
 *
 * Invariante que se mantiene siempre: un jugador esta en la cancha, en el
 * banco o sin convocar. Nunca en dos lugares a la vez.
 */

import { useCallback, useMemo, useState } from 'react';
import { MAX_BENCH } from '../../domain/lineup.ts';
import { isAvailable } from '../../domain/player.ts';
import type { Tactics } from '../../domain/tactics.ts';
import type { ClubPlayer, LineupSelection, MatchRoles } from '../models/index.ts';
import { proposeLineup, remapFormation, slotsOf, teamMetrics } from '../lib/engine-bridge.ts';
import type { SquadRole } from '../components/player/PlayerCells.tsx';
import { useGame, useGameState } from './GameProvider.tsx';

/** De donde viene el jugador que se esta arrastrando. */
export type DragSource =
  | { readonly kind: 'plantel'; readonly playerId: string }
  | { readonly kind: 'cancha'; readonly playerId: string; readonly slotIndex: number }
  | { readonly kind: 'banco'; readonly playerId: string };

export function useLineupEditor() {
  const state = useGameState();
  const { updateLineup, saveLineup, saveState } = useGame();
  const selection = state.lineup;

  const [dragging, setDragging] = useState<DragSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const slots = useMemo(() => slotsOf(selection.formationId), [selection.formationId]);
  const byId = useMemo(
    () => new Map(state.squad.map((entry) => [entry.player.id, entry])),
    [state.squad],
  );

  const entryOf = useCallback((playerId: string | null): ClubPlayer | undefined =>
    playerId ? byId.get(playerId) : undefined, [byId]);

  const roleOf = useCallback(
    (playerId: string): SquadRole => {
      if (selection.starters.includes(playerId)) return 'titular';
      if (selection.bench.includes(playerId)) return 'suplente';
      return 'no-convocado';
    },
    [selection],
  );

  const apply = useCallback(
    (next: Partial<LineupSelection>) => updateLineup({ ...selection, ...next }),
    [selection, updateLineup],
  );

  /** Quita al jugador de la cancha y del banco, sin ubicarlo en ningun lado. */
  const detach = useCallback(
    (playerId: string, from: { starters: readonly (string | null)[]; bench: readonly string[] }) => ({
      starters: from.starters.map((id) => (id === playerId ? null : id)),
      bench: from.bench.filter((id) => id !== playerId),
    }),
    [],
  );

  /**
   * Pone un jugador en un puesto de la cancha.
   * Si venia de otro puesto, se intercambian. Si el puesto estaba ocupado por
   * otro, ese otro pasa al banco: nunca desaparece en silencio.
   */
  const placeInSlot = useCallback(
    (playerId: string, slotIndex: number) => {
      const entry = byId.get(playerId);
      if (!entry || !isAvailable(entry.player)) return;
      if (slotIndex < 0 || slotIndex >= slots.length) return;

      const currentIndex = selection.starters.indexOf(playerId);
      const occupant = selection.starters[slotIndex] ?? null;

      if (currentIndex === slotIndex) return;

      // Cancha -> cancha: intercambio directo (seccion 6.4).
      if (currentIndex >= 0) {
        const starters = [...selection.starters];
        starters[slotIndex] = playerId;
        starters[currentIndex] = occupant;
        apply({ starters });
        return;
      }

      // Viene del banco o de no convocados.
      const detached = detach(playerId, selection);
      const starters = [...detached.starters];
      starters[slotIndex] = playerId;
      const bench = occupant
        ? [...detached.bench.filter((id) => id !== occupant), occupant].slice(0, MAX_BENCH)
        : detached.bench;
      apply({ starters, bench });
    },
    [apply, byId, detach, selection, slots.length],
  );

  /** Manda al jugador al banco (seccion 6.4). */
  const moveToBench = useCallback(
    (playerId: string) => {
      const entry = byId.get(playerId);
      if (!entry || !isAvailable(entry.player)) return;
      if (selection.bench.includes(playerId)) return;
      if (selection.bench.length >= MAX_BENCH && !selection.starters.includes(playerId)) return;

      const detached = detach(playerId, selection);
      apply({
        starters: detached.starters,
        bench: [...detached.bench, playerId].slice(0, MAX_BENCH),
      });
    },
    [apply, byId, detach, selection],
  );

  /** Lo deja fuera de la convocatoria. */
  const unlist = useCallback(
    (playerId: string) => {
      const detached = detach(playerId, selection);
      apply(detached);
    },
    [apply, detach, selection],
  );

  /** Reordena el banco (seccion 6.4). */
  const reorderBench = useCallback(
    (playerId: string, toIndex: number) => {
      const without = selection.bench.filter((id) => id !== playerId);
      const clamped = Math.max(0, Math.min(without.length, toIndex));
      apply({ bench: [...without.slice(0, clamped), playerId, ...without.slice(clamped)] });
    },
    [apply, selection.bench],
  );

  /**
   * Cambia de formacion redistribuyendo los slots y conservando a los
   * titulares en los puestos mas compatibles (seccion 6.6).
   */
  const setFormation = useCallback(
    (formationId: string) => {
      if (formationId === selection.formationId) return;
      const remapped = remapFormation(state, selection, formationId);
      apply({
        formationId,
        starters: remapped.starters,
        bench: remapped.bench,
        tactics: { ...selection.tactics, formationId },
      });
    },
    [apply, selection, state],
  );

  const setTactics = useCallback(
    (tactics: Tactics) => apply({ tactics, formationId: tactics.formationId }),
    [apply],
  );

  const setRoles = useCallback((roles: Partial<MatchRoles>) =>
    apply({ roles: { ...selection.roles, ...roles } }), [apply, selection.roles]);

  /** AUTOSELECCIONAR XI: propone, no confirma (seccion 6.12). */
  const autoSelect = useCallback(() => {
    const proposal = proposeLineup(state, selection);
    apply({ starters: proposal.starters, bench: proposal.bench.slice(0, MAX_BENCH) });
  }, [apply, selection, state]);

  const metrics = useMemo(() => teamMetrics(state, selection), [state, selection]);

  const startersEntries = useMemo(
    () => selection.starters.map((id) => entryOf(id)),
    [selection.starters, entryOf],
  );
  const benchEntries = useMemo(
    () => selection.bench.map((id) => entryOf(id)).filter((entry): entry is ClubPlayer => !!entry),
    [selection.bench, entryOf],
  );

  return {
    selection,
    slots,
    metrics,
    startersEntries,
    benchEntries,
    entryOf,
    roleOf,
    selectedId,
    setSelectedId,
    dragging,
    setDragging,
    placeInSlot,
    moveToBench,
    unlist,
    reorderBench,
    setFormation,
    setTactics,
    setRoles,
    autoSelect,
    saveLineup,
    saveState,
    maxBench: MAX_BENCH,
  };
}

export type LineupEditor = ReturnType<typeof useLineupEditor>;
