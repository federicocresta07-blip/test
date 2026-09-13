/**
 * EL PLAN POR FASES, DECLARADO EN UN SOLO LUGAR (seccion 22).
 *
 * Hasta la fase 4 el estado del plan estaba en tres lugares: la tabla de
 * `docs/ui.md`, la bandera `ready` de cada entrada de la navegacion, y el
 * `consumer` de cada rol del staff, que promete una fase. Los tres se podian
 * desincronizar, y de hecho se desincronizaron: el analista de rivales decia
 * "fase 7" DESPUES de que la fase 7 estuviera entregada.
 *
 * Ahora el estado de cada fase se declara aca y todo lo demas lo consulta. No
 * alcanza con derivarlo de la navegacion: la fase 8 no tiene pantalla propia
 * —es trabajo transversal— y sin embargo hay efectos del staff que la esperan.
 */

export type PhasePlan = {
  readonly phase: number;
  readonly label: string;
  readonly delivered: boolean;
  /** Que queda por hacer, para las fases pendientes. */
  readonly summary?: string;
};

export const PHASES: readonly PhasePlan[] = [
  { phase: 0, label: 'Fundaciones y shell', delivered: true },
  { phase: 1, label: 'Despacho del Manager', delivered: true },
  { phase: 2, label: 'Plantel, Alineación y Táctica', delivered: true },
  { phase: 3, label: 'Staff, Desarrollo e Instalaciones', delivered: true },
  { phase: 4, label: 'Inferiores, Scouting y Entrenamiento', delivered: true },
  { phase: 5, label: 'Mercado y negociaciones', delivered: true },
  { phase: 6, label: 'Estadio y finanzas', delivered: true },
  { phase: 7, label: 'Competición y resultado de partido', delivered: true },
  { phase: 8, label: 'Hardening y backend real', delivered: true },
];

const BY_PHASE = new Map(PHASES.map((entry) => [entry.phase, entry]));

export function phasePlan(phase: number): PhasePlan | undefined {
  return BY_PHASE.get(phase);
}

export function isPhaseDelivered(phase: number): boolean {
  return BY_PHASE.get(phase)?.delivered ?? false;
}

export function deliveredPhases(): readonly PhasePlan[] {
  return PHASES.filter((entry) => entry.delivered);
}

export function pendingPhases(): readonly PhasePlan[] {
  return PHASES.filter((entry) => !entry.delivered);
}

/** "0 a 4 y 7", para que la sidebar lo diga sin escribirlo a mano. */
export function deliveredPhasesLabel(): string {
  const numbers = deliveredPhases().map((entry) => entry.phase);
  const groups: number[][] = [];
  for (const number of numbers) {
    const last = groups[groups.length - 1];
    if (last && number === (last[last.length - 1] as number) + 1) last.push(number);
    else groups.push([number]);
  }
  const parts = groups.map((group) =>
    group.length === 1
      ? String(group[0])
      : group.length === 2
        ? `${group[0]} y ${group[1]}`
        : `${group[0]} a ${group[group.length - 1]}`,
  );
  if (parts.length === 1) return parts[0] as string;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}
