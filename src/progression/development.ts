/**
 * DESARROLLO DE ATRIBUTOS (secciones 7, 25, 40 — fase 4 del plan).
 *
 * Esto es lo que le faltaba al motor. `after-match.ts` movia forma, moral,
 * fatiga y cohesion; los atributos no cambiaban nunca. Sin esto, "velocidad de
 * desarrollo de defensores" no puede significar nada, y seis de los trece
 * roles del cuerpo tecnico estaban obligados a decir "todavia no se aplica".
 *
 * Cuatro cosas mueven a un jugador, y ninguna es azar puro:
 *
 * 1. LA EDAD. Un pibe de 18 crece rapido; a los 27 se estanca; despues de los
 *    31 empieza a perder. Y no pierde todo al mismo tiempo: primero se va lo
 *    fisico. Un 5 de 33 anios sigue mejorando el posicionamiento mientras le
 *    baja la velocidad, y eso hace que un veterano siga sirviendo.
 *
 * 2. EL TECHO. Se crece hacia el potencial, no sin limite. Un jugador en su
 *    techo casi no mejora aunque entrene perfecto, y ahi esta la decision del
 *    mercado: pagar por lo que ya es o por lo que puede llegar a ser.
 *
 * 3. LOS MINUTOS. El que no juega no crece. Es la unica forma de que darle la
 *    camiseta a un juvenil sea una decision de verdad y no un boton.
 *
 * 4. EL ENTRENAMIENTO. El plan elegido reparte hacia donde va el crecimiento,
 *    y el entrenador de la linea lo acelera. Los numeros del staff son los de
 *    `domain/staff.ts`: los mismos que muestra la pantalla.
 *
 * El azar existe pero esta acotado y es reproducible: la misma semilla da el
 * mismo desarrollo, como en todo el motor.
 */

import { DEFAULT_CONFIG, type EngineConfig } from '../config/engine-config.ts';
import { clamp } from '../core/math.ts';
import { Rng } from '../core/rng.ts';
import { type AttributeKey, type Attributes } from '../domain/attributes.ts';
import type { Player } from '../domain/player.ts';
import { overallForPosition } from '../ratings/overall.ts';

// ============================================================
// El plan de entrenamiento
// ============================================================

/**
 * Hacia donde se entrena.
 *
 * `general` reparte parejo. Los demas concentran el crecimiento en un grupo,
 * y lo que se gana ahi se pierde de los otros: el total no cambia, se
 * redistribuye. Un plan no es un boost.
 */
export const TRAINING_FOCUSES = [
  'general',
  'fisico',
  'tecnica',
  'ofensivo',
  'defensivo',
  'arquero',
] as const;

export type TrainingFocus = (typeof TRAINING_FOCUSES)[number];

/**
 * Grupo al que pertenece cada atributo, para repartir el entrenamiento.
 *
 * SE CAYO EL GRUPO MENTAL, Y CON EL EL PLAN MENTAL. Con veintinueve atributos
 * habia seis mentales: vision, decisiones, posicionamiento, concentracion,
 * agresividad y trabajo de equipo. Con diez, cinco de esos viven dentro de
 * `calidad`, que es tecnico. No queda nada que entrenar en un plan mental, y
 * dejar el plan en la pantalla entrenando `calidad` seria un dial que promete
 * una cosa y hace otra.
 *
 * En cambio aparece el grupo OFENSIVO como grupo de verdad: `remate` y `tiro`
 * son dos de los diez. Antes eran un bonus de 1,35 sobre una lista de claves
 * sueltas, que era la forma de simular un grupo que no existia.
 */
export type AttributeGroup = 'fisico' | 'tecnico' | 'ofensivo' | 'defensivo' | 'arquero';

const GROUP_OF: Readonly<Record<AttributeKey, AttributeGroup>> = {
  velocidad: 'fisico',
  resistencia: 'fisico',
  agresividad: 'fisico',
  calidad: 'tecnico',
  regate: 'tecnico',
  pase: 'tecnico',
  remate: 'ofensivo',
  tiro: 'ofensivo',
  entradas: 'defensivo',
  portero: 'arquero',
};

export function groupOf(key: AttributeKey): AttributeGroup {
  return GROUP_OF[key];
}

/**
 * Cuanto se lleva cada grupo con cada plan.
 *
 * Son multiplicadores sobre el crecimiento del atributo. El plan `general`
 * deja todo en 1; los demas suben un grupo y bajan el resto, asi que elegir
 * un plan es elegir a que renunciar.
 */
