/**
 * MODELOS DE DATOS DE LA UI (seccion 18).
 *
 * Los modelos de gestion (club, staff, instalaciones, mercado, competicion)
 * se definen aca. Lo futbolistico NO se duplica: el jugador y el equipo del
 * motor (`src/domain`) son la unica fuente de verdad de atributos, overall,
 * forma, moral y fatiga. `ClubPlayer` los envuelve y agrega lo que el motor
 * no necesita saber (dorsal, contrato, valor, salario).
 */

import type { Player } from '../../domain/player.ts';
import type { Position } from '../../domain/positions.ts';
import type { Tactics } from '../../domain/tactics.ts';
import type { FacilityId, FacilityLevel } from '../../domain/facilities.ts';
import type { StaffLevel, StaffRole } from '../../domain/staff.ts';
import type { MatchRecord } from '../../competition/season.ts';
import type { SeasonTotals } from '../../competition/stats.ts';

export type Division = 'Primera División' | 'Primera Nacional';

export type Club = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  /** Iniciales para el escudo. No usamos escudos reales. */
  readonly badge: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly division: Division;
  readonly stadiumName: string;
};

export type Manager = {
  readonly id: string;
  readonly name: string;
  readonly clubId: string;
  readonly since: string;
};

/** Jugador del club: el jugador del motor mas sus datos de gestion. */
export type ClubPlayer = {
  readonly player: Player;
  readonly shirtNumber: number;
  readonly nationality: string;
  /** Valor de mercado en pesos. */
  readonly value: number;
  /** Salario mensual en pesos. */
  readonly salary: number;
  /** Fin de contrato, ISO corto. */
  readonly contractUntil: string;
  /** Amarillas acumuladas en el torneo: define el riesgo de suspension. */
  readonly yellowCards: number;
  /** Descontento con su situacion (minutos, contrato, rol). */
  readonly unhappy: boolean;
};

/** Designados de balon parado y capitania (seccion 6.10). */
export type MatchRoles = {
  readonly captainId: string | null;
  readonly penaltiesId: string | null;
  readonly freeKicksId: string | null;
  readonly leftCornerId: string | null;
  readonly rightCornerId: string | null;
};

/**
 * Alineacion elegida por el manager.
 *
 * `starters` tiene exactamente un hueco por puesto de la formacion, en el
 * mismo orden que los slots del motor. `null` = puesto vacio.
 */
export type LineupSelection = {
  readonly formationId: string;
  readonly starters: readonly (string | null)[];
  readonly bench: readonly string[];
  readonly tactics: Tactics;
  readonly roles: MatchRoles;
};

/**
 * Un profesional del cuerpo técnico.
 *
 * El salario y el efecto NO se guardan acá: se derivan del rol y del nivel
 * con el modelo de dominio (`src/domain/staff.ts`). Así no puede pasar que
 * lo que muestra la pantalla no coincida con lo que aplica el juego.
 */
export type StaffMember = {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly level: StaffLevel;
  readonly yearsAtClub: number;
};

/** Un candidato disponible para un puesto vacante (seccion 7). */
export type StaffCandidate = {
  readonly id: string;
  readonly name: string;
  readonly level: StaffLevel;
  /** De dónde viene o qué hizo. Da contexto a la decisión. */
  readonly background: string;
};

/** Puesto sin cubrir, con los candidatos que ofrece el mercado. */
export type StaffVacancy = {
  readonly role: StaffRole;
  readonly candidates: readonly StaffCandidate[];
};

/**
 * Una instalación del club. Igual que con el staff, el coste de mejora y el
 * mantenimiento se derivan del modelo de dominio.
 */
export type ClubFacility = {
  readonly id: FacilityId;
  readonly level: FacilityLevel;
};

/** Obra o mejora en curso (secciones 5.5, 8, 9). */
export type DevelopmentProject = {
  readonly id: string;
  readonly kind: 'estadio' | 'instalación' | 'staff';
  /** Qué se está haciendo, listo para mostrar. */
  readonly label: string;
  /** A qué apunta: id de instalación o de profesional. Vacío para el estadio. */
  readonly targetId: string | null;
  readonly fromLevel: number | null;
  readonly toLevel: number | null;
  readonly weeksTotal: number;
  readonly weeksLeft: number;
  readonly cost: number;
};

