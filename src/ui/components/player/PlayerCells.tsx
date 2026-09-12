import type { ReactNode } from 'react';
import { isInjured, isSuspended } from '../../../domain/player.ts';
import type { ClubPlayer } from '../../models/index.ts';
import { positionGroup, positionGroupColor } from '../../lib/positions.ts';
import { energyColor, energyOf, formArrow, formColor, formText } from '../../lib/ratings.ts';
import { suspensionRisk } from '../../lib/engine-bridge.ts';
import { StatusBadge, type PlayerStatus } from '../ui/Badge.tsx';
import { ColorBar } from '../ui/ProgressBar.tsx';

/** Etiqueta de posicion con el color de su grupo. */
export function PositionTag({ entry }: { readonly entry: ClubPlayer }): ReactNode {
  const group = positionGroup(entry.player.position);
  return (
    <span
      className="postag"
      style={{ color: positionGroupColor(group), borderColor: positionGroupColor(group) }}
      title={`${entry.player.position} — ${group}`}
    >
      {entry.player.position}
    </span>
  );
}

/** Dorsal + nombre. El dorsal ancla la lectura, como en los managers clasicos. */
export function PlayerName({
  entry,
  showSecondary = false,
}: {
  readonly entry: ClubPlayer;
  readonly showSecondary?: boolean;
}): ReactNode {
  return (
    <span className="playername">
      <span className="playername__number tnum">{entry.shirtNumber}</span>
      <span className="playername__text truncate">{entry.player.name}</span>
      {showSecondary && entry.player.secondaryPositions.length > 0 && (
        <span className="playername__secondary muted">
          {entry.player.secondaryPositions.join(' ')}
        </span>
      )}
    </span>
  );
}

export function FormCell({ entry }: { readonly entry: ClubPlayer }): ReactNode {
  const form = entry.player.condition.form;
  return (
    <span className="formcell" style={{ color: formColor(form) }} title={`Forma: ${formText(form)}`}>
      <span className="formcell__arrow">{formArrow(form)}</span>
      <span className="formcell__text truncate">{formText(form)}</span>
    </span>
  );
}

export function EnergyCell({ entry }: { readonly entry: ClubPlayer }): ReactNode {
  const energy = energyOf(entry.player);
  return (
    <span className="energycell" title={`Energía: ${Math.round(energy)}%`}>
      <span className="energycell__value tnum" style={{ color: energyColor(energy) }}>
        {Math.round(energy)}
      </span>
      <ColorBar value={energy / 100} color={energyColor(energy)} height={3} />
    </span>
  );
}

/** Estados del jugador como iconos compactos (seccion 6.11). */
export function playerStatuses(entry: ClubPlayer): readonly { status: PlayerStatus; detail: string }[] {
  const out: { status: PlayerStatus; detail: string }[] = [];
  const player = entry.player;

  if (isInjured(player)) {
    out.push({
      status: 'lesionado',
      detail: `vuelve en ${player.injuryDaysRemaining} ${player.injuryDaysRemaining === 1 ? 'día' : 'días'}`,
    });
  }
  if (isSuspended(player)) {
    out.push({
      status: 'suspendido',
      detail: `${player.suspensionMatchesRemaining} ${player.suspensionMatchesRemaining === 1 ? 'fecha' : 'fechas'}`,
    });
  }
  if (suspensionRisk(entry) && !isSuspended(player)) {
    out.push({ status: 'riesgo', detail: `${entry.yellowCards} amarillas` });
  }
  if (energyOf(player) < 70 && !isInjured(player)) {
    out.push({ status: 'fatigado', detail: `${Math.round(energyOf(player))}% de energía` });
  }
  if (entry.unhappy) {
    out.push({ status: 'descontento', detail: 'pide minutos o mejora de contrato' });
  }
  if (player.condition.form >= 80) {
    out.push({ status: 'forma', detail: formText(player.condition.form) });
  } else if (player.condition.form <= 35) {
    out.push({ status: 'baja-forma', detail: formText(player.condition.form) });
  }
  return out;
}

export function StatusCell({ entry }: { readonly entry: ClubPlayer }): ReactNode {
  const statuses = playerStatuses(entry);
  if (statuses.length === 0) return <span className="muted">—</span>;
  return (
    <span className="statuscell">
      {statuses.map((item) => (
        <StatusBadge key={item.status} status={item.status} detail={item.detail} />
      ))}
    </span>
  );
}

/** Rol del jugador en la convocatoria (seccion 6.7). */
export type SquadRole = 'titular' | 'suplente' | 'no-convocado';

export function RoleTag({
  role,
  short = false,
}: {
  readonly role: SquadRole;
  readonly short?: boolean;
}): ReactNode {
  const long = role === 'titular' ? 'Titular' : role === 'suplente' ? 'Banco' : 'No conv.';
  const brief = role === 'titular' ? 'XI' : role === 'suplente' ? 'BCO' : '—';
  return (
    <span className={`roletag roletag--${role}`} title={long}>
      {short ? brief : long}
    </span>
  );
}