const FOCUS_WEIGHTS: Readonly<Record<TrainingFocus, Readonly<Record<AttributeGroup, number>>>> = {
  general: { fisico: 1, tecnico: 1, ofensivo: 1, defensivo: 1, arquero: 1 },
  fisico: { fisico: 1.9, tecnico: 0.6, ofensivo: 0.7, defensivo: 0.8, arquero: 0.7 },
  tecnica: { fisico: 0.6, tecnico: 1.9, ofensivo: 1.0, defensivo: 0.7, arquero: 0.7 },
  ofensivo: { fisico: 0.9, tecnico: 1.1, ofensivo: 2.0, defensivo: 0.5, arquero: 0.7 },
  defensivo: { fisico: 1.0, tecnico: 0.7, ofensivo: 0.5, defensivo: 2.0, arquero: 0.7 },
  arquero: { fisico: 0.9, tecnico: 0.5, ofensivo: 0.5, defensivo: 0.5, arquero: 2.0 },
};

// ============================================================
// La curva de edad
// ============================================================

/**
 * Cuanto puede crecer (o cuanto pierde) un jugador a cada edad, por grupo.
 *
 * El valor es un multiplicador del crecimiento base. Negativo significa que
 * ese grupo baja. Que lo fisico caiga antes que lo tecnico es lo que hace que
 * un veterano siga teniendo valor: pierde piernas, no cabeza.
 */
export function ageFactor(age: number, group: AttributeGroup): number {
  const physical = group === 'fisico';

  if (age <= 18) return physical ? 1.35 : 1.25;
  if (age <= 21) return physical ? 1.15 : 1.2;
  if (age <= 24) return physical ? 0.8 : 0.95;
  if (age <= 27) return physical ? 0.35 : 0.6;
  if (age <= 29) return physical ? 0.05 : 0.4;
  if (age <= 31) return physical ? -0.35 : 0.2;
  if (age <= 33) return physical ? -0.75 : 0.05;
  if (age <= 35) return physical ? -1.15 : -0.2;
  return physical ? -1.6 : -0.45;
}

/** La edad a la que un jugador deja de crecer en promedio. */
export const PEAK_AGE = 27;

// ============================================================
// El calculo
// ============================================================

export type DevelopmentInput = {
  readonly player: Player;
  /** Semanas de entrenamiento que pasan. */
  readonly weeks: number;
  /** Minutos jugados en esas semanas. */
  readonly minutes: number;
  readonly focus?: TrainingFocus;
  /**
   * Intensidad del entrenamiento, 0..1. Mas intensidad hace crecer mas
   * rapido; lo que cuesta es la fatiga, que se resuelve en `after-match.ts`.
   */
  readonly intensity?: number;
  /**
   * Efecto del entrenador de la linea, en porcentaje (seccion 7).
   * Sale de `staffEffect(...).actual`: ya viene con el limite de las
   * instalaciones descontado.
   */
  readonly coaching?: number;
  readonly seed?: string | number;
  readonly config?: EngineConfig;
};

export type AttributeChange = {
  readonly attribute: AttributeKey;
  readonly from: number;
  readonly to: number;
};

export type DevelopmentResult = {
  readonly player: Player;
  readonly changes: readonly AttributeChange[];
  readonly overallBefore: number;
  readonly overallAfter: number;
  /** Por que crecio o bajo, en palabras del usuario. */
  readonly reasons: readonly string[];
};

/**
 * Minutos por semana que cuentan como "juega siempre".
 *
 * Un titular juega unos 90 minutos por semana. A partir de ahi el beneficio de
 * los minutos deja de crecer: jugar dos partidos completos por semana no
 * desarrolla el doble, y ademas trae fatiga.
 */
const FULL_MINUTES_PER_WEEK = 90;

/**
 * Cuanto aporta jugar, de 0 a 1.
 *
 * El que no juega nada no se queda en cero: entrenar sirve, pero mucho menos.
 * Por eso el piso es 0,35 y no 0: un juvenil que entrena con el plantel y no
 * debuta igual progresa, solo que la mitad de rapido que uno que juega.
 */
export function minutesFactor(minutes: number, weeks: number): number {
  const expected = Math.max(1, weeks) * FULL_MINUTES_PER_WEEK;
  const share = clamp(minutes / expected, 0, 1);
  return 0.35 + 0.65 * Math.sqrt(share);
}

/**
 * Cuanto le queda por crecer, de 0 a 1.
 *
 * Se mide contra el potencial. En el techo da 0: por mas que entrene bien, un
 * jugador no pasa su potencial, y eso es lo que hace que el potencial sea un
 * dato que vale la pena averiguar antes de comprar.
 */
export function headroom(player: Player): number {
  const current = overallForPosition(player.attributes, player.position);
  const room = player.potential - current;
  if (room <= 0) return 0;
  // Los primeros puntos de margen valen mas que los ultimos: acercarse al
  // techo cuesta cada vez mas.
  return clamp(room / 12, 0, 1);
}

/**
 * Desarrolla un jugador durante un periodo.
 *
 * No muta nada: devuelve un jugador nuevo, como todo el motor.
 */