/** Avance de una obra, 0..1. Derivado, nunca guardado. */
export function projectProgress(project: DevelopmentProject): number {
  if (project.weeksTotal <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - project.weeksLeft / project.weeksTotal));
}

export type Finances = {
  readonly cash: number;
  readonly transferBudget: number;
  readonly wageBill: number;
  readonly monthlyIncome: number;
  readonly monthlyExpenses: number;
};

export type Fixture = {
  readonly id: string;
  readonly round: number;
  readonly date: string;
  /** Hora de inicio, formato HH:MM. */
  readonly time: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly competition: string;
  /** Resultado, si ya se jugo. */
  readonly score: { readonly home: number; readonly away: number } | null;
};

export type LeagueRow = {
  readonly clubId: string;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly points: number;
  /** Ultimos cinco resultados, del mas reciente al mas viejo. */
  readonly form: readonly ('V' | 'E' | 'D')[];
};

export type TransferOfferStatus =
  | 'enviada'
  | 'vista'
  | 'contraoferta'
  | 'aceptada'
  | 'rechazada'
  | 'vencida';

export type TransferOffer = {
  readonly id: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly fromClubId: string;
  readonly toClubId: string;
  readonly amount: number;
  readonly status: TransferOfferStatus;
  readonly expiresInDays: number;
  /** El club que responde es humano o IA. Solo afecta la presentacion. */
  readonly counterpartIsHuman: boolean;
};

/** Autor de un mensaje de la bandeja: cada rol del staff "habla" (seccion 5.4). */
export type InboxAuthor = StaffRole | 'Presidencia' | 'Prensa';

export type InboxMessage = {
  readonly id: string;
  readonly author: InboxAuthor;
  readonly authorName: string;
  readonly subject: string;
  readonly body: string;
  readonly date: string;
  readonly unread: boolean;
  /** A donde lleva el mensaje, si corresponde actuar. */
  readonly action: { readonly label: string; readonly route: string } | null;
};

/**
 * El torneo tal como lo ve la interfaz (seccion 13).
 *
 * Ni el fixture ni la tabla estan aca: los dos se derivan. Lo que si esta es
 * lo que no se puede recalcular —los partidos jugados y los acumulados— mas
 * en que fecha va el torneo.
 */
export type SeasonView = {
  readonly seed: string;
  /** Proxima fecha a jugar. */
  readonly round: number;
  readonly totalRounds: number;
  readonly finished: boolean;
  readonly records: readonly MatchRecord[];
  readonly totals: SeasonTotals;
  /** El ultimo partido del club del manager, si ya jugo alguno. */
  readonly lastUserMatch: MatchRecord | null;
  /**
   * Cohesion del plantel del manager, 1..100 (seccion 39).
   *
   * La calcula la progresion del motor despues de cada partido y la guarda la
   * temporada. Antes se estimaba en la interfaz a partir de la moral: eran dos
   * fuentes de verdad para el mismo numero, y la del motor es la que manda.
   */
  readonly chemistry: number;
};

export type AlertSeverity = 'danger' | 'warn' | 'info';

/** Alerta accionable del plantel (seccion 5.3). */
export type SquadAlert = {
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly label: string;
  readonly detail: string;
  readonly route: string;
  readonly actionLabel: string;
};

/** Estado completo del juego que consume la UI. */
export type GameState = {
  readonly manager: Manager;
  readonly club: Club;
  readonly clubs: readonly Club[];
  readonly squad: readonly ClubPlayer[];
  readonly lineup: LineupSelection;
  readonly finances: Finances;
  readonly staff: readonly StaffMember[];
  readonly vacancies: readonly StaffVacancy[];
  readonly facilities: readonly ClubFacility[];
  readonly projects: readonly DevelopmentProject[];
  readonly fixtures: readonly Fixture[];
  readonly table: readonly LeagueRow[];
  readonly offersReceived: readonly TransferOffer[];
  readonly offersSent: readonly TransferOffer[];
  readonly inbox: readonly InboxMessage[];
  readonly season: SeasonView;
  readonly currentRound: number;
  readonly seasonLabel: string;
  readonly today: string;
};

/** Grupo de posiciones para los filtros rapidos del plantel (seccion 6.2). */
export type PositionGroup = 'POR' | 'DEF' | 'MED' | 'ATA';

export type { FacilityId, FacilityLevel, MatchRecord, Player, Position, SeasonTotals, StaffLevel, StaffRole, Tactics };
