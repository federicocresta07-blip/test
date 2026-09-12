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
import type { GameState, LineupSelection } from '../models/index.ts';

export type GameService = {
  /** Carga el estado completo del club que maneja el usuario. */
  loadGame(): Promise<GameState>;

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
};