export function developPlayer(input: DevelopmentInput): DevelopmentResult {
  const config = input.config ?? DEFAULT_CONFIG;
  const dev = config.development;
  const player = input.player;
  const weeks = Math.max(0, input.weeks);
  const focus = input.focus ?? 'general';
  const intensity = clamp(input.intensity ?? 0.6, 0, 1);
  const coaching = Math.max(0, input.coaching ?? 0);

  const overallBefore = overallForPosition(player.attributes, player.position);
  if (weeks === 0) {
    return { player, changes: [], overallBefore, overallAfter: overallBefore, reasons: [] };
  }

  const rng = new Rng(`desarrollo:${input.seed ?? player.id}:${player.age}`);
  const room = headroom(player);
  const minutes = minutesFactor(input.minutes, weeks);
  const weights = FOCUS_WEIGHTS[focus];

  // El profesionalismo del jugador: quien se cuida y entrena bien aprovecha
  // mas. Con veintinueve atributos salia de concentracion y trabajo en equipo;
  // los dos viven ahora dentro de `calidad`, que es lo mas cerca que queda de
  // "se toma en serio el entrenamiento".
  const professionalism = player.attributes.calidad / 100;

  const isGoalkeeper = player.position === 'POR';
  const changes: AttributeChange[] = [];
  const next: Record<string, number> = { ...player.attributes };

  for (const key of Object.keys(player.attributes) as AttributeKey[]) {
    const group = groupOf(key);

    // El atributo de arquero solo se mueve en un arquero, y al revés: no
    // tiene sentido que un 9 mejore los reflejos ni que un arquero mejore el
    // remate mas que cualquier otra cosa.
    if (group === 'arquero' && !isGoalkeeper) continue;
    if (isGoalkeeper && (group === 'defensivo' || group === 'ofensivo')) {
      // Un arquero mejora lo de afuera del arco, pero mucho menos.
      if (rng.next() > 0.35) continue;
    }

    const age = ageFactor(player.age, group);
    let weight = weights[group];

    let delta: number;
    if (age > 0) {
      // Crecer necesita margen, minutos y trabajo. El entrenador de la linea
      // lo acelera y el plan decide hacia donde va.
      const drive = age * room * minutes * (0.55 + 0.45 * professionalism);
      delta =
        dev.pointsPerWeek *
        weeks *
        drive *
        (1 + coaching / 100) *
        (0.7 + 0.6 * intensity) *
        weight;
    } else {
      // Caer no depende del margen ni de los minutos: perder velocidad a los
      // 34 pasa igual. Si depende de cuanto se cuide el jugador, y por eso un
      // profesional envejece mejor que uno que no se cuida.
      delta = dev.declinePerWeek * weeks * age * (1.25 - 0.5 * professionalism);
    }

    // Azar acotado: el mismo jugador puede rendir algo distinto, pero nunca se
    // dispara. Nada de `random(sube 10 puntos)`.
    // Acotado a dos desvios: nunca se dispara ni se anula.
    const moved = delta * rng.boundedNormal(1, dev.variation, 2);

    const from = player.attributes[key];
    // Nunca por encima del potencial declarado, ni por debajo de un piso: un
    // veterano pierde piernas, no se convierte en amateur.
    const ceiling = clamp(player.potential + dev.attributeCeilingSlack, 1, 100);
    const to = clamp(from + moved, dev.attributeFloor, ceiling);

    if (Math.round(to) !== Math.round(from)) {
      changes.push({ attribute: key, from: Math.round(from), to: Math.round(to) });
    }
    // Se guarda con decimales A PROPOSITO. Redondear cada vez que se aplica el
    // desarrollo es muerte por redondeo: una ganancia de 0,4 puntos por semana
    // se redondea a cero y no se acumula NUNCA, asi que el sistema entero
    // queda inerte y parece funcionar. Los decimales viven en el modelo y el
    // redondeo pasa al mostrar, que es donde corresponde.
    next[key] = to;
  }

  // No se usa `createPlayer` a proposito: pasa los atributos por
  // `buildAttributes`, que redondea, y eso volveria a tirar los decimales que
  // acabamos de guardar. Aca solo cambian los atributos, asi que el resto del
  // jugador se copia tal cual.
  const developed: Player = { ...player, attributes: next as Attributes };
  const overallAfter = overallForPosition(developed.attributes, developed.position);

  return {
    player: developed,
    changes,
    overallBefore: Math.round(overallBefore),
    overallAfter: Math.round(overallAfter),
    reasons: explain({ player, room, minutes, coaching, focus, overallBefore, overallAfter }),
  };
}

