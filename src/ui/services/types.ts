/**
 * CONTRATO DE SERVICIOS (seccion 18).
 *
 * Esta es la superficie que va a tener que implementar el backend real. La
 * interfaz no conoce otra forma de leer o escribir estado: hoy detras hay
 * mocks, manana una API, y ningun componente cambia.
 *
 * Todo devuelve promesas a proposito, aunque el mock resuelva al instante:
 * asi los estados de carga y error de la UI son los definitivos.
 */

import type { FacilityId } from '../../domain/facilities.ts';
import type { StaffRole } from '../../domain/staff.ts';
import type { GameState, LineupSelection, MatchRecord, TrainingPlan } from '../models/index.ts';

/**
 * Lo que dejo una fecha jugada.
 *
 * `saveWarning` existe porque guardar puede fallar por falta de espacio en el
 * navegador. Cuando pasa, la fecha SI se jugo: lo que no se puede prometer es
 * que sobreviva a una recarga, y eso se dice en pantalla en lugar de
 * esconderlo.
 */
export type PlayRoundReport = {
  /** La fecha que se acaba de jugar. */
  readonly round: number;
  /** El partido del club del manager. `null` si no jugo esa fecha. */
  readonly record: MatchRecord | null;
  readonly injuries: readonly { readonly playerName: string; readonly severity: string; readonly daysOut: number }[];
  readonly suspensions: readonly { readonly playerName: string; readonly matches: number }[];
  /** Partidos que no se pudieron jugar, con el motivo. */
  readonly skipped: readonly string[];
  /** La recaudacion, si el club jugo de local esa fecha (fase 6). */
  readonly gate: {
    readonly attendance: number;
    readonly occupancy: number;
    readonly total: number;
  } | null;
  /** La obra del estadio que termino esta fecha, si termino alguna (fase 6). */
  readonly workFinished: { readonly seats: number; readonly capacity: number } | null;
  readonly saveWarning: string | null;
};

/** Lo que dejo un cierre de temporada (fase 6). */
export type SeasonCloseReport = {
  /** La temporada que empieza, para mostrarla. */
  readonly seasonNumber: number;
  readonly retired: readonly { readonly name: string; readonly age: number }[];
  /** Juveniles a los que se les termino el tiempo en el club. */
  readonly released: readonly { readonly name: string; readonly age: number }[];
  /** Cuantos entraron a inferiores desde la academia. */
  readonly intake: number;
};

export type GameService = {
  /** Carga el estado completo del club que maneja el usuario. */
  loadGame(): Promise<GameState>;

  /**
   * Qué club dirige esta partida, o `null` si todavía no se eligió.
   *
   * Existe para que la interfaz sepa si tiene que mostrar el elector de equipo
   * ANTES de cargar el estado: `loadGame` de una partida sin club elegido
   * devolvería River, y el usuario habría empezado una carrera que no eligió.
   */
  currentTeam(): Promise<string | null>;

  /**
   * Elige el club de esta partida. UNA SOLA VEZ.
   *
   * Falla si ya hay uno elegido: cambiar de club a mitad de carrera dejaría la
   * tabla, las finanzas y el estadio describiendo a otro equipo. Para cambiar
   * hay que empezar de nuevo.
   */
  chooseTeam(clubId: string): Promise<void>;

  /**
   * Persiste la alineacion: titulares, suplentes, formacion, tactica,
   * capitan y balon parado (seccion 6.12).
   */
  saveLineup(clubId: string, selection: LineupSelection): Promise<void>;

  /** Marca un mensaje de la bandeja como leido. */
  markMessageRead(messageId: string): Promise<void>;

  /**
   * Sube un nivel a un profesional del cuerpo tecnico (seccion 7).
   * Cobra el coste de la mejora y sube el salario recurrente.
   */
  upgradeStaff(clubId: string, staffId: string): Promise<void>;

  /** Cubre un puesto vacante con uno de los candidatos disponibles. */
  hireStaff(clubId: string, role: StaffRole, candidateId: string): Promise<void>;

  /**
   * Sube un nivel a una instalacion (seccion 8).
   * Cobra la obra y sube el mantenimiento mensual.
   */
  upgradeFacility(clubId: string, facilityId: FacilityId): Promise<void>;

  /**
   * Juega la fecha completa del torneo (secciones 13, 49).
   *
   * El partido del club del manager usa la alineacion elegida; los demas los
   * resuelve la IA por el mismo motor. Devuelve lo que paso para poder
   * mostrarlo sin volver a consultar.
   */
  playRound(clubId: string, selection: LineupSelection): Promise<PlayRoundReport>;

  /** Vuelve a empezar el torneo desde la fecha 1. */
  resetSeason(clubId: string): Promise<void>;

  /**
   * CIERRA LA TEMPORADA Y EMPIEZA LA SIGUIENTE (fase 6).
   *
   * Es lo que convierte "jugar un torneo" en "dirigir un club": todos cumplen
   * un anio, los veteranos se retiran, a los juveniles pasados de edad se les
   * termina el tiempo y entra la camada nueva de la academia. Irreversible.
   *
   * Solo se puede cuando el torneo termino: cerrar a mitad de temporada seria
   * perder los partidos jugados.
   */
  closeSeason(clubId: string): Promise<SeasonCloseReport>;

  /**
   * El precio de la entrada (seccion 9, fase 6).
   *
   * Es la decision economica mas directa del manager: mas caro recauda mas por
   * persona y puede recaudar menos en total.
   */
  setTicketPrice(clubId: string, price: number): Promise<void>;

  /**
   * Encara la ampliacion del estadio (seccion 9, fase 6).
   *
   * Cobra la obra de una y las semanas bajan al jugar cada fecha. La mas
   * grande no entra en una temporada, a proposito.
   */
  expandStadium(clubId: string, seats: number): Promise<void>;

  /** Guarda el plan de entrenamiento del plantel (seccion 7, fase 4). */
  saveTraining(clubId: string, plan: TrainingPlan): Promise<void>;

  /**
   * Sube un juvenil al plantel profesional (fase 4).
   *
   * Es irreversible en el prototipo: el juvenil deja las inferiores. Lo que se
   * sube es el jugador real, no el informe, asi que un techo que el ojeador
   * informaba mal se descubre jugando.
   */
  promoteYouth(clubId: string, youthId: string): Promise<void>;

  // ============================================================
  // Mercado (secciones 10, 11 — fase 5)
  // ============================================================

  /**
   * Ofrece por un jugador de otro club.
   *
   * El club vendedor responde en el acto y por calculo: valua al jugador,
   * mira cuanto lo necesita y compara. Devuelve lo que respondio.
   */
  sendOffer(clubId: string, playerId: string, amount: number): Promise<OfferOutcome>;

  /** Acepta, rechaza o contraoferta una oferta recibida por un jugador propio. */
  respondToOffer(
    clubId: string,
    offerId: string,
    action: 'aceptar' | 'rechazar' | 'contraofertar',
    counter?: number,
  ): Promise<OfferOutcome>;

  /** Pone o saca a un jugador propio de la lista de transferibles. */
  setTransferListed(clubId: string, playerId: string, listed: boolean): Promise<void>;
};

/** Lo que dejo una operacion del mercado. */
export type OfferOutcome = {
  readonly verdict: 'aceptada' | 'contraoferta' | 'rechazada';
  /** Lo que pide el club vendedor, si contraoferto. */
  readonly counter: number | null;
  /** Lo que dijo el club vendedor, en sus palabras. */
  readonly reason: string;
  /** El traspaso se cerro. */
  readonly closed: boolean;
};
