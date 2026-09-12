import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { POSITION_META } from '../../../domain/positions.ts';
import { PlayerChip } from './PlayerChip.tsx';
import { layoutFormation } from './pitch-layout.ts';
import type { LineupEditor } from '../../state/useLineupEditor.ts';

/**
 * CANCHA TACTICA (secciones 6.3, 6.4).
 *
 * Solo sirve para configurar la alineacion: NO representa la simulacion del
 * partido (secciones 6.1, 14). Ocupa el lugar protagonista de la pantalla.
 *
 * Drag & drop: se puede traer un jugador del plantel, intercambiar dos de la
 * cancha o mandar uno al banco. Tambien funciona con clic, para quien
 * prefiera teclado y mouse sin arrastrar.
 */
export function FormationPitch({ editor }: { readonly editor: LineupEditor }): ReactNode {
  const { selection, startersEntries, dragging, setDragging, placeInSlot, selectedId, setSelectedId } =
    editor;
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const layout = useMemo(() => layoutFormation(selection.formationId), [selection.formationId]);

  const onDrop = (event: DragEvent, slotIndex: number): void => {
    event.preventDefault();
    setHoverSlot(null);
    const playerId = dragging?.playerId ?? event.dataTransfer.getData('text/plain');
    if (playerId) placeInSlot(playerId, slotIndex);
    setDragging(null);
  };

  /** Con clic: se elige un jugador y despues el puesto donde va. */
  const onSlotClick = (slotIndex: number, occupantId: string | null): void => {
    if (selectedId && selectedId !== occupantId) {
      placeInSlot(selectedId, slotIndex);
      setSelectedId(null);
      return;
    }
    setSelectedId(occupantId === selectedId ? null : occupantId);
  };

  return (
    <div className="pitch" role="group" aria-label="Cancha de alineación">
      <PitchMarkings />

      {layout.map((item) => {
        const entry = startersEntries[item.slotIndex];
        const occupantId = selection.starters[item.slotIndex] ?? null;
        const meta = POSITION_META[item.slot.position];
        const isHover = hoverSlot === item.slotIndex;
        const isSelected = occupantId !== null && occupantId === selectedId;

        return (
          <div
            key={item.slotIndex}
            className={[
              'pitch__slot',
              entry ? 'is-filled' : 'is-empty',
              isHover ? 'is-hover' : '',
              isSelected ? 'is-selected' : '',
              dragging ? 'is-droppable' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${item.x * 100}%`, bottom: `${8 + item.y * 82}%` }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setHoverSlot(item.slotIndex);
            }}
            onDragLeave={() => setHoverSlot((current) => (current === item.slotIndex ? null : current))}
            onDrop={(event) => onDrop(event, item.slotIndex)}
          >
            <span className="pitch__slotlabel">{item.slot.position}</span>
            {entry ? (
              <button
                className="pitch__chipbtn"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', entry.player.id);
                  setDragging({ kind: 'cancha', playerId: entry.player.id, slotIndex: item.slotIndex });
                }}
                onDragEnd={() => setDragging(null)}
                onClick={() => onSlotClick(item.slotIndex, occupantId)}
                title={`${entry.player.name} — ${meta.name}`}
              >
                <PlayerChip entry={entry} assigned={item.slot.position} />
              </button>
            ) : (
              <button
                className="pitch__empty"
                onClick={() => onSlotClick(item.slotIndex, null)}
                title={`Puesto libre: ${meta.name}`}
              >
                <span className="pitch__plus">+</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Lineas de la cancha. Decorativas: la cancha no simula nada. */
function PitchMarkings(): ReactNode {
  return (
    <svg className="pitch__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="138" />
      <line x1="1" y1="70" x2="99" y2="70" />
      <circle cx="50" cy="70" r="13" />
      <circle cx="50" cy="70" r="0.8" className="pitch__spot" />
      <rect x="27" y="1" width="46" height="19" />
      <rect x="39" y="1" width="22" height="8" />
      <rect x="27" y="120" width="46" height="19" />
      <rect x="39" y="131" width="22" height="8" />
      <circle cx="50" cy="14" r="0.8" className="pitch__spot" />
      <circle cx="50" cy="126" r="0.8" className="pitch__spot" />
    </svg>
  );
}