/** Por que este jugador crecio, se estanco o bajo. */
function explain(context: {
  readonly player: Player;
  readonly room: number;
  readonly minutes: number;
  readonly coaching: number;
  readonly focus: TrainingFocus;
  readonly overallBefore: number;
  readonly overallAfter: number;
}): readonly string[] {
  const reasons: string[] = [];
  const { player, room, minutes, coaching, overallBefore, overallAfter } = context;

  if (player.age <= 21) {
    reasons.push(`Tiene ${player.age} años: está en la edad en la que más se crece.`);
  } else if (player.age >= 32) {
    reasons.push(`Tiene ${player.age} años: ya pierde físico, aunque siga mejorando la cabeza.`);
  } else if (player.age >= PEAK_AGE) {
    reasons.push(`Tiene ${player.age} años: está en su mejor momento, casi sin margen para crecer.`);
  }

  if (room <= 0) {
    reasons.push(`Ya llegó a su potencial (${player.potential}): no va a mejorar más.`);
  } else if (room < 0.25) {
    reasons.push(`Le queda poco para su potencial (${player.potential}).`);
  } else {
    reasons.push(`Le quedan ${Math.round(player.potential - overallBefore)} puntos hasta su potencial.`);
  }

  if (minutes < 0.5) {
    reasons.push('Casi no jugó: entrenar sin competir desarrolla mucho menos.');
  } else if (minutes > 0.85) {
    reasons.push('Jugó de forma regular, que es lo que más lo hace crecer.');
  }

  if (coaching > 0) {
    reasons.push(`El entrenador de su línea acelera su desarrollo un ${Math.round(coaching)}%.`);
  } else {
    reasons.push('No hay entrenador para su línea: desarrolla al ritmo base.');
  }

  const moved = overallAfter - overallBefore;
  if (moved > 0) reasons.push(`Subió ${moved} ${moved === 1 ? 'punto' : 'puntos'} de overall.`);
  else if (moved < 0) reasons.push(`Bajó ${-moved} ${-moved === 1 ? 'punto' : 'puntos'} de overall.`);

  return reasons;
}

/** El atributo de arquero, para las pantallas que lo separan. */
export const GK_KEYS: readonly AttributeKey[] = ['portero'];

// ============================================================
// El plantel completo
// ============================================================

/**
 * Cuanto acelera el desarrollo un club sin cuerpo tecnico simulado.
 *
 * Los diecinueve rivales no tienen staff: no simulamos su cuerpo tecnico ni
 * sus instalaciones. Si les diera cero, sus juveniles no crecerian nunca y en
 * tres temporadas el torneo se desbalancearia solo, sin que el manager hiciera
 * nada. Este valor equivale a un entrenador de dos estrellas: existe, pero
 * tener staff propio sigue siendo una ventaja concreta.
 */
export const BASELINE_COACHING = 9;

export type SquadDevelopmentInput = {
  readonly players: readonly Player[];
  readonly weeks: number;
  /** Minutos jugados por cada jugador en el periodo, por id. */
  readonly minutes: Readonly<Record<string, number>>;
  /** El plan que le toca a cada jugador, por id. */
  readonly focusOf: (player: Player) => TrainingFocus;
  /** El efecto del entrenador de su linea, en porcentaje, por jugador. */
  readonly coachingOf: (player: Player) => number;
  readonly intensity?: number;
  readonly seed?: string | number;
  readonly config?: EngineConfig;
};

export type SquadDevelopmentResult = {
  readonly players: readonly Player[];
  /** Los que cambiaron de overall, con cuanto. Los que no, no figuran. */
  readonly moved: readonly {
    readonly playerId: string;
    readonly playerName: string;
    readonly from: number;
    readonly to: number;
  }[];
};

/**
 * Desarrolla un plantel completo durante un periodo.
 *
 * No muta nada. `moved` trae solo a los que cambiaron de overall entero, que
 * es lo que la interfaz informa: decir "Fulano subio 0,3" seria ruido.
 */
export function developSquad(input: SquadDevelopmentInput): SquadDevelopmentResult {
  const moved: {
    playerId: string;
    playerName: string;
    from: number;
    to: number;
  }[] = [];

  const players = input.players.map((player) => {
    const result = developPlayer({
      player,
      weeks: input.weeks,
      minutes: input.minutes[player.id] ?? 0,
      focus: input.focusOf(player),
      coaching: input.coachingOf(player),
      ...(input.intensity !== undefined ? { intensity: input.intensity } : {}),
      seed: `${input.seed ?? 'dev'}:${player.id}`,
      ...(input.config ? { config: input.config } : {}),
    });

    if (result.overallAfter !== result.overallBefore) {
      moved.push({
        playerId: player.id,
        playerName: player.name,
        from: result.overallBefore,
        to: result.overallAfter,
      });
    }
    return result.player;
  });

  return { players, moved };
}

/** Un anio mas para todos. Se aplica al cerrar la temporada. */
export function ageUp(players: readonly Player[]): readonly Player[] {
  return players.map((player) => ({ ...player, age: player.age + 1 }));
}
