/**
 * SITUACION DEL PLANTEL (seccion 5.3).
 *
 * Las alertas no se guardan: se derivan del estado del plantel, asi que nunca
 * quedan desactualizadas. Cada una lleva a la pantalla donde se resuelve.
 */

import { isInjured, isSuspended } from '../../domain/player.ts';
import type { ClubPlayer, GameState, SquadAlert } from '../models/index.ts';
import { energyOf } from './ratings.ts';
import { suspensionRisk } from './engine-bridge.ts';

const CONTRACT_WARNING_MONTHS = 8;

function monthsUntil(iso: string, today: string): number {
  const end = new Date(`${iso}T12:00:00`).getTime();
  const now = new Date(`${today}T12:00:00`).getTime();
  return (end - now) / (1000 * 60 * 60 * 24 * 30.4);
}

function names(entries: readonly ClubPlayer[], max = 3): string {
  const list = entries.map((entry) => entry.player.name);
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')} y ${list.length - max} más`;
}

export function squadAlerts(state: GameState): readonly SquadAlert[] {
  const alerts: SquadAlert[] = [];
  const squad = state.squad;

  const injured = squad.filter((entry) => isInjured(entry.player));
  if (injured.length > 0) {
    alerts.push({
      id: 'injured',
      severity: 'danger',
      label: `${injured.length} ${injured.length === 1 ? 'lesionado' : 'lesionados'}`,
      detail: names(injured),
      route: '/equipo/plantel',
      actionLabel: 'Ver plantel',
    });
  }

  const suspended = squad.filter((entry) => isSuspended(entry.player));
  if (suspended.length > 0) {
    alerts.push({
      id: 'suspended',
      severity: 'danger',
      label: `${suspended.length} ${suspended.length === 1 ? 'suspendido' : 'suspendidos'}`,
      detail: names(suspended),
      route: '/equipo/plantel',
      actionLabel: 'Ver plantel',
    });
  }

  const atRisk = squad.filter(
    (entry) => suspensionRisk(entry) && !isSuspended(entry.player) && !isInjured(entry.player),
  );
  if (atRisk.length > 0) {
    alerts.push({
      id: 'risk',
      severity: 'warn',
      label: `${atRisk.length} al límite de amarillas`,
      detail: `${names(atRisk)} — una más y se pierden la próxima`,
      route: '/equipo/alineacion',
      actionLabel: 'Preparar equipo',
    });
  }

  // Fatiga: solo importa la de los que van a jugar.
  const starters = new Set(state.lineup.starters.filter((id): id is string => id !== null));
  const tired = squad.filter((entry) => starters.has(entry.player.id) && energyOf(entry.player) < 72);
  if (tired.length > 0) {
    alerts.push({
      id: 'fatigue',
      severity: 'warn',
      label: `${tired.length} ${tired.length === 1 ? 'titular cansado' : 'titulares cansados'}`,
      detail: `${names(tired)} — conviene rotar`,
      route: '/equipo/alineacion',
      actionLabel: 'Rotar equipo',
    });
  }

  const expiring = squad.filter(
    (entry) => monthsUntil(entry.contractUntil, state.today) <= CONTRACT_WARNING_MONTHS,
  );
  if (expiring.length > 0) {
    alerts.push({
      id: 'contracts',
      severity: 'warn',
      label: `${expiring.length} ${expiring.length === 1 ? 'contrato por vencer' : 'contratos por vencer'}`,
      detail: names(expiring),
      route: '/equipo/plantel',
      actionLabel: 'Ver contratos',
    });
  }

  const unhappy = squad.filter((entry) => entry.unhappy);
  if (unhappy.length > 0) {
    alerts.push({
      id: 'unhappy',
      severity: 'info',
      label: `${unhappy.length} ${unhappy.length === 1 ? 'jugador descontento' : 'jugadores descontentos'}`,
      detail: `${names(unhappy)} — piden minutos`,
      route: '/equipo/plantel',
      actionLabel: 'Ver plantel',
    });
  }

  const pendingOffers = state.offersReceived.filter(
    (offer) => offer.status === 'enviada' || offer.status === 'contraoferta',
  );
  if (pendingOffers.length > 0) {
    alerts.push({
      id: 'offers',
      severity: 'info',
      label: `${pendingOffers.length} ${pendingOffers.length === 1 ? 'oferta pendiente' : 'ofertas pendientes'}`,
      detail: pendingOffers.map((offer) => offer.playerName).join(', '),
      route: '/mercado/recibidas',
      actionLabel: 'Ver ofertas',
    });
  }

  return alerts;
}

/** Puestos sin cubrir en la alineacion guardada: bloquea estar "listo". */
export function lineupIsComplete(state: GameState): boolean {
  return state.lineup.starters.every((id) => id !== null);
}
